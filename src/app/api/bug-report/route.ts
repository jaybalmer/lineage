import { NextRequest, NextResponse } from "next/server"
import { getServiceClient, ensureProfile } from "@/lib/auth"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { emailHeaderHtml, emailFooterHtml } from "@/lib/emails/shared-header"

// POST /api/bug-report
//
// In-app bug widget intake. Two things happen on submit:
//   1. Persist a bug_reports row (durable record, future de-dup).
//   2. Send a structured [Linestry Bug] email to the triage inbox so the existing
//      Gmail-to-Drive bridge and daily triage pick it up with no changes.
//
// Auth is OPTIONAL: signed-in reporters are identified from their session (never
// the payload, so it cannot be spoofed), and logged-out visitors can still report
// browsing bugs (reporter_id null). Because this is a public, unauthenticated,
// email-sending endpoint, every text field is length-capped server-side. Add real
// rate limiting before relying on it at launch scale.
//
// The subject MUST keep the exact "[Linestry Bug]" prefix: the whole downstream
// pipeline keys on it.

interface BugReportPayload {
  note?: unknown
  expected?: unknown
  url?: unknown
  viewport?: unknown
  userAgent?: unknown
  posthogSessionUrl?: unknown
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : ""
}

function cap(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) : s
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function metaRow(label: string, value: string): string {
  return `
        <tr>
          <td style="padding:6px 0;font-size:12px;color:#71717a;width:120px;vertical-align:top;">${label}</td>
          <td style="padding:6px 0;font-size:12px;color:#e5e5e5;word-break:break-word;">${value}</td>
        </tr>`
}

function bugReportEmailHtml(p: {
  note: string
  expected: string
  url: string
  reportedBy: string
  timestamp: string
  viewport: string
  userAgent: string
  posthogSessionUrl: string | null
}): string {
  const noteHtml = esc(p.note).replace(/\n/g, "<br>")
  const expectedBlock = p.expected
    ? `
      <p style="margin:18px 0 6px;font-size:12px;font-weight:600;color:#a1a1aa;">What they expected</p>
      <p style="margin:0;font-size:14px;color:#e5e5e5;line-height:1.6;">${esc(p.expected).replace(/\n/g, "<br>")}</p>`
    : ""
  const pageRow = p.url
    ? metaRow("Page URL", `<a href="${esc(p.url)}" style="color:#60a5fa;text-decoration:none;word-break:break-all;">${esc(p.url)}</a>`)
    : metaRow("Page URL", `<span style="color:#52525b;">unknown</span>`)
  const replayRow = p.posthogSessionUrl
    ? metaRow("Session replay", `<a href="${esc(p.posthogSessionUrl)}" style="color:#60a5fa;text-decoration:none;word-break:break-all;">Open session replay</a>`)
    : metaRow("Session replay", `<span style="color:#52525b;">Not available</span>`)

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#141414;border-radius:16px;border:1px solid #2a2a2a;overflow:hidden;">
    ${emailHeaderHtml()}
    <div style="padding:32px;">
      <h1 style="margin:0 0 4px;font-size:20px;font-weight:700;color:#e5e5e5;">New bug report</h1>
      <p style="margin:0 0 20px;font-size:13px;color:#71717a;">Submitted from inside Linestry.</p>

      <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#a1a1aa;">What happened</p>
      <p style="margin:0;font-size:14px;color:#e5e5e5;line-height:1.6;">${noteHtml}</p>
      ${expectedBlock}

      <div style="border-top:1px solid #2a2a2a;margin:24px 0 8px;"></div>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">${pageRow}${metaRow("Reported by", esc(p.reportedBy))}${metaRow("Timestamp", esc(p.timestamp))}${metaRow("Viewport", esc(p.viewport || "unknown"))}${metaRow("Browser", esc(p.userAgent || "unknown"))}${replayRow}
      </table>
    </div>
    ${emailFooterHtml()}
  </div>
</body>
</html>`
}

export async function POST(req: NextRequest) {
  // 1) Optional auth: capture identity when signed in, but allow anonymous reports
  // so logged-out visitors can flag browsing bugs. We never 401 here.
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  let body: BugReportPayload
  try {
    body = (await req.json()) as BugReportPayload
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  // Length-cap every field: this endpoint is reachable unauthenticated.
  const note = cap(asString(body.note).trim(), 10000)
  if (!note) {
    return NextResponse.json({ error: "A description is required" }, { status: 400 })
  }

  const expected = cap(asString(body.expected).trim(), 5000)
  const url = cap(asString(body.url).trim(), 2000)
  const viewport = cap(asString(body.viewport).trim(), 32)
  const userAgent = cap(asString(body.userAgent).trim(), 1024)
  const posthogSessionUrl = cap(asString(body.posthogSessionUrl).trim(), 2000) || null
  const reporterId = user?.id ?? null
  const reporterEmail = user?.email ?? null
  const reportedBy = user ? (reporterEmail ?? `signed-in user ${user.id}`) : "Anonymous (logged out)"
  const timestamp = new Date().toISOString()

  // A signed-in reporter needs a profiles row (reporter_id FK target). Anonymous
  // reports leave reporter_id null.
  if (user) {
    await ensureProfile(user.id, user.email)
  }

  // 2) Persist the durable row (service role, bypasses RLS like other mutations).
  const db = getServiceClient()
  const { error: insertError } = await db.from("bug_reports").insert({
    reporter_id: reporterId,
    reporter_email: reporterEmail,
    note,
    expected: expected || null,
    url: url || null,
    viewport: viewport || null,
    user_agent: userAgent || null,
    posthog_session_url: posthogSessionUrl,
  })
  if (insertError) {
    console.error("bug-report insert failed:", insertError)
    return NextResponse.json({ error: "Could not save report" }, { status: 500 })
  }

  // 3) Email the triage inbox. Best effort: the row is already saved, so a missing
  // key or a Resend hiccup must not fail the request (avoids duplicate rows on a
  // user retry). Local dev without RESEND_API_KEY still returns ok.
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    console.warn("bug-report: RESEND_API_KEY absent, row saved without triage email")
    return NextResponse.json({ ok: true })
  }

  try {
    const firstLine = (note.split("\n")[0] || note).slice(0, 60)
    const { Resend } = await import("resend")
    const resend = new Resend(resendKey)
    const { error: sendError } = await resend.emails.send({
      from: "Linestry <noreply@linestry.com>",
      to: "jay@lineage.community",
      subject: `[Linestry Bug] ${firstLine}`,
      html: bugReportEmailHtml({
        note,
        expected,
        url,
        reportedBy,
        timestamp,
        viewport,
        userAgent,
        posthogSessionUrl,
      }),
    })
    if (sendError) {
      console.error("bug-report Resend error:", sendError)
    }
  } catch (err) {
    console.error("bug-report email threw:", err)
  }

  return NextResponse.json({ ok: true })
}
