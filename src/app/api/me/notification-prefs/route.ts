import { NextRequest, NextResponse } from "next/server"
import { requireAuth, getServiceClient } from "@/lib/auth"
import {
  DEFAULT_COMMENT_EMAIL_PREF,
  isCommentEmailPref,
} from "@/lib/comment-email-prefs"

// GET   /api/me/notification-prefs - return { comment_email_pref }
// PATCH /api/me/notification-prefs - body: { comment_email_pref }
//
// Governs how often a story author is emailed about new comments. See
// src/lib/comment-email-prefs.ts for the modes and src/lib/emails/comment-emails.ts
// for how each is applied. Reading degrades to the default if the column is
// not present yet (pre-migration deploy window).

export async function GET() {
  const { user, response } = await requireAuth()
  if (response) return response

  const db = getServiceClient()
  const { data, error } = await db
    .from("profiles")
    .select("comment_email_pref")
    .eq("id", user.id)
    .maybeSingle()

  const raw = error ? null : (data as { comment_email_pref?: string } | null)?.comment_email_pref
  return NextResponse.json({
    comment_email_pref: isCommentEmailPref(raw) ? raw : DEFAULT_COMMENT_EMAIL_PREF,
  })
}

export async function PATCH(req: NextRequest) {
  const { user, response } = await requireAuth()
  if (response) return response

  const body = await req.json().catch(() => null)
  const next: unknown = body?.comment_email_pref

  if (!isCommentEmailPref(next)) {
    return NextResponse.json(
      { error: "comment_email_pref must be one of smart, each, 6h, daily, off" },
      { status: 400 },
    )
  }

  const db = getServiceClient()
  const { error } = await db
    .from("profiles")
    .update({ comment_email_pref: next })
    .eq("id", user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, comment_email_pref: next })
}
