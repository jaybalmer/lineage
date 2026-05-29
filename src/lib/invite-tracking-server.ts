import { createClient } from "@supabase/supabase-js"
import { emailHeaderHtml, emailFooterHtml } from "@/lib/emails/shared-header"

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Number of distinct taggers that must name an unclaimed person before the
 * ambient-growth notification fires. Mirrored from PB-008 Phase 2 Session 4
 * (Item 1). If raised, prior fires already in person_invite_notifications
 * remain — the UNIQUE dedup tuple prevents repeat sends.
 */
const TAGGER_THRESHOLD = 3

/**
 * Canonical value for person_invite_notifications.notification_type. Answers
 * open question 1 in the silent-failures brief: every threshold-cross row
 * uses this literal. Future notification surfaces (e.g. an "invitation_sent"
 * post-claim flow) get their own constants here.
 */
export const NOTIFICATION_TYPE_THRESHOLD = "threshold"

// ─── Types ────────────────────────────────────────────────────────────────────

interface DistinctTaggerSummary {
  distinct_count: number
  most_recent_actor: string | null
}

interface PersonRow {
  id: string
  display_name: string | null
  node_status: string | null
  invited_by: string | null
  invite_email: string | null
}

export type ThresholdFireResult =
  | { fired: true; recipient: string; count: number }
  | { fired: false; reason:
        | "person_not_found"
        | "not_unclaimed"
        | "rpc_error"
        | "below_threshold"
        | "no_inviter"
        | "no_recipient"
        | "already_fired"
        | "insert_error"
        | "exception"
    }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function thresholdEmailHtml(personName: string, count: number): string {
  const safe = escapeHtml(personName)
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#141414;border-radius:16px;border:1px solid #2a2a2a;overflow:hidden;">
    ${emailHeaderHtml()}
    <div style="padding:32px;">
    <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#e5e5e5;line-height:1.3;">
      ${safe} is showing up more on Linestry
    </h1>
    <p style="margin:0 0 20px;font-size:14px;color:#71717a;line-height:1.6;">
      ${count} different riders have now tagged <strong style="color:#e5e5e5;">${safe}</strong> in their snowboarding timelines.
      You added them, so we wanted to let you know the community is starting to recognize the connection.
    </p>
    <p style="margin:0 0 28px;font-size:14px;color:#71717a;line-height:1.6;">
      If that’s actually you, claim the profile to take ownership of the history people are writing together.
    </p>
    <div style="text-align:center;margin-bottom:28px;">
      <a href="https://linestry.com" style="display:inline-block;padding:14px 32px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:10px;font-size:15px;font-weight:600;">
        Open Linestry →
      </a>
    </div>
    <p style="margin:0;font-size:11px;color:#3f3f46;text-align:center;line-height:1.5;">
      You’re the inviter-of-record for this profile. We only send this once per threshold per inviter.
    </p>
    </div>
    ${emailFooterHtml()}
  </div>
</body>
</html>`
}

async function sendThresholdEmail(args: { to: string; personName: string; count: number }) {
  const key = process.env.RESEND_API_KEY
  if (!key || !args.to) return
  try {
    const { Resend } = await import("resend")
    const resend = new Resend(key)
    await resend.emails.send({
      from: "Linestry <noreply@linestry.com>",
      to: args.to,
      subject: `${args.personName} is showing up more on Linestry`,
      html: thresholdEmailHtml(args.personName, args.count),
    })
  } catch (err) {
    console.error("[invite-tracking] Resend send failed:", err)
  }
}

// ─── Core ─────────────────────────────────────────────────────────────────────

/**
 * Check whether tagging `personId` has just crossed the distinct-tagger
 * threshold, and if so, insert the dedup row and fire the Resend email.
 *
 * Idempotent: the UNIQUE constraint on (person_id, inviter_id,
 * notification_type) is the source of truth. A duplicate insert returns
 * { fired: false, reason: "already_fired" } without sending another email.
 *
 * Resolution order for `inviter_id`:
 *   1. people.invited_by (the canonical inviter, set by /api/invite or the
 *      claim/onboarding flow)
 *   2. distinct_tagger_summary.most_recent_actor (fallback when no one was
 *      explicitly named as the inviter — gives the credit to whoever just
 *      tipped the count over)
 *
 * Resolution order for the recipient email (answers open question 2 in the
 * brief):
 *   1. auth.users.email for the resolved inviter_id (preferred — it’s the
 *      account we know belongs to a real human)
 *   2. people.invite_email (fallback when the inviter has no auth user, e.g.
 *      a system-imported claim)
 */
export async function maybeFireThresholdNotification(personId: string): Promise<ThresholdFireResult> {
  const supabase = getServiceClient()

  const { data: personRow, error: personErr } = await supabase
    .from("people")
    .select("id, display_name, node_status, invited_by, invite_email")
    .eq("id", personId)
    .maybeSingle<PersonRow>()
  if (personErr) {
    console.error("[invite-tracking] people lookup error:", personErr)
    return { fired: false, reason: "person_not_found" }
  }
  if (!personRow) return { fired: false, reason: "person_not_found" }
  if (personRow.node_status !== "unclaimed") return { fired: false, reason: "not_unclaimed" }

  const { data: summary, error: rpcErr } = await supabase
    .rpc("distinct_tagger_summary", { p_person_id: personId })
  if (rpcErr) {
    console.error("[invite-tracking] distinct_tagger_summary RPC error:", rpcErr)
    return { fired: false, reason: "rpc_error" }
  }
  const s = summary as DistinctTaggerSummary | null
  if (!s || s.distinct_count < TAGGER_THRESHOLD) {
    return { fired: false, reason: "below_threshold" }
  }

  const inviterId = personRow.invited_by ?? s.most_recent_actor
  if (!inviterId) return { fired: false, reason: "no_inviter" }

  let recipientEmail: string | null = null
  try {
    const { data: inviterUser } = await supabase.auth.admin.getUserById(inviterId)
    if (inviterUser?.user?.email) recipientEmail = inviterUser.user.email
  } catch (err) {
    console.error("[invite-tracking] auth.admin.getUserById error:", err)
  }
  if (!recipientEmail && personRow.invite_email) recipientEmail = personRow.invite_email
  if (!recipientEmail) return { fired: false, reason: "no_recipient" }

  const { error: insertErr } = await supabase
    .from("person_invite_notifications")
    .insert({
      person_id: personId,
      inviter_id: inviterId,
      notification_type: NOTIFICATION_TYPE_THRESHOLD,
      distinct_tagger_count_at_send: s.distinct_count,
    })
  if (insertErr) {
    const code = (insertErr as { code?: string }).code
    if (code === "23505") return { fired: false, reason: "already_fired" }
    console.error("[invite-tracking] person_invite_notifications insert error:", insertErr)
    return { fired: false, reason: "insert_error" }
  }

  await sendThresholdEmail({
    to: recipientEmail,
    personName: personRow.display_name ?? "Someone",
    count: s.distinct_count,
  })

  return { fired: true, recipient: recipientEmail, count: s.distinct_count }
}

/**
 * Run maybeFireThresholdNotification for every person id in the batch, in
 * parallel. De-dupes the input so a single payload that names the same ghost
 * twice doesn’t double-check. Swallows per-person exceptions so a single
 * failure doesn’t stop the rest.
 *
 * `asserterUserId` is accepted for symmetry with the client-side call shape
 * (and future telemetry); the threshold count itself already excludes self-
 * tags inside distinct_tagger_summary.
 */
export async function fireTagEvents(
  personIds: string[],
  asserterUserId: string  // eslint-disable-line @typescript-eslint/no-unused-vars
): Promise<ThresholdFireResult[]> {
  const unique = Array.from(new Set(personIds.filter(Boolean)))
  return Promise.all(
    unique.map((pid) =>
      maybeFireThresholdNotification(pid).catch((e): ThresholdFireResult => {
        console.error(`[invite-tracking] tag event failed for ${pid}:`, e)
        return { fired: false, reason: "exception" }
      })
    )
  )
}
