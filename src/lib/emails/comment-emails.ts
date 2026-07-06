// Story-comment notification to the story author. The cadence is a per-user
// setting (profiles.comment_email_pref), defaulting to "smart" spacing:
//   smart - email on comments 1,2,3,4,5,10,25,50,100,200... (one per comment on
//           a normal story, throttled once a thread takes off)
//   each  - email on every comment
//   6h    - at most one email per story per 6h, as a "N new comments" digest
//   daily - at most one email per story per day, as a digest
//   off   - never
// The dedup/batch row (story_comment_notifications, keyed on story_id) records
// the last send so the 6h/daily windows and digest counts can be computed.
// Reactions send nothing in v1.

import type { SupabaseClient } from "@supabase/supabase-js"
import { emailHeaderHtml, emailFooterHtml, EMAIL_REPLY_TO } from "@/lib/emails/shared-header"
import { listUnsubscribeHeaders, isEmailSuppressed } from "@/lib/email-suppression"
import { DEFAULT_COMMUNITY_SLUG } from "@/lib/community"
import {
  type CommentEmailPref,
  DEFAULT_COMMENT_EMAIL_PREF,
  isCommentEmailPref,
  isSmartMilestone,
  COMMENT_EMAIL_PREF_META,
} from "@/lib/comment-email-prefs"
import { signEmailPrefToken } from "@/lib/email-pref-token"

const WINDOW_6H_MS = 6 * 60 * 60 * 1000
const WINDOW_DAILY_MS = 24 * 60 * 60 * 1000
const SNIPPET_MAX = 140
const BASE_URL = "https://linestry.com"

interface FireCommentNotificationArgs {
  storyId: string
  commenterId: string
  commentBody: string
}

/**
 * Fire-and-forget safe: failures are logged and reported in the return value,
 * never thrown. The batch row is committed only AFTER Resend confirms a
 * successful send (BUG-045), so a failed or rejected send never burns the
 * window: the next comment retries instead of the author silently getting
 * nothing. The trade is that two near-simultaneous comments can both pass the
 * window check and double-send; a duplicate email is a nuisance, not a
 * correctness bug, so it is accepted at launch scale.
 */
