function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

// ─── Tagged-you template ─────────────────────────────────────────────────────
// Relocated verbatim from /api/invite/route.ts as part of PB-008 Phase 2
// Session 4 (Item 1). Tone is the shipped tone — see plan: Option A.
// Signature unchanged: receives pre-escaped names. Callers escape at the call
// site so the subject line and body can share the escaped values.
//
// NB: the body says "rode with" literally. The /api/invite route accepts a
// predicate value and stores it on the invite row, but it's not threaded into
// the body copy today. Leaving as-is to preserve shipped tone.
export function inviteEmailHtml(inviterName: string, personName: string, link: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:480px;margin:40px auto;padding:32px;background:#141414;border-radius:16px;border:1px solid #2a2a2a;">
    <!-- Logo -->
    <div style="text-align:center;margin-bottom:28px;">
      <span style="font-size:28px;">⬡</span>
      <span style="display:block;font-size:13px;font-weight:600;letter-spacing:0.15em;color:#71717a;margin-top:4px;text-transform:uppercase;">Lineage</span>
    </div>
    <!-- Headline -->
    <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#e5e5e5;line-height:1.3;">
      ${inviterName} added you to their snowboard lineage
    </h1>
    <!-- Body -->
    <p style="margin:0 0 20px;font-size:14px;color:#71717a;line-height:1.6;">
      ${inviterName} says they rode with <strong style="color:#e5e5e5;">${personName}</strong> — that might be you.
      They&rsquo;ve added you to their timeline on Lineage, a snowboard history app for tracking your quiver, mountains, and crew.
    </p>
    <p style="margin:0 0 28px;font-size:14px;color:#71717a;line-height:1.6;">
      Claim your profile to verify the connection and start building your own lineage.
    </p>
    <!-- CTA -->
    <div style="text-align:center;margin-bottom:28px;">
      <a href="${link}" style="display:inline-block;padding:14px 32px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:10px;font-size:15px;font-weight:600;">
        Claim my profile →
      </a>
    </div>
    <!-- Fine print -->
    <p style="margin:0;font-size:11px;color:#3f3f46;text-align:center;line-height:1.5;">
      This link expires in 7 days. If you weren&rsquo;t expecting this, you can ignore it.
    </p>
  </div>
</body>
</html>`
}

// ─── Showing-up-more template ────────────────────────────────────────────────
// PB-008 Phase 2 Session 4 (Item 1). Fires from maybeFireThresholdNotification
// when the 3rd distinct member tags an unclaimed person. Sent to the
// inviter-of-record (people.invited_by) or, if null, the most-recent tagger.
// Closing line uses the polished phrasing approved in the plan.
export function showingUpMoreHtml(personName: string, profileLink: string): string {
  const safeName = escapeHtml(personName)
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:480px;margin:40px auto;padding:32px;background:#141414;border-radius:16px;border:1px solid #2a2a2a;">
    <!-- Logo -->
    <div style="text-align:center;margin-bottom:28px;">
      <span style="font-size:28px;">⬡</span>
      <span style="display:block;font-size:13px;font-weight:600;letter-spacing:0.15em;color:#71717a;margin-top:4px;text-transform:uppercase;">Lineage</span>
    </div>
    <!-- Headline -->
    <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#e5e5e5;line-height:1.3;">
      ${safeName} is showing up more on Lineage
    </h1>
    <!-- Body -->
    <p style="margin:0 0 20px;font-size:14px;color:#71717a;line-height:1.6;">
      A few different members have now tagged <strong style="color:#e5e5e5;">${safeName}</strong> on Lineage. They might want to know.
    </p>
    <p style="margin:0 0 28px;font-size:14px;color:#71717a;line-height:1.6;">
      If you have a way to reach them, it might be a good moment to send them in.
    </p>
    <!-- CTA -->
    <div style="text-align:center;margin-bottom:28px;">
      <a href="${profileLink}" style="display:inline-block;padding:14px 32px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:10px;font-size:15px;font-weight:600;">
        Open ${safeName}&rsquo;s profile →
      </a>
    </div>
    <!-- Fine print -->
    <p style="margin:0;font-size:11px;color:#3f3f46;text-align:center;line-height:1.5;">
      &mdash; Lineage
    </p>
  </div>
</body>
</html>`
}

// ─── Resend wrapper ──────────────────────────────────────────────────────────
// Mirrors sendClaimEmail in claim-emails.ts. Silent no-op when
// RESEND_API_KEY is unset (dev/preview). Never throws.
interface SendArgs {
  to: string
  subject: string
  html: string
}

// Returns true on send, false on no-op (missing key/recipient) or failure.
// The threshold-notification flow uses the return value to decide whether to
// insert the dedup row (only insert when the email actually went out).
export async function sendInviteEmail(args: SendArgs): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  if (!key || !args.to) return false
  try {
    const { Resend } = await import("resend")
    const resend = new Resend(key)
    await resend.emails.send({
      from: "Lineage <noreply@lineage.wtf>",
      to: args.to,
      subject: args.subject,
      html: args.html,
    })
    return true
  } catch (err) {
    console.error("[invite-emails] Resend send failed:", err)
    return false
  }
}
