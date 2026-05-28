import { pluralize } from "@/lib/claim-request-helpers"

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function shell(headline: string, body: string, cta?: { label: string; href: string }): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:480px;margin:40px auto;padding:32px;background:#141414;border-radius:16px;border:1px solid #2a2a2a;">
    <div style="text-align:center;margin-bottom:28px;">
      <span style="font-size:28px;">⬡</span>
      <span style="display:block;font-size:13px;font-weight:600;letter-spacing:0.15em;color:#71717a;margin-top:4px;text-transform:uppercase;">Linestry</span>
    </div>
    <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#e5e5e5;line-height:1.3;">
      ${headline}
    </h1>
    <div style="margin:0 0 28px;font-size:14px;color:#71717a;line-height:1.6;">
      ${body}
    </div>
    ${cta ? `<div style="text-align:center;margin-bottom:28px;">
      <a href="${cta.href}" style="display:inline-block;padding:14px 32px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:10px;font-size:15px;font-weight:600;">
        ${cta.label}
      </a>
    </div>` : ""}
    <p style="margin:0;font-size:11px;color:#3f3f46;text-align:center;line-height:1.5;">
      &mdash; Linestry
    </p>
  </div>
</body>
</html>`
}

export function claimSubmittedHtml(personName: string, vouchesRequired: number): string {
  const safeName = escapeHtml(personName)
  const vouchWord = pluralize(vouchesRequired, "vouch", "vouches")
  return shell(
    `Your claim on ${safeName}`,
    `<p style="margin:0 0 14px;">We received your request to claim <strong style="color:#e5e5e5;">${safeName}</strong> on Linestry.</p>
     <p style="margin:0;">Other members can vouch for you on the profile. ${vouchesRequired} ${vouchWord} from people who know you will move this forward. We&rsquo;ll email when something changes.</p>`,
  )
}

export function claimVouchedHtml(personName: string, vouchesRequired: number): string {
  const safeName = escapeHtml(personName)
  const vouchWord = pluralize(vouchesRequired, "vouch", "vouches")
  return shell(
    `Your claim on ${safeName} is ready for review`,
    `<p style="margin:0;">Your claim on <strong style="color:#e5e5e5;">${safeName}</strong> has the ${vouchesRequired} ${vouchWord} it needs. An editor will review it soon.</p>`,
  )
}

export function claimApprovedHtml(personName: string, profileLink: string): string {
  const safeName = escapeHtml(personName)
  return shell(
    `Your claim was approved`,
    `<p style="margin:0 0 14px;">Your claim on <strong style="color:#e5e5e5;">${safeName}</strong> was approved. The profile is yours.</p>
     <p style="margin:0;">Start adding your timeline.</p>`,
    { label: "Open my profile →", href: profileLink },
  )
}

export function claimDeniedHtml(personName: string, editorNotes: string | null): string {
  const safeName = escapeHtml(personName)
  const notesBlock = editorNotes
    ? `<p style="margin:0 0 14px;">Editor notes: ${escapeHtml(editorNotes)}</p>`
    : ""
  return shell(
    `About your claim on ${safeName}`,
    `<p style="margin:0 0 14px;">We weren&rsquo;t able to approve your claim on <strong style="color:#e5e5e5;">${safeName}</strong>.</p>
     ${notesBlock}
     <p style="margin:0;">Email <a href="mailto:jay@lineage.community" style="color:#60a5fa;text-decoration:none;">jay@lineage.community</a> if you&rsquo;d like to share more context.</p>`,
  )
}

interface SendArgs {
  to: string
  subject: string
  html: string
}

/**
 * Fire a transactional email via Resend. Silently no-ops when RESEND_API_KEY
 * is not configured (dev/preview); never throws so it can be called inline
 * from API routes without a try/catch wrapper.
 */
export async function sendClaimEmail(args: SendArgs): Promise<void> {
  const key = process.env.RESEND_API_KEY
  if (!key || !args.to) return
  try {
    const { Resend } = await import("resend")
    const resend = new Resend(key)
    await resend.emails.send({
      from: "Linestry <noreply@linestry.com>",
      to: args.to,
      subject: args.subject,
      html: args.html,
    })
  } catch (err) {
    console.error("[claim-emails] Resend send failed:", err)
  }
}