export async function fireCommentNotification(
  supabase: SupabaseClient,
  args: FireCommentNotificationArgs,
): Promise<{ sent: boolean; reason?: string }> {
  // (1) Story + self-comment guard. Commenting on your own story never mails.
  const { data: story } = await supabase
    .from("stories")
    .select("id, author_id, title, community_id")
    .eq("id", args.storyId)
    .maybeSingle()
  if (!story) return { sent: false, reason: "story_missing" }
  if (story.author_id === args.commenterId) return { sent: false, reason: "self_comment" }

  // (2) Author email, display names, and cadence preference. profiles has NO
  // email column; the address lives in auth.users (admin API), the same way
  // invite-tracking-server and the claim-request emails do it. The pref read
  // is its own select so a pre-migration deploy (column absent) degrades to
  // the smart default without losing the display name. No email on file is a
  // silent no-op.
  const [authorUserRes, authorRes, commenterRes, prefRes] = await Promise.all([
    supabase.auth.admin.getUserById(story.author_id),
    supabase.from("profiles").select("display_name").eq("id", story.author_id).maybeSingle(),
    supabase.from("profiles").select("display_name").eq("id", args.commenterId).maybeSingle(),
    supabase.from("profiles").select("comment_email_pref").eq("id", story.author_id).maybeSingle(),
  ])
  const authorEmail = authorUserRes.data?.user?.email
  if (!authorEmail) return { sent: false, reason: "no_author_email" }
  if (await isEmailSuppressed(authorEmail)) return { sent: false, reason: "unsubscribed" }
  const authorName = (authorRes.data as { display_name?: string } | null)?.display_name ?? null
  const commenterName = (commenterRes.data as { display_name?: string } | null)?.display_name ?? "A member"

  const rawPref = prefRes.error ? null : (prefRes.data as { comment_email_pref?: string } | null)?.comment_email_pref
  const pref: CommentEmailPref = isCommentEmailPref(rawPref) ? rawPref : DEFAULT_COMMENT_EMAIL_PREF
  if (pref === "off") return { sent: false, reason: "pref_off" }

  // (3) Batch row + how many comments by people other than the author this
  // story has. The count includes the comment that just landed, so it drives
  // both the smart ladder and the digest totals.
  const { data: existing } = await supabase
    .from("story_comment_notifications")
    .select("last_sent_at, send_count")
    .eq("story_id", args.storyId)
    .maybeSingle()
  const lastSentMs = existing?.last_sent_at ? new Date(existing.last_sent_at).getTime() : 0

  const { count: qualifyingRaw } = await supabase
    .from("story_comments")
    .select("id", { count: "exact", head: true })
    .eq("story_id", args.storyId)
    .neq("author_id", story.author_id)
  const qualifyingCount = qualifyingRaw ?? 1

  // (4) Cadence decision.
  let shouldSend = false
  if (pref === "each") shouldSend = true
  else if (pref === "smart") shouldSend = isSmartMilestone(qualifyingCount)
  else if (pref === "6h") shouldSend = !lastSentMs || lastSentMs <= Date.now() - WINDOW_6H_MS
  else if (pref === "daily") shouldSend = !lastSentMs || lastSentMs <= Date.now() - WINDOW_DAILY_MS
  if (!shouldSend) {
    return { sent: false, reason: pref === "smart" ? "smart_spacing" : "batch_window" }
  }

  // For the digest modes, count only the comments since the last email so the
  // header reads "N new comments". First send for the story falls back to the
  // full qualifying count.
  let digestCount: number | undefined
  if (pref === "6h" || pref === "daily") {
    if (lastSentMs && existing?.last_sent_at) {
      const { count: sinceRaw } = await supabase
        .from("story_comments")
        .select("id", { count: "exact", head: true })
        .eq("story_id", args.storyId)
        .neq("author_id", story.author_id)
        .gt("created_at", existing.last_sent_at)
      digestCount = sinceRaw ?? 1
    } else {
      digestCount = qualifyingCount
    }
  }

  // (5) Community segment for the focus link; stories.community_id is a uuid
  // into communities. Unknown or missing falls back to the default community.
  let communitySlug: string = DEFAULT_COMMUNITY_SLUG
  if (story.community_id) {
    const { data: community } = await supabase
      .from("communities")
      .select("slug")
      .eq("id", story.community_id)
      .maybeSingle()
    if (community?.slug) communitySlug = community.slug
  }
  // BUG-054: stamp a returnTo so a logged-out recipient who taps Sign in on the
  // story is returned to this exact conversation after login (the nav Sign in
  // entry prefers an existing returnTo over the raw path, so it does not nest).
  const storyPath = `/${communitySlug}/stories?focus=${story.id}`
  const storyUrl = `${BASE_URL}${storyPath}&returnTo=${encodeURIComponent(storyPath)}`

  const key = process.env.RESEND_API_KEY
  if (!key) return { sent: false, reason: "no_resend_key" }

  const isDigest = digestCount !== undefined && digestCount > 1
  const subject = isDigest
    ? `${digestCount} new comments on your story`
    : `${commenterName} commented on your story`

  try {
    const { Resend } = await import("resend")
    const resend = new Resend(key)
    // The Resend SDK reports API-level rejections in the result object and
    // only throws on transport errors, so both paths are checked here.
    const { error: sendErr } = await resend.emails.send({
      from: "Linestry <noreply@linestry.com>",
      to: authorEmail,
      replyTo: EMAIL_REPLY_TO,
      headers: listUnsubscribeHeaders(authorEmail),
      subject,
      html: commentNotificationHtml({
        authorName,
        commenterName,
        storyTitle: (story.title as string | null) ?? null,
        commentBody: args.commentBody,
        storyUrl,
        digestCount: isDigest ? digestCount : undefined,
        authorId: story.author_id,
        pref,
      }),
      // Explicit text part. The auto-generated alternative reintroduces a raw
      // "=" into URLs, which the quoted-printable layer corrupts (uuid/hex
      // starts), so the text fallback uses only param-free URLs.
      text: commentNotificationText({
        authorName,
        commenterName,
        storyTitle: (story.title as string | null) ?? null,
        commentBody: args.commentBody,
        storiesUrl: `${BASE_URL}/${communitySlug}/stories`,
        digestCount: isDigest ? digestCount : undefined,
      }),
    })
    if (sendErr) {
      console.error("[comment-emails] Resend send rejected:", sendErr)
      return { sent: false, reason: "send_failed" }
    }

    // Commit the batch row only now that the send succeeded, so a failed send
    // above never burns the window and silently suppresses later comment
    // emails (BUG-045). send_count counts confirmed sends. A failed commit is
    // logged but not fatal: the email is out, worst case a duplicate next time.
    const { error: windowErr } = await supabase
      .from("story_comment_notifications")
      .upsert({
        story_id: args.storyId,
        last_sent_at: new Date().toISOString(),
        send_count: ((existing as { send_count?: number } | null)?.send_count ?? 0) + 1,
      })
    if (windowErr) {
      console.error("[comment-emails] window upsert failed:", windowErr.message)
    }
    return { sent: true }
  } catch (err) {
    console.error("[comment-emails] Resend send failed:", err)
    return { sent: false, reason: "send_failed" }
  }
}

