import { NextRequest, NextResponse } from "next/server"
import { getServiceClient, ensureProfile } from "@/lib/auth"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { emailHeaderHtml, emailFooterHtml, EMAIL_REPLY_TO } from "@/lib/emails/shared-header"

// POST /api/bug-report  (multipart/form-data)
//
// In-app bug widget intake. On submit:
//   1. Persist a bug_reports row (durable record, future de-dup).
//   2. Send a structured [Linestry Bug] email to the triage inbox. An optional
//      screenshot rides along as an email attachment, so the existing
//      Gmail-to-Drive bridge files it into the "Linestry Bug Attachments" Drive
//      folder that daily triage already reviews. No new storage to maintain.
//
// Auth is OPTIONAL: signed-in reporters are identified from their session (never
// the payload, so it cannot be spoofed), and logged-out visitors can still report
// browsing bugs (reporter_id null). Because this is a public, unauthenticated,
// email-sending endpoint, every text field is length-capped and the image is
// type/size-checked server-side. Add real rate limiting before launch scale.
//
// The subject MUST keep the exact "[Linestry Bug]" prefix: the whole downstream
// pipeline (bridge + triage) keys on it.

const MAX_IMAGE_BYTES = 8 * 1024 * 1024 // 8 MB ceiling (client compresses well below)
const IMAGE_MIME_EXT: Record<string, string> = {
  "image/png":  "png",
  "image/jpeg": "jpg",
  "image/jpg":  "jpg",
  "image/webp": "webp",
  "image/gif":  "gif",
}

