import { NextRequest, NextResponse } from "next/server"
import { emailHeaderHtml, emailFooterHtml } from "@/lib/emails/shared-header"
import { verifyUnsubscribeToken } from "@/lib/unsubscribe-token"
import { suppressEmail } from "@/lib/email-suppression"

// GET/POST /api/unsubscribe?e=<base64url-email>&t=<token>
//
// One-click List-Unsubscribe for the notification emails. The token is an HMAC
// over the address, so a link only ever unsubscribes the address it was minted
// for. No login by design: the email delivered to that address is the proof of
// ownership.
//   POST  - RFC 8058 one-click. Mail providers (Gmail, Apple Mail) POST here
//           directly; we suppress and return 200.
//   GET   - the human-visible link. Some clients open it in a browser; we apply
//           the same suppression and render a confirmation page.
// Applying on GET is safe: unsubscribing is reversible from the settings page,
// so an email scanner that fetches the link causes no lasting harm.

export const dynamic = "force-dynamic"

const BASE_URL = "https://linestry.com"

function decodeEmail(e: string): string {
  try {
    return Buffer.from(e, "base64url").toString("utf8")
  } catch {
    return ""
  }
}

async function apply(req: NextRequest): Promise<{ ok: boolean; email: string }> {
  const { searchParams } = new URL(req.url)
  const email = decodeEmail(searchParams.get("e") ?? "")
  const token = searchParams.get("t") ?? ""
  if (!email || !verifyUnsubscribeToken(email, token)) {
    return { ok: false, email: "" }
  }
  await suppressEmail(email, "one-click")
  return { ok: true, email }
}

// One-click POST: no body needed beyond List-Unsubscribe=One-Click, and mail
// providers do not follow redirects or render HTML, so a bare 200/400 is right.
export async function POST(req: NextRequest) {
  const { ok } = await apply(req)
  return new NextResponse(null, { status: ok ? 200 : 400 })
}

function page(title: string, bodyHtml: string, status: number): NextResponse {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="robots" content="noindex"/><title>${title}</title></head>
  <body style="margin:0;background:#f6f6f5;font-family:'Geologica',-apple-system,BlinkMacSystemFont,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;">
      ${emailHeaderHtml()}
      <div style="padding:28px;color:#1c1917;">${bodyHtml}</div>
      ${emailFooterHtml()}
    </div>
  </body></html>`
  return new NextResponse(html, { status, headers: { "Content-Type": "text/html; charset=utf-8" } })
}

export async function GET(req: NextRequest) {
  const { ok } = await apply(req)
  if (!ok) {
    return page(
      "Invalid link",
      `<p>This unsubscribe link is not valid. You can manage your emails from
        <a href="${BASE_URL}/me/settings/notifications" style="color:#2563eb;">your settings</a>.</p>`,
      400,
    )
  }
  return page(
    "Unsubscribed",
    `<p style="font-size:16px;"><strong>Done. You've been unsubscribed.</strong></p>
     <p style="color:#57534e;">You will no longer receive notification emails from Linestry at this address.</p>
     <p style="font-size:13px;color:#78716c;margin-top:18px;">Changed your mind? Manage your emails from
       <a href="${BASE_URL}/me/settings/notifications" style="color:#2563eb;text-decoration:none;">your settings</a>.</p>`,
    200,
  )
}
