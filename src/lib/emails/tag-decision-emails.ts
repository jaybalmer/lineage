// PB-009 Phase 3 — owner notification when an editor declines a pending tag.
//
// Mirrors src/lib/emails/claim-emails.ts shape and src/lib/invite-tracking-server.ts
// dedup pattern. The dedup record lives in tag_decision_notifications with
// UNIQUE (tag_event_id, notification_type) so a re-decline (e.g., a future
// editor override) never sends two emails for the same decision.
//
// Editor identity is NOT surfaced in the owner email — the decline reason
// is shown as a category label, and the email signature says "the Linestry
// moderation team" (peer accountability for editors stays internal per Q3).

import type { SupabaseClient } from "@supabase/supabase-js"
import type { TagEventDeclineCategory } from "@/types"
import { labelForDeclineCategory } from "@/lib/decline-categories"
import { emailHeaderHtml, emailFooterHtml, EMAIL_REPLY_TO, LIST_UNSUBSCRIBE_HEADERS } from "@/lib/emails/shared-header"

const NOTIFICATION_TYPE_EDITOR_DECLINE = "editor_decline"

interface FireEditorDeclineNotificationArgs {
  tagEventId: string
  ownerId: string
  decidedBy: string
  reasonCategory: TagEventDeclineCategory
}

/**
 * Idempotent: a duplicate insert on (tag_event_id, notification_type) makes
 * the email step a no-op. Everything that can make sending impossible (no
 * Resend key, no resolvable owner email) is checked BEFORE the dedup row is
 * claimed, so a transient failure never permanently suppresses the
 * notification. Resend send is fire-and-forget; failures are logged but
 * never thrown. Caller may safely await without a try/catch.
 */
export async function fireEditorDeclineNotification(
  supabase: SupabaseClient,
  args: FireEditorDeclineNotificationArgs,
): Promise<{ sent: boolean; reason?: string }> {
  const key = process.env.RESEND_API_KEY
  if (!key) return { sent: false, reason: "no_resend_key" }

  // Owner email + display name. profiles has NO email column; the address
  // lives in auth.users and is resolved through the admin API, the same way
  // comment-emails and invite-tracking-server do it. Unclaimed subjects have
  // no auth user, so no email on file is a silent no-op.
  const [ownerUserRes, ownerProfileRes] = await Promise.all([
    supabase.auth.admin.getUserById(args.ownerId),
    supabase.from("profiles").select("display_name").eq("id", args.ownerId).maybeSingle(),
  ])
  const ownerEmail = ownerUserRes.data?.user?.email
  if (!ownerEmail) {
    return { sent: false, reason: "no_owner_email" }
  }
  const ownerName =
    (ownerProfileRes.data as { display_name?: string } | null)?.display_name ?? null

  // Dedup record insert. If UNIQUE conflicts → already fired, return no-op.
  const { error: insErr } = await supabase
    .from("tag_decision_notifications")
    .insert({
      tag_event_id:      args.tagEventId,
      subject_id:        args.ownerId,
      notification_type: NOTIFICATION_TYPE_EDITOR_DECLINE,
      decided_by:        args.decidedBy,
      reason_category:   args.reasonCategory,
    })
  if (insErr) {
    if (insErr.code === "23505" || insErr.message.toLowerCase().includes("duplicate")) {
      return { sent: false, reason: "already_sent" }
    }
    console.error("[tag-decision-emails] dedup insert failed:", insErr.message)
    return { sent: false, reason: "insert_failed" }
  }

  try {
    const { Resend } = await import("resend")
    const resend = new Resend(key)
    const categoryLabel = labelForDeclineCategory(args.reasonCategory)
    // The Resend SDK reports API-level rejections in the result object and
    // only throws on transport errors, so both paths are checked here.
    const { error: sendErr } = await resend.emails.send({
      from: "Linestry <noreply@linestry.com>",
      to: ownerEmail,
      replyTo: EMAIL_REPLY_TO,
      headers: LIST_UNSUBSCRIBE_HEADERS,
      subject: "A tag against your timeline was declined",
      html: editorDeclineHtml({
        ownerName,
        categoryLabel,
      }),
      text: editorDeclineText({ ownerName, categoryLabel }),
    })
    if (sendErr) {
      console.error("[tag-decision-emails] Resend send rejected:", sendErr)
      return { sent: false, reason: "send_failed" }
    }
    return { sent: true }
  } catch (err) {
    console.error("[tag-decision-emails] Resend send failed:", err)
    return { sent: false, reason: "send_failed" }
  }
}

function editorDeclineHtml(args: { ownerName: string | null; categoryLabel: string }): string {
  const hello = args.ownerName ? `Hi ${escapeHtml(args.ownerName)},` : "Hi,"
  return `
    <div style="margin:0;padding:0;">
      ${emailHeaderHtml()}
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; margin: 0 auto; padding: 28px 28px 8px;">
        <p>${hello}</p>
        <p>A pending tag against your timeline was reviewed and declined. Category: <strong>${escapeHtml(args.categoryLabel)}</strong>.</p>
        <p>You can review your tag history any time at <a href="https://linestry.com/me/tags">linestry.com/me/tags</a>.</p>
        <p style="color: #666; font-size: 13px;">— the Linestry moderation team</p>
      </div>
      ${emailFooterHtml()}
    </div>
  `
}

function editorDeclineText(args: { ownerName: string | null; categoryLabel: string }): string {
  const hello = args.ownerName ? `Hi ${args.ownerName},` : "Hi,"
  return `${hello}\n\nA pending tag against your timeline was reviewed and declined. Category: ${args.categoryLabel}.\n\nYou can review your tag history any time at https://linestry.com/me/tags\n\nthe Linestry moderation team\n`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
