import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { emailHeaderHtml, emailFooterHtml } from "@/lib/emails/shared-header"

// ─── Supabase admin client (service role required for generateLink) ───────────
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// ─── Email HTML ───────────────────────────────────────────────────────────────
function resetPasswordEmailHtml(link: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#141414;border-radius:16px;border:1px solid #2a2a2a;overflow:hidden;">
    ${emailHeaderHtml()}
    <div style="padding:36px 32px;">

    <!-- Headline -->
    <h1 style="margin:0 0 10px;font-size:22px;font-weight:700;color:#e5e5e5;line-height:1.3;text-align:center;">
      Reset your password
    </h1>
    <p style="margin:0 0 28px;font-size:14px;color:#71717a;line-height:1.6;text-align:center;">
      Click below to choose a new password for your Linestry account. This link expires in <strong style="color:#a1a1aa;">1 hour</strong>.
    </p>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:28px;">
      <a href="${link}"
        style="display:inline-block;padding:15px 36px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:10px;font-size:15px;font-weight:600;letter-spacing:0.01em;">
        Reset my password →
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
      If you didn&rsquo;t request this, you can safely ignore it. Your password will stay the same.
    </p>
    </div>
    ${emailFooterHtml()}
  </div>
</body>
</html>`
}

// ─── POST /api/auth/reset-password ────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json() as { email?: string }

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()
    const resendKey = process.env.RESEND_API_KEY

    // If either key is missing, tell the client to fall back to the built-in
    // resetPasswordForEmail. That path is non-enumerating (silent no-op for
    // unknown addresses), so returning-only behaviour is preserved without
    // this route's help.
    if (!supabaseAdmin || !resendKey) {
      return NextResponse.json({ fallback: true }, { status: 200 })
    }

    const normalizedEmail = email.trim().toLowerCase()

    // Generate the recovery link via Supabase admin API. redirectTo points to
    // /auth/reset-password, which handles the implicit-flow session hash and
    // then calls updateUser({ password }).
    const ALLOWED_ORIGINS = ["https://linestry.com", "https://lineage.wtf", "https://lineage.community", "http://localhost:3000"]
    const reqOrigin = req.headers.get("origin")
    const origin = reqOrigin && ALLOWED_ORIGINS.includes(reqOrigin) ? reqOrigin : "https://linestry.com"
    const { data, error: genError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: normalizedEmail,
      options: {
        redirectTo: `${origin}/auth/reset-password`,
      },
    })

    // generateLink type:recovery errors for an address with no account (it does
    // not create one, unlike type:magiclink). Treat any failure as a silent
    // fallback so we never leak whether an email is registered.
    if (genError || !data?.properties?.action_link) {
      return NextResponse.json({ fallback: true }, { status: 200 })
    }

    const recoveryLink = data.properties.action_link

    // Send via Resend
    const { Resend } = await import("resend")
    const resend = new Resend(resendKey)
    const { error: sendError } = await resend.emails.send({
      from: "Linestry <noreply@linestry.com>",
      to: normalizedEmail,
      subject: "Reset your Linestry password",
      html: resetPasswordEmailHtml(recoveryLink),
    })

    if (sendError) {
      console.error("Resend error:", sendError)
      return NextResponse.json({ fallback: true }, { status: 200 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("Reset password route error:", err)
    return NextResponse.json({ fallback: true }, { status: 200 })
  }
}
