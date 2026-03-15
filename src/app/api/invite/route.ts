import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// ─── Supabase admin client (service role bypasses RLS) ───────────────────────
// Falls back to anon key if service role key not configured yet
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key)
}

// ─── Email HTML ───────────────────────────────────────────────────────────────
function inviteEmailHtml(inviterName: string, personName: string, link: string): string {
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

// ─── POST /api/invite ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      person_id: string
      person_name: string
      invited_by: string
      inviter_name: string
      predicate: string
      email?: string
    }

    const { person_id, person_name, invited_by, inviter_name, predicate, email } = body

    if (!person_id || !invited_by) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const token = crypto.randomUUID()
    const origin = req.headers.get("origin") || "https://lineage.wtf"
    const link = `${origin}/claim/${token}`

    // Insert invite record
    const supabase = getSupabaseAdmin()
    const { error: insertError } = await supabase.from("invites").insert({
      id: token,
      person_id,
      invited_by,
      email: email ?? null,
      person_name,
      inviter_name,
      predicate,
    })

    if (insertError) {
      console.error("Invite insert error:", insertError)
      // Don't hard-fail — still return a usable link
    }

    // Send email via Resend (if API key is configured and email provided)
    const resendKey = process.env.RESEND_API_KEY
    if (email && resendKey) {
      try {
        const { Resend } = await import("resend")
        const resend = new Resend(resendKey)
        await resend.emails.send({
          from: "Lineage <noreply@lineage.wtf>",
          to: email,
          subject: `${inviter_name} added you to their snowboard lineage`,
          html: inviteEmailHtml(inviter_name, person_name, link),
        })
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
