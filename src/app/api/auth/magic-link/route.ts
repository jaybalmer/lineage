import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { emailHeaderHtml, emailFooterHtml, EMAIL_REPLY_TO } from "@/lib/emails/shared-header"
import { safeReturnTo } from "@/lib/safe-redirect"

// ─── Supabase admin client (service role required for generateLink) ───────────
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// ─── Email HTML ───────────────────────────────────────────────────────────────
function magicLinkEmailHtml(link: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#141414;border-radius:16px;border:1px solid #2a2a2a;overflow:hidden;">
    ${emailHeaderHtml()}
    <div style="padding:36px 32px;">

    <!-- Headline -->
    <h1 style="margin:0 0 10px;font-size:22px;font-weight:700;color:#e5e5e5;line-height:1.3;text-align:center;">
      Your sign-in link
    </h1>
    <p style="margin:0 0 28px;font-size:14px;color:#71717a;line-height:1.6;text-align:center;">
      Click below to sign in to Linestry. This link expires in <strong style="color:#a1a1aa;">1 hour</strong>.
    </p>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:28px;">
      <a href="${link}"
        style="display:inline-block;padding:15px 36px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:10px;font-size:15px;font-weight:600;letter-spacing:0.01em;">
        Sign in to Linestry →
      </a>
    </div>

    <!-- Divider -->
    <div style="border-top:1px solid #2a2a2a;margin:24px 0;"></div>

    <!-- Link fallback -->
    <p style="margin:0 0 8px;font-size:11px;color:#52525b;text-align:center;">
      Button not working? Copy this link into your browser:
    </p>
    <p style="margin:0 0 20px;font-size:10px;color:#3f3f46;text-align:center;word-break:break-all;">
      ${link}
    </p>

    <!-- Fine print -->
    <p style="margin:0;font-size:11px;color:#3f3f46;text-align:center;line-height:1.5;">
      If you didn&rsquo;t request this, you can safely ignore it. Your account is secure.
    </p>
    </div>
    ${emailFooterHtml()}
  </div>
</body>
</html>`
}

// ─── POST /api/auth/magic-link ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { email, intent, returnTo, onboarding } = await req.json() as {
      email?: string
      intent?: "signin" | "signup"
      returnTo?: string
      // BUG-115 / BUG-116: onboarding picks (name + FTUE claims) carried from the
      // client so they survive a magic link opened in a fresh context.
      onboarding?: Record<string, unknown>
    }

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 })
    }

    // BUG-054: validated internal path to return to after the magic-link login.
    const safeReturn = safeReturnTo(returnTo)

    const supabaseAdmin = getSupabaseAdmin()
    const resendKey = process.env.RESEND_API_KEY

    // If either key is missing, tell the client to fall back to signInWithOtp.
    // The signin surface passes shouldCreateUser:false there, so returning-only
    // is still enforced on the fallback path without this route's help.
    if (!supabaseAdmin || !resendKey) {
      return NextResponse.json({ fallback: true }, { status: 200 })
    }

    const normalizedEmail = email.trim().toLowerCase()

    // Sign-in surface: only send a link to an address that already has an
    // account. admin.generateLink below CREATES the user when absent, so absent
    // this guard a typo on a returning-user path would silently provision a new
    // account. Signup keeps create-on-send by omitting intent (or "signup").
    if (intent === "signin") {
      let exists = false
      for (let page = 1; page <= 50; page++) {
        const { data: list, error: listErr } =
          await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 })
        if (listErr) {
          // Can't confirm existence, so fall back to client OTP, which enforces
          // shouldCreateUser:false itself rather than risk creating an account.
          console.error("listUsers error:", listErr)
          return NextResponse.json({ fallback: true }, { status: 200 })
        }
        if (list.users.some((u) => u.email?.toLowerCase() === normalizedEmail)) {
          exists = true
          break
        }
        if (list.users.length < 1000) break
      }
      if (!exists) {
        return NextResponse.json(
          { error: "We could not find an account with that email." },
          { status: 200 }
        )
      }
    }

    // Generate the magic link via Supabase admin API
    // redirectTo must point to /auth/complete so the session hash is handled correctly
    const ALLOWED_ORIGINS = ["https://linestry.com", "https://lineage.wtf", "https://lineage.community", "http://localhost:3000"]
    const reqOrigin = req.headers.get("origin")
    const origin = reqOrigin && ALLOWED_ORIGINS.includes(reqOrigin) ? reqOrigin : "https://linestry.com"
    const completeRedirect = `${origin}/auth/complete${safeReturn ? `?returnTo=${encodeURIComponent(safeReturn)}` : ""}`
    const { data, error: genError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: normalizedEmail,
      options: {
        redirectTo: completeRedirect,
      },
    })

    if (genError || !data?.properties?.action_link) {
      console.error("generateLink error:", genError)
      return NextResponse.json({ fallback: true }, { status: 200 })
    }

    const magicLink = data.properties.action_link

    // BUG-115 / BUG-116: stash the onboarding payload on the auth user so
    // /auth/complete can restore the typed name and the FTUE claims when the
    // link opens in a context that does not share the originating localStorage
    // (the iOS Mail default). generateLink creates the user when absent, so
    // data.user is the freshly provisioned signup account. Only signup carries a
    // payload; sign-in posts none, so returning users are untouched.
    const stashUserId = data.user?.id
    if (stashUserId && onboarding && typeof onboarding === "object") {
      const { error: metaErr } = await supabaseAdmin.auth.admin.updateUserById(
        stashUserId,
        { user_metadata: { pending_onboarding: onboarding } }
      )
      if (metaErr) console.error("stash onboarding metadata error:", metaErr)
    }

    // Send via Resend
    const { Resend } = await import("resend")
    const resend = new Resend(resendKey)
    const { error: sendError } = await resend.emails.send({
      from: "Linestry <noreply@linestry.com>",
      to: email.trim().toLowerCase(),
      replyTo: EMAIL_REPLY_TO,
      subject: "Your Linestry sign-in link",
      html: magicLinkEmailHtml(magicLink),
      // Plaintext alternative. The link is a long tokened URL: keep it verbatim
      // so it still works pasted from the text part (do not add query params
      // the quoted-printable layer could corrupt).
      text: `Sign in to Linestry.\n\nOpen this link to sign in:\n${magicLink}\n\nIf you did not request this, you can ignore this email.\n\nthe Linestry team\n`,
    })

    if (sendError) {
      console.error("Resend error:", sendError)
      return NextResponse.json({ fallback: true }, { status: 200 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("Magic link route error:", err)
    return NextResponse.json({ fallback: true }, { status: 200 })
  }
}