// Escape an href so the quoted-printable layer cannot corrupt it: a raw "="
// after hex is a valid QP escape (uuids/tokens start with hex), and a raw "&"
// is not valid in an HTML attribute. Both become entities the browser decodes
// back to the real character. Observed June 9 2026: "?focus=<uuid>" arrived as
// "=74" decoded into "t".
function safeHref(url: string): string {
  return url.replace(/&/g, "&amp;").replace(/=/g, "&#61;")
}

// One-click cadence controls for the email footer. Each link is signed for
// (this author, this pref), so it changes only that account's setting and only
// to that value. GET-applies for true one-click; the change is fully
// reversible from any of the other links or the settings page, so an email
// scanner that follows a link does no lasting harm.
function prefControlsHtml(authorId: string, pref: CommentEmailPref): string {
  const quick = (p: CommentEmailPref) =>
    safeHref(`${BASE_URL}/api/notifications/email-pref?u=${authorId}&pref=${p}&t=${signEmailPrefToken(authorId, p)}`)
  const settings = safeHref(`${BASE_URL}/me/settings/notifications`)
  const linkStyle = "color:#2563eb;text-decoration:none;"
  return `
        <div style="margin-top:22px;padding-top:14px;border-top:1px solid #e7e5e4;font-size:12px;color:#78716c;">
          <div style="margin-bottom:6px;">You're getting these on <strong>${COMMENT_EMAIL_PREF_META[pref].label}</strong>. Change how often:</div>
          <a href="${quick("daily")}" style="${linkStyle}">Once a day</a>
          &nbsp;&middot;&nbsp;
          <a href="${quick("6h")}" style="${linkStyle}">Every 6 hours</a>
          &nbsp;&middot;&nbsp;
          <a href="${quick("off")}" style="${linkStyle}">Turn off</a>
          &nbsp;&middot;&nbsp;
          <a href="${settings}" style="${linkStyle}">All settings</a>
        </div>`
}

function commentNotificationHtml(args: {
  authorName: string | null
  commenterName: string
  storyTitle: string | null
  commentBody: string
  storyUrl: string
  digestCount?: number
  authorId: string
  pref: CommentEmailPref
}): string {
  const firstName = args.authorName?.trim().split(/\s+/)[0]
  const hello = firstName ? `Hi ${escapeHtml(firstName)},` : "Hi,"
  const commenter = escapeHtml(args.commenterName)
  const titlePart = args.storyTitle ? ` &quot;${escapeHtml(args.storyTitle)}&quot;` : ""
  const intro = args.digestCount
    ? `You have ${args.digestCount} new comments on your story${titlePart}. Here's the latest:`
    : `${commenter} commented on your story${titlePart}:`
  const truncated = args.commentBody.length > SNIPPET_MAX
  const snippet = escapeHtml(args.commentBody.slice(0, SNIPPET_MAX)) + (truncated ? "..." : "")

  return `
    <div style="margin:0;padding:0;">
      ${emailHeaderHtml()}
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; margin: 0 auto; padding: 28px 28px 8px;">
        <p>${hello}</p>
        <p>${intro}</p>
        <blockquote style="margin: 0 0 16px; padding: 10px 14px; border-left: 3px solid #3b82f6; background: #f6f6f5; color: #44403c; border-radius: 4px;">${snippet}</blockquote>
        <p style="margin: 24px 0;">
          <a href="${safeHref(args.storyUrl)}" style="background: #3b82f6; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 8px; font-weight: 600; display: inline-block;">View the conversation</a>
        </p>
        <p style="color: #666; font-size: 13px;">the Linestry team</p>
        ${prefControlsHtml(args.authorId, args.pref)}
      </div>
      ${emailFooterHtml()}
    </div>
  `
}

function commentNotificationText(args: {
  authorName: string | null
  commenterName: string
  storyTitle: string | null
  commentBody: string
  storiesUrl: string
  digestCount?: number
}): string {
  const firstName = args.authorName?.trim().split(/\s+/)[0]
  const hello = firstName ? `Hi ${firstName},` : "Hi,"
  const titlePart = args.storyTitle ? ` "${args.storyTitle}"` : ""
  const intro = args.digestCount
    ? `You have ${args.digestCount} new comments on your story${titlePart}. Here's the latest:`
    : `${args.commenterName} commented on your story${titlePart}:`
  const truncated = args.commentBody.length > SNIPPET_MAX
  const snippet = args.commentBody.slice(0, SNIPPET_MAX) + (truncated ? "..." : "")
  return `${hello}\n\n${intro}\n\n"${snippet}"\n\nView the conversation: ${args.storiesUrl}\n\nManage your comment emails: ${BASE_URL}/me/settings/notifications\n\nthe Linestry team\n`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
