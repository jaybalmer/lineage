import { pluralize } from "@/lib/claim-request-helpers"
import { emailHeaderHtml, emailFooterHtml } from "@/lib/emails/shared-header"

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
  <div style="max-width:480px;margin:40px auto;background:#141414;border-radius:16px;border:1px solid #2a2a2a;overflow:hidden;">
    ${emailHeaderHtml()}
    <div style="padding:32px;">
      <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#e5e5e5;line-height:1.3;">
        ${headline}
      </h1>
      <div style="margin:0 0 28px;font-size:14px;color:#71717a;line-height:1.6;">
        ${body}
      </div>
      ${cta ? `<div style="text-align:center;">
        <a href="${cta.href}" style="display:inline-block;padding:14px 32px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:10px;font-size:15px;font-weight:600;">
          ${cta.label}
        </a>
      </div>` : ""}
    </div>
    ${emailFooterHtml()}
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

// PB-010 Phase 4a — the "claim your spot" email a public visitor gets after
// tapping "I was there" on someone's public timeline. The link signs them in;
// completing the claim (promoting the ghost into their new profile) is Phase 4b.
// No em dashes in the copy (standing rule).
export function claimYourSpotHtml(args: {
  ownerName: string
  momentLabel: string
  link: string
}): string {
  const safeOwner = escapeHtml(args.ownerName)
  const safeMoment = escapeHtml(args.momentLabel)
  return shell(
    `Claim your spot on ${safeOwner}'s timeline`,
    `<p style="margin:0 0 14px;">You marked that you were there: <strong style="color:#e5e5e5;">${safeMoment}</strong>.</p>
     <p style="margin:0 0 14px;">Confirm your email to claim your spot and start your own snowboarding timeline on Linestry. Your mark is held for 7 days.</p>
     <p style="margin:0;">If this wasn&rsquo;t you, you can safely ignore this email.</p>`,
    { label: "Claim your spot →", href: args.link },
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
    // The Resend SDK reports API-level rejections in the result object and
    // only throws on transport errors, so both paths are checked here.
    const { error: sendErr } = await resend.emails.send({
      from: "Linestry <noreply@linestry.com>",
      to: args.to,
      subject: args.subject,
      html: args.html,
    })
    if (sendErr) {
      console.error("[claim-emails] Resend send rejected:", sendErr)
    }
  } catch (err) {
    console.error("[claim-emails] Resend send failed:", err)
  }
}
