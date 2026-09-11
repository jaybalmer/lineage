// Activation check (activation-retention-scoreboard brief, T1 / D1).
//
// A member is ACTIVATED when three things are all true, in any order:
//   1. they signed up (a profiles row exists),
//   2. they posted at least one story (a stories row authored by them), and
//   3. they came back on a later calendar day than they signed up
//      (last_visit_award_date > created_at::date, both UTC).
//
// Activation is defined off DURABLE STATE, never off a fire-and-forget analytics
// event: a stories row and a date column on profiles cannot be lost to a closed
// tab the way a client trackEvent can. It is emitted exactly once per member as a
// `member_activated` analytics event, made idempotent by a PARTIAL UNIQUE INDEX
// on analytics_events(actor_id) where event = 'member_activated' (D2): a second
// insert violates the constraint and captureServerEvent swallows it, so no lock
// is needed. Step 1 below is a cheap early-out guard, NOT the guarantee.
//
// Called from exactly two places, the only two moments the definition can newly
// become true (D3): the POST /api/stories success path (trigger "story") and the
// daily-visit winner branch in GET /api/me (trigger "return").

import type { SupabaseClient } from "@supabase/supabase-js"
import { captureServerEvent } from "@/lib/analytics-server"

export type ActivationTrigger = "story" | "return"

export async function maybeMarkActivated(
  db: SupabaseClient,
  userId: string,
  trigger: ActivationTrigger,
): Promise<boolean> {
  // Never throws: matches the fire-and-forget contract every analytics path in
  // this repo uses. A failure here must not affect the caller's response.
  try {
    // 1. Already activated? Served by the D2 partial unique index. Cheap guard,
    //    not the idempotency guarantee (the index is).
    const { data: existing } = await db
      .from("analytics_events")
      .select("id")
      .eq("event", "member_activated")
      .eq("actor_id", userId)
      .limit(1)
      .maybeSingle()
    if (existing) return false

    // 2. Profile facts (both columns exist: F9, F15).
    const { data: profile } = await db
      .from("profiles")
      .select("created_at, last_visit_award_date")
      .eq("id", userId)
      .maybeSingle()
    if (!profile?.created_at) return false

    // 3. Condition A, has a story (indexed on author_id, F16).
    const { data: story } = await db
      .from("stories")
      .select("id")
      .eq("author_id", userId)
      .limit(1)
      .maybeSingle()
    if (!story) return false

    // 4. Condition B, has returned on a later UTC day.
    const lastVisit = profile.last_visit_award_date as string | null
    if (!lastVisit) return false
    const createdDay = utcDate(profile.created_at as string)
    if (!(lastVisit > createdDay)) return false

    // 5. Fire. days_to_activate is whole UTC days between signup and now.
    const days_to_activate = Math.max(
      0,
      Math.floor((Date.now() - Date.parse(profile.created_at as string)) / 86_400_000),
    )
    await captureServerEvent({
      category: "auth",
      event: "member_activated",
      actorId: userId,
      props: { days_to_activate, trigger },
    })
    return true
  } catch {
    return false
  }
}

// YYYY-MM-DD of a timestamp in UTC, to compare against a `date` column
// (last_visit_award_date is stored as current_date, i.e. a bare UTC date).
function utcDate(ts: string): string {
  return new Date(ts).toISOString().slice(0, 10)
}
