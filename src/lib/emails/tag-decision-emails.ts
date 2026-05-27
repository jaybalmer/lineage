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

const NOTIFICATION_TYPE_EDITOR_DECLINE = "editor_decline"

interface FireEditorDeclineNotificationArgs {
  tagEventId: string
  ownerId: string
  decidedBy: string
  reasonCategory: TagEventDeclineCategory
}

/**
 * Idempotent: a duplicate insert on (tag_event_id, notification_type) makes
 * the email step a no-op. Resend send is fire-and-forget; failures are
 * logged but never thrown. Caller may safely await without a try/catch.
 */
export async function fireEditorDeclineNotification(
  supabase: SupabaseClient,
  args: FireEditorDeclineNotificationArgs,
): Promise<{ sent: boolean; reason?: string }> {
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

  // Look up owner email
  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("display_name, email")
    .eq("id", args.ownerId)
    .maybeSingle()
  const ownerEmail = (ownerProfile as { email?: string } | null)?.email
  if (!ownerEmail) {
    return { sent: false, reason: "no_owner_email" }
  }

  const key = process.env.RESEND_API_KEY
  if (!key) return { sent: false, reason: "no_resend_key" }

  try {
    const { Resend } = await import("resend")
    const resend = new Resend(key)
    const categoryLabel = labelForDeclineCategory(args.reasonCategory)
    await resend.emails.send({
      from: "Linestry <noreply@linestry.com>",
      to: ownerEmail,
      subject: "A tag against your timeline was declined",
      html: editorDeclineHtml({
        ownerName: (ownerProfile as { display_name?: string } | null)?.display_name ?? null,
        categoryLabel,
      }),
    })
    return { sent: true }
  } catch (err) {
    console.error("[tag-decision-emails] Resend send failed:", err)
    return { sent: false, reason: "send_failed" }
  }
}

function editorDeclineHtml(args: { ownerName: string | null; categoryLabel: string }): string {
  const hello = args.ownerName ? `Hi ${escapeHtml(args.ownerName)},` : "Hi,"
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; margin: 0 auto;">
      <p>${hello}</p>
      <p>A pending tag against your timeline was reviewed and declined. Category: <strong>${escapeHtml(args.categoryLabel)}</strong>.</p>
      <p>You can review your tag history any time at <a href="https://linestry.com/me/tags">linestry.com/me/tags</a>.</p>
      <p style="color: #666; font-size: 13px;">— the Linestry moderation team</p>
    </div>
  `
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