function asString(v: FormDataEntryValue | null): string {
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

// The replay session id and t offset as plain text. Email encoding has
// garbled the ?t= anchor inside the href before (June 10 triage run), so the
// values must also exist OUTSIDE any link. The text deliberately contains no
// "=" character: quoted-printable transit eats "=" followed by hex-looking
// digits (observed live: "t=1607s" arrived as "t\x1607s"), which is the exact
// failure this row exists to survive. Returns null when the URL has no
// recognizable /replay/<id> segment; the caller falls back to the raw URL.
function parseReplayAnchor(url: string): string | null {
  const session = url.match(/\/replay\/([^/?#]+)/)
  if (!session) return null
  const t = url.match(/[?&]t=(\d+)/)
  return t ? `session ${session[1]}, offset ${t[1]} seconds` : `session ${session[1]}`
}

function bugReportEmailHtml(p: {
  note: string
  expected: string
  url: string
  reportedBy: string
  timestamp: string
  reportStartedAt: string | null
  viewport: string
  userAgent: string
  posthogSessionUrl: string | null
  hasImage: boolean
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
  // Plain-text twins of the replay link: these survive encoding damage that
  // has previously made the href's ?t= anchor unreadable in triage.
  const startedRow = metaRow("Report started", p.reportStartedAt
    ? esc(p.reportStartedAt)
    : `<span style="color:#52525b;">Not available</span>`)
  const anchorRow = metaRow("Replay anchor", p.posthogSessionUrl
    ? esc(parseReplayAnchor(p.posthogSessionUrl) ?? p.posthogSessionUrl)
    : `<span style="color:#52525b;">Not available</span>`)
  const screenshotRow = metaRow("Screenshot", p.hasImage
    ? `<span style="color:#e5e5e5;">Attached to this email</span>`
    : `<span style="color:#52525b;">Not provided</span>`)

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
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">${pageRow}${metaRow("Reported by", esc(p.reportedBy))}${metaRow("Timestamp", esc(p.timestamp))}${startedRow}${metaRow("Viewport", esc(p.viewport || "unknown"))}${metaRow("Browser", esc(p.userAgent || "unknown"))}${replayRow}${anchorRow}${screenshotRow}
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

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  // Length-cap every text field: this endpoint is reachable unauthenticated.
  const note = cap(asString(form.get("note")).trim(), 10000)
  if (!note) {
    return NextResponse.json({ error: "A description is required" }, { status: 400 })
  }

  const expected = cap(asString(form.get("expected")).trim(), 5000)
  const url = cap(asString(form.get("url")).trim(), 2000)
  const viewport = cap(asString(form.get("viewport")).trim(), 32)
  const userAgent = cap(asString(form.get("userAgent")).trim(), 1024)
  const posthogSessionUrl = cap(asString(form.get("posthogSessionUrl")).trim(), 2000) || null
  // Widget-open time, reporter-supplied. Telemetry only, never trusted for
  // anything security-relevant; absent or unparseable becomes null.
  const rawReportStartedAt = cap(asString(form.get("reportStartedAt")).trim(), 64)
  const reportStartedAt =
    rawReportStartedAt && Number.isFinite(Date.parse(rawReportStartedAt))
      ? rawReportStartedAt
      : null
  const reporterId = user?.id ?? null
  const reporterEmail = user?.email ?? null
  const reportedBy = user ? (reporterEmail ?? `signed-in user ${user.id}`) : "Anonymous (logged out)"
  const timestamp = new Date().toISOString()

  // Optional screenshot: validate type + size, then attach it to the triage email
  // (the Gmail-to-Drive bridge files attachments into the bug folder). A rejected
  // or unreadable image is skipped, never fatal: the text report still goes out.
  let attachment: { filename: string; content: Buffer; contentType: string } | null = null
  const imageField = form.get("image")
  if (imageField && typeof imageField !== "string") {
    const mime = (imageField.type || "").toLowerCase()
    const ext = IMAGE_MIME_EXT[mime]
    if (ext && imageField.size > 0 && imageField.size <= MAX_IMAGE_BYTES) {
      try {
        attachment = {
          filename: `bug-screenshot.${ext}`,
          content: Buffer.from(await imageField.arrayBuffer()),
          contentType: mime,
        }
      } catch (err) {
        console.error("bug-report: failed to read image", err)
      }
    } else {
      console.warn("bug-report: image skipped (type/size)", { type: mime, size: imageField.size })
    }
  }

  // A signed-in reporter needs a profiles row (reporter_id FK target). Anonymous
  // reports leave reporter_id null.
  if (user) {
    await ensureProfile(user.id, user.email)
  }

  // 2) Persist the durable row (service role, bypasses RLS like other mutations).
  const db = getServiceClient()
  const baseRow = {
    reporter_id: reporterId,
    reporter_email: reporterEmail,
    note,
    expected: expected || null,
    url: url || null,
    viewport: viewport || null,
    user_agent: userAgent || null,
    posthog_session_url: posthogSessionUrl,
  }
  let { error: insertError } = await db.from("bug_reports").insert({
    ...baseRow,
    report_started_at: reportStartedAt,
  })
  // Deploy-order guard: if migration-011 hasn't run yet, the column doesn't
  // exist. PostgREST reports that as PGRST204 (schema cache miss) before
  // Postgres would return 42703; cover both. The bug intake must never break
  // over a telemetry field, so retry without it rather than 500ing every
  // report until the migration runs.
  if (insertError?.code === "PGRST204" || insertError?.code === "42703") {
    console.warn("bug-report: report_started_at column missing, run migration-011")
    ;({ error: insertError } = await db.from("bug_reports").insert(baseRow))
  }
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
      replyTo: EMAIL_REPLY_TO,
      subject: `[Linestry Bug] ${firstLine}`,
      html: bugReportEmailHtml({
        note,
        expected,
        url,
        reportedBy,
        timestamp,
        reportStartedAt,
        viewport,
        userAgent,
        posthogSessionUrl,
        hasImage: attachment !== null,
      }),
      // Internal triage email; a plaintext part keeps the whole account's send
      // profile consistent for filters. No List-Unsubscribe on an internal email.
      text: `New bug report${reportedBy ? ` from ${reportedBy}` : ""}.\n\nWhat happened:\n${note}\n\nExpected:\n${expected || "(not provided)"}\n\nURL: ${url || "(none)"}\nViewport: ${viewport || "(none)"}\nUser agent: ${userAgent || "(none)"}\n${posthogSessionUrl ? `Session replay: ${posthogSessionUrl}\n` : ""}${attachment ? "Screenshot attached.\n" : ""}`,
      attachments: attachment ? [attachment] : undefined,
    })
    if (sendError) {
      console.error("bug-report Resend error:", sendError)
    }
  } catch (err) {
    console.error("bug-report email threw:", err)
  }

  return NextResponse.json({ ok: true })
}
