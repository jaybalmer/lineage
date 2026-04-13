import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

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
  <div style="max-width:480px;margin:40px auto;padding:36px 32px;background:#141414;border-radius:16px;border:1px solid #2a2a2a;">

    <!-- Logo -->
    <div style="text-align:center;margin-bottom:32px;">
      <span style="font-size:32px;line-height:1;">⬡</span>
      <div style="font-size:11px;font-weight:700;letter-spacing:0.25em;color:#3b82f6;margin-top:6px;text-transform:uppercase;">Lineage</div>
    </div>

    <!-- Headline -->
    <h1 style="margin:0 0 10px;font-size:22px;font-weight:700;color:#e5e5e5;line-height:1.3;text-align:center;">
      Your sign-in link
    </h1>
    <p style="margin:0 0 28px;font-size:14px;color:#71717a;line-height:1.6;text-align:center;">
      Click below to sign in to Lineage. This link expires in <strong style="color:#a1a1aa;">1 hour</strong>.
    </p>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:28px;">
      <a href="${link}"
        style="display:inline-block;padding:15px 36px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:10px;font-size:15px;font-weight:600;letter-spacing:0.01em;">
        Sign in to Lineage →
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
      If you didn&rsquo;t request this, you can safely ignore it — your account is secure.
    </p>
  </div>
</body>
</html>`
}

// ─── POST /api/auth/magic-link ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json() as { email?: string }

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()
    const resendKey = process.env.RESEND_API_KEY

    // If either key is missing, tell the client to fall back to signInWithOtp
    if (!supabaseAdmin || !resendKey) {
      return NextResponse.json({ fallback: true }, { status: 200 })
    }

    // Generate the magic link via Supabase admin API
    // redirectTo must point to /auth/complete so the session hash is handled correctly
    const ALLOWED_ORIGINS = ["https://lineage.wtf", "https://lineage.community", "http://localhost:3000"]
    const reqOrigin = req.headers.get("origin")
    const origin = reqOrigin && ALLOWED_ORIGINS.includes(reqOrigin) ? reqOrigin : "https://lineage.wtf"
    const { data, error: genError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: email.trim().toLowerCase(),
      options: {
        redirectTo: `${origin}/auth/complete`,
      },
    })

    if (genError || !data?.properties?.action_link) {
      console.error("generateLink error:", genError)
      return NextResponse.json({ fallback: true }, { status: 200 })
    }

    const magicLink = data.properties.action_link

    // Send via Resend
    const { Resend } = await import("resend")
    const resend = new Resend(resendKey)
    const { error: sendError } = await resend.emails.send({
      from: "Lineage <noreply@lineage.wtf>",
      to: email.trim().toLowerCase(),
      subject: "Your Lineage sign-in link",
      html: magicLinkEmailHtml(magicLink),
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
