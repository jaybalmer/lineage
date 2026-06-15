import { NextRequest, NextResponse } from "next/server"
import { getServiceClient } from "@/lib/auth"
import { emailHeaderHtml, emailFooterHtml } from "@/lib/emails/shared-header"
import {
  type CommentEmailPref,
  COMMENT_EMAIL_PREF_META,
  isCommentEmailPref,
} from "@/lib/comment-email-prefs"
import { signEmailPrefToken, verifyEmailPrefToken } from "@/lib/email-pref-token"

// GET /api/notifications/email-pref?u=<userId>&pref=<pref>&t=<token>
//
// One-click cadence change from a comment email's footer. The token is signed
// for (userId, pref), so a link only ever changes that account to that value.
// GET-applies for true one-click; every change is reversible from the buttons
// on the result page or the settings page, so an email scanner that fetches a
// link causes no lasting harm. No login required by design (the email itself
// is the proof of address ownership).

export const dynamic = "force-dynamic"

const BASE_URL = "https://linestry.com"

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

function otherOptionsHtml(userId: string, current: CommentEmailPref): string {
  const others: CommentEmailPref[] = (["smart", "daily", "6h", "off"] as CommentEmailPref[]).filter(
    (p) => p !== current,
  )
  const links = others
    .map((p) => {
      const href = `${BASE_URL}/api/notifications/email-pref?u=${userId}&pref=${p}&t=${signEmailPrefToken(userId, p)}`
      return `<a href="${href}" style="color:#2563eb;text-decoration:none;">${COMMENT_EMAIL_PREF_META[p].label}</a>`
    })
    .join(" &nbsp;&middot;&nbsp; ")
  return `<p style="font-size:13px;color:#78716c;margin-top:18px;">Prefer something else? ${links}
    &nbsp;&middot;&nbsp; <a href="${BASE_URL}/me/settings/notifications" style="color:#2563eb;text-decoration:none;">All settings</a></p>`
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get("u") ?? ""
  const pref = searchParams.get("pref") ?? ""

  if (!userId || !isCommentEmailPref(pref)) {
    return page("Invalid link", `<p>This link is not valid. You can manage your comment emails from
      <a href="${BASE_URL}/me/settings/notifications" style="color:#2563eb;">your settings</a>.</p>`, 400)
  }
  if (!verifyEmailPrefToken(userId, pref, searchParams.get("t") ?? "")) {
    return page("Invalid link", `<p>This link is not valid or has expired. You can manage your comment emails from
      <a href="${BASE_URL}/me/settings/notifications" style="color:#2563eb;">your settings</a>.</p>`, 400)
  }

  const db = getServiceClient()
  const { error } = await db
    .from("profiles")
    .update({ comment_email_pref: pref })
    .eq("id", userId)
  if (error) {
    return page("Something went wrong", `<p>We couldn't update your setting just now. Please try from
      <a href="${BASE_URL}/me/settings/notifications" style="color:#2563eb;">your settings</a>.</p>`, 500)
  }

  const meta = COMMENT_EMAIL_PREF_META[pref]
  const done = pref === "off"
    ? `<p style="font-size:16px;"><strong>Done. Comment emails are off.</strong></p>
       <p style="color:#57534e;">${meta.blurb}</p>`
    : `<p style="font-size:16px;"><strong>Done. You're now on ${meta.label}.</strong></p>
       <p style="color:#57534e;">${meta.blurb}</p>`
  return page("Updated", done + otherOptionsHtml(userId, pref), 200)
}
