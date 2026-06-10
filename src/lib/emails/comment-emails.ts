// Story-comment notification to the story author. Mirrors the shape of
// src/lib/emails/tag-decision-emails.ts with one structural difference: the
// dedup table (story_comment_notifications, keyed on story_id alone) is also
// a BATCHING record. One email per story per 6-hour window; later comments
// inside the window ride along silently, the author sees them when they
// follow the link. Reactions send nothing in v1.

import type { SupabaseClient } from "@supabase/supabase-js"
import { emailHeaderHtml, emailFooterHtml } from "@/lib/emails/shared-header"
import { DEFAULT_COMMUNITY_SLUG } from "@/lib/community"

const BATCH_WINDOW_MS = 6 * 60 * 60 * 1000 // 6 hours, locked June 9 2026
const SNIPPET_MAX = 140

interface FireCommentNotificationArgs {
  storyId: string
  commenterId: string
  commentBody: string
}

/**
 * Fire-and-forget safe: failures are logged and reported in the return value,
 * never thrown. Two near-simultaneous comments can both read a stale window
 * and double-send; the upsert below narrows that race and a duplicate email
 * is a nuisance, not a correctness bug, so it is accepted at launch scale.
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

  // (2) Batch window: skip when the author was already mailed for this story
  // inside the last 6 hours.
  const { data: existing } = await supabase
    .from("story_comment_notifications")
    .select("last_sent_at, send_count")
    .eq("story_id", args.storyId)
    .maybeSingle()
  if (existing && new Date(existing.last_sent_at).getTime() > Date.now() - BATCH_WINDOW_MS) {
    return { sent: false, reason: "batch_window" }
  }

  // (3) Claim the window before sending.
  const { error: upsertErr } = await supabase
    .from("story_comment_notifications")
    .upsert({
      story_id: args.storyId,
      last_sent_at: new Date().toISOString(),
      send_count: ((existing as { send_count?: number } | null)?.send_count ?? 0) + 1,
    })
  if (upsertErr) {
    console.error("[comment-emails] window upsert failed:", upsertErr.message)
    return { sent: false, reason: "window_upsert_failed" }
  }

  // (4) Author email + display names. profiles has NO email column; the
  // address lives in auth.users and is resolved through the admin API, the
  // same way invite-tracking-server and the claim-request emails do it.
  // No email on file is a silent no-op.
  const [authorUserRes, authorRes, commenterRes] = await Promise.all([
    supabase.auth.admin.getUserById(story.author_id),
    supabase.from("profiles").select("display_name").eq("id", story.author_id).maybeSingle(),
    supabase.from("profiles").select("display_name").eq("id", args.commenterId).maybeSingle(),
  ])
  const authorEmail = authorUserRes.data?.user?.email
  if (!authorEmail) return { sent: false, reason: "no_author_email" }
  const authorName = (authorRes.data as { display_name?: string } | null)?.display_name ?? null
  const commenterName = (commenterRes.data as { display_name?: string } | null)?.display_name ?? "A member"

  // Community segment for the focus link; stories.community_id is a uuid into
  // communities. Unknown or missing falls back to the default community.
  let communitySlug: string = DEFAULT_COMMUNITY_SLUG
  if (story.community_id) {
    const { data: community } = await supabase
      .from("communities")
      .select("slug")
      .eq("id", story.community_id)
      .maybeSingle()
    if (community?.slug) communitySlug = community.slug
  }
  const storyUrl = `https://linestry.com/${communitySlug}/stories?focus=${story.id}`

  const key = process.env.RESEND_API_KEY
  if (!key) return { sent: false, reason: "no_resend_key" }

  try {
    const { Resend } = await import("resend")
    const resend = new Resend(key)
    // The Resend SDK reports API-level rejections in the result object and
    // only throws on transport errors, so both paths are checked here.
    const { error: sendErr } = await resend.emails.send({
      from: "Linestry <noreply@linestry.com>",
      to: authorEmail,
      subject: `${commenterName} commented on your story`,
      html: commentNotificationHtml({
        authorName,
        commenterName,
        storyTitle: (story.title as string | null) ?? null,
        commentBody: args.commentBody,
        storyUrl,
      }),
      // Explicit text part. The auto-generated alternative reintroduces a raw
      // "=" into the focus URL, which the quoted-printable layer corrupts
      // (uuid starts with hex digits), so the text fallback links to the
      // stories page without the focus param instead.
      text: commentNotificationText({
        authorName,
        commenterName,
        storyTitle: (story.title as string | null) ?? null,
        commentBody: args.commentBody,
        storiesUrl: `https://linestry.com/${communitySlug}/stories`,
      }),
    })
    if (sendErr) {
      console.error("[comment-emails] Resend send rejected:", sendErr)
      return { sent: false, reason: "send_failed" }
    }
    return { sent: true }
  } catch (err) {
    console.error("[comment-emails] Resend send failed:", err)
    return { sent: false, reason: "send_failed" }
  }
}

function commentNotificationHtml(args: {
  authorName: string | null
  commenterName: string
  storyTitle: string | null
  commentBody: string
  storyUrl: string
}): string {
  const firstName = args.authorName?.trim().split(/\s+/)[0]
  const hello = firstName ? `Hi ${escapeHtml(firstName)},` : "Hi,"
  const commenter = escapeHtml(args.commenterName)
  const intro = args.storyTitle
    ? `${commenter} commented on your story &quot;${escapeHtml(args.storyTitle)}&quot;:`
    : `${commenter} commented on your story:`
  const truncated = args.commentBody.length > SNIPPET_MAX
  const snippet = escapeHtml(args.commentBody.slice(0, SNIPPET_MAX)) + (truncated ? "..." : "")
  // The raw "=" byte followed by two hex digits is a valid quoted-printable
  // escape, and a uuid always starts with hex, so "?focus=<uuid>" arrives
  // corrupted in Gmail (observed June 9 2026: "=74" decoded into "t").
  // Serialising the equals sign as an HTML entity keeps the wire format free
  // of raw "=" while every mail client parses the href back to a normal "=".
  const safeHref = args.storyUrl.replace(/=/g, "&#61;")

  return `
    <div style="margin:0;padding:0;">
      ${emailHeaderHtml()}
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; margin: 0 auto; padding: 28px 28px 8px;">
        <p>${hello}</p>
        <p>${intro}</p>
        <blockquote style="margin: 0 0 16px; padding: 10px 14px; border-left: 3px solid #3b82f6; background: #f6f6f5; color: #44403c; border-radius: 4px;">${snippet}</blockquote>
        <p style="margin: 24px 0;">
          <a href="${safeHref}" style="background: #3b82f6; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 8px; font-weight: 600; display: inline-block;">View the conversation</a>
        </p>
        <p style="color: #666; font-size: 13px;">the Linestry team</p>
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
}): string {
  const firstName = args.authorName?.trim().split(/\s+/)[0]
  const hello = firstName ? `Hi ${firstName},` : "Hi,"
  const intro = args.storyTitle
    ? `${args.commenterName} commented on your story "${args.storyTitle}":`
    : `${args.commenterName} commented on your story:`
  const truncated = args.commentBody.length > SNIPPET_MAX
  const snippet = args.commentBody.slice(0, SNIPPET_MAX) + (truncated ? "..." : "")
  return `${hello}\n\n${intro}\n\n"${snippet}"\n\nView the conversation: ${args.storiesUrl}\n\nthe Linestry team\n`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
