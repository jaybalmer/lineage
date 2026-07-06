import { NextRequest, NextResponse } from "next/server"
import { requireAuth, getServiceClient } from "@/lib/auth"
import { emailHeaderHtml, emailFooterHtml, EMAIL_REPLY_TO, LIST_UNSUBSCRIBE_HEADERS } from "@/lib/emails/shared-header"

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

// ─── Email HTML ───────────────────────────────────────────────────────────────
// primaryLink is the "Claim my profile" CTA. When a magic link was minted it is
// the account-creating magic link (one click lands the invitee authenticated on
// their populated profile, no onboarding, no second email). If generateLink was
// unavailable it falls back to the plain /claim/[token] link. fallbackLink, when
// present, is the plain /claim/[token] link shown as a secondary "or claim your
// profile here" line so a late click past the short magic-link window still works.
function inviteEmailHtml(
  inviterName: string,
  personName: string,
  primaryLink: string,
  fallbackLink?: string,
): string {
  const fallbackBlock = fallbackLink
    ? `
    <p style="margin:0 0 8px;font-size:12px;color:#52525b;text-align:center;line-height:1.6;">
      Button not working, or opening this later? <a href="${fallbackLink}" style="color:#60a5fa;text-decoration:underline;">Claim your profile here</a>.
    </p>`
    : ""
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#141414;border-radius:16px;border:1px solid #2a2a2a;overflow:hidden;">
    ${emailHeaderHtml()}
    <div style="padding:32px;">
    <!-- Headline -->
    <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#e5e5e5;line-height:1.3;">
      ${inviterName} added you to their snowboard linestry
    </h1>
    <!-- Body -->
    <p style="margin:0 0 20px;font-size:14px;color:#71717a;line-height:1.6;">
      ${inviterName} says they rode with <strong style="color:#e5e5e5;">${personName}</strong> — that might be you.
      They&rsquo;ve added you to their timeline on Linestry, a snowboard history app for tracking your quiver, mountains, and crew.
    </p>
    <p style="margin:0 0 28px;font-size:14px;color:#71717a;line-height:1.6;">
      Claim your profile to verify the connection and start building your own linestry.
    </p>
    <!-- CTA -->
    <div style="text-align:center;margin-bottom:20px;">
      <a href="${primaryLink}" style="display:inline-block;padding:14px 32px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:10px;font-size:15px;font-weight:600;">
        Claim my profile →
      </a>
    </div>
    ${fallbackBlock}
    <!-- Fine print -->
    <p style="margin:16px 0 0;font-size:11px;color:#3f3f46;text-align:center;line-height:1.5;">
      The button above signs you in with one click and expires shortly. If you weren&rsquo;t expecting this, you can ignore it.
    </p>
    </div>
    ${emailFooterHtml()}
  </div>
</body>
</html>`
}

// ─── POST /api/invite ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { user, response: authResponse } = await requireAuth()
  if (authResponse) return authResponse

  try {
    const body = await req.json() as {
      person_id: string
      person_name: string
      inviter_name: string
      predicate: string
      email?: string
    }

    const { person_id, person_name, inviter_name, predicate, email } = body
    // Store the invite email lowercased so the verified-email claim lookups
    // (POST /api/invite/claim and /api/public/claim-complete) match reliably.
    const normalizedEmail = email?.trim().toLowerCase() || null

    if (!person_id) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Escape user-supplied names before using in HTML email
    const safeInviterName = escapeHtml(inviter_name || "Someone")
    const safePersonName = escapeHtml(person_name || "a rider")

    const token = crypto.randomUUID()
    const origin = req.headers.get("origin") || "https://linestry.com"
    const link = `${origin}/claim/${token}`

    // Insert invite record -- use authenticated user's ID
    const supabase = getServiceClient()
    const { error: insertError } = await supabase.from("invites").insert({
      id: token,
      person_id,
      invited_by: user.id,
      email: normalizedEmail,
      person_name,
      inviter_name,
      predicate,
    })

    if (insertError) {
      console.error("Invite insert error:", insertError)
      // Don't hard-fail — still return a usable link
    }

    // Update the person node with invite info and elevate to unclaimed if catalog
    try {
      const updateFields: Record<string, unknown> = {
        invited_by: user.id,
      }
      if (normalizedEmail) updateFields.invite_email = normalizedEmail
      // Elevate catalog → unclaimed (being invited means someone knows them)
      updateFields.node_status = "unclaimed"
      await supabase.from("people").update(updateFields).eq("id", person_id)
    } catch (updateErr) {
      console.error("Person update error:", updateErr)
    }

    // Send email via Resend (if API key is configured and email provided)
    const resendKey = process.env.RESEND_API_KEY
    if (normalizedEmail && resendKey) {
      try {
        // BUG-132: mint an account-creating magic link so the invitee clicks
        // once and lands authenticated on their populated profile (no onboarding
        // wizard, no SaveStep, no second "sign-in link" email). Mirrors the
        // PR #138 applyNodeInvite pattern. The verified-email fold-in at
        // /auth/complete needs no token in storage, so the click is the claim.
        // Fall back to the plain /claim/[token] link if generateLink is
        // unavailable, so the invite always works.
        let primaryLink = link
        let fallbackLink: string | undefined
        try {
          const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
            type: "magiclink",
            email: normalizedEmail,
            options: { redirectTo: `${origin}/auth/complete` },
          })
          const magicLink = linkData?.properties?.action_link
          if (!linkErr && magicLink) {
            primaryLink = magicLink
            fallbackLink = link // secondary "or claim your profile here" for late clicks
          } else {
            console.error("[invite] generateLink failed:", linkErr?.message ?? linkErr)
          }
        } catch (linkGenErr) {
          console.error("[invite] generateLink threw:", linkGenErr)
        }

        const { Resend } = await import("resend")
        const resend = new Resend(resendKey)
        const { error: sendError } = await resend.emails.send({
          from: "Linestry <noreply@linestry.com>",
          to: normalizedEmail,
          replyTo: EMAIL_REPLY_TO,
          headers: LIST_UNSUBSCRIBE_HEADERS,
          subject: `${safeInviterName} added you to their snowboard linestry`,
          html: inviteEmailHtml(safeInviterName, safePersonName, primaryLink, fallbackLink),
          // Plaintext alternative. Uses the raw (unescaped) names so entities
          // like &amp; do not show through in plain text. primaryLink is the
          // account-creating magic link (kept verbatim); fallbackLink, when set,
          // is the plain /claim link for a late click past the magic window.
          text: `${inviter_name || "Someone"} added you to their snowboard linestry on Linestry as ${person_name || "a rider"}.\n\nClaim your profile:\n${primaryLink}\n${fallbackLink ? `\nOpening this later? Use this link instead:\n${fallbackLink}\n` : ""}\nthe Linestry team\n`,
        })
        if (sendError) {
          console.error("Resend send rejected:", sendError)
        }
      } catch (emailErr) {
        console.error("Resend error:", emailErr)
        // Don't fail the request if email sending fails
      }
    }

    return NextResponse.json({ token, link })
  } catch (err) {
    console.error("Invite route error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
