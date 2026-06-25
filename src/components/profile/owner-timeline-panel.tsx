"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Nav } from "@/components/ui/nav"
import { FeedView, type FilterType } from "@/components/feed/feed-view"
import { StoryCard } from "@/components/feed/story-card"
import { useLineageStore, getAllClaims, isAuthUser } from "@/store/lineage-store"
import { getPersonById, PLACES } from "@/lib/mock-data"
import { EditProfileModal } from "@/components/ui/edit-profile-modal"
import { RiderCard } from "@/components/ui/rider-card"
import { DailyTokenChip } from "@/components/ui/daily-token-chip"
import { AddClaimModal } from "@/components/ui/add-claim-modal"
import { AddStoryModal } from "@/components/ui/add-story-modal"
import { TimelinePlayer } from "@/components/ui/timeline-player"
import { BulkInvitePrompt } from "@/components/ui/bulk-invite-prompt"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { StackTimelineToggle } from "@/components/public-timeline/stack-timeline-toggle"
import { readSeenIds, writeSeenIds } from "@/lib/seen-celebrations"
import { groupRodeAtCompanions, countTimelineEntries } from "@/lib/companion-grouping"
import { estimateShares } from "@/lib/equity-offer"
import type { Claim, CelebrationPayload, PrivacyLevel, Story } from "@/types"

// ─── FTUE helpers ─────────────────────────────────────────────────────────────

function getCelebrationForNewClaim(claim: Claim, claimCount: number, catalog: {
  boards: { id: string; brand: string; model: string; model_year: number }[]
  events: { id: string; name: string }[]
  people: { id: string; display_name: string }[]
  places: { id: string; name: string }[]
  orgs: { id: string; name: string }[]
}) {
  const { predicate, object_id, object_type } = claim

  if (predicate === "owned_board") {
    const board = catalog.boards.find((b) => b.id === object_id)
    const boardName = board ? `${board.brand} ${board.model} '${String(board.model_year).slice(-2)}` : "Your board"
    const isVintage = board && board.model_year < 2005
    const body = isVintage
      ? `This board is from ${board!.model_year}. You're preserving a piece of snowboard history.`
      : "Every board you've ridden is part of your story."
    return {
      tier: 2 as const,
      icon: "🏂",
      title: `${boardName} added to your quiver`,
      body,
      stat: claimCount === 1 ? "Your first entry" : `Entry #${claimCount} on your timeline`,
      nextThread: "Add when you got it to place it on your timeline.",
      contentType: "board" as const,
    }
  }

  if (predicate === "competed_at" || predicate === "spectated_at") {
    const event = catalog.events.find((e) => e.id === object_id)
    const eventName = event?.name ?? "That event"
    const verb = predicate === "competed_at" ? "competed at" : "were at"
    return {
      tier: 2 as const,
      icon: "📍",
      title: `${eventName} added to your timeline`,
      body: `You ${verb} part of snowboard history. Your presence is now on the record.`,
      stat: claimCount === 1 ? "Your first entry" : `Entry #${claimCount} on your timeline`,
      nextThread: "Add a result or note to tell the full story.",
      contentType: "event" as const,
    }
  }

  if (predicate === "rode_at") {
    const place = catalog.places.find((p) => p.id === object_id)
    const placeName = place?.name ?? "That mountain"
    return {
      tier: 2 as const,
      icon: "🏔",
      title: `${placeName} added to your timeline`,
      body: "Every mountain you've ridden is part of who you are as a rider.",
      stat: claimCount === 1 ? "Your first entry" : `Entry #${claimCount} on your timeline`,
      nextThread: "Add more years or seasons to fill in the full picture.",
      contentType: "event" as const,
    }
  }

  if (predicate === "rode_with") {
    const person = catalog.people.find((p) => p.id === object_id)
    const personName = person?.display_name ?? "Your crew"
    return {
      tier: 2 as const,
      icon: "🤝",
      title: `${personName} added to your crew`,
      body: "The people you ride with are part of your linestry. Your network in the community just grew.",
      stat: claimCount === 1 ? "Your first entry" : `Entry #${claimCount} on your timeline`,
      nextThread: "Tag them in a story or connect them to an event you shared.",
      contentType: "person" as const,
    }
  }

  if (predicate === "sponsored_by" || predicate === "part_of_team" || predicate === "worked_at") {
    const org = catalog.orgs.find((o) => o.id === object_id)
      ?? (object_type === "place" ? { name: catalog.places.find((p) => p.id === object_id)?.name ?? "That brand" } : null)
    const orgName = org?.name ?? "That brand"
    const verb = predicate === "sponsored_by" ? "Sponsored by" : predicate === "part_of_team" ? "Team" : "Worked at"
    return {
      tier: 2 as const,
      icon: "🎽",
      title: `${verb}: ${orgName}`,
      body: "Your professional history is part of the collective record.",
      stat: claimCount === 1 ? "Your first entry" : `Entry #${claimCount} on your timeline`,
      nextThread: "Add dates to show the full span of your relationship.",
      contentType: "person" as const,
    }
  }

  // Generic fallback
  return {
    tier: 1 as const,
    icon: "✓",
    title: "Added to your timeline",
    stat: claimCount === 1 ? "Your first entry" : `Entry #${claimCount}`,
    contentType: "event" as const,
  }
}

function getMilestoneCelebration(count: number) {
  if (count === 1) return {
    tier: 3 as const,
    icon: "🌱",
    title: "Your first entry: timeline started",
    body: "Every epic timeline starts with a single entry. Yours is now on the record.",
    nextThread: "Add 4 more to unlock your founding rider badge.",
    accentColor: "#22c55e",
    contentType: "milestone" as const,
  }
  if (count === 5) return {
    tier: 3 as const,
    icon: "⚡",
    title: "5 entries: your timeline is coming to life",
    body: "You're building something real. 5 entries means the shape of your riding career is starting to show.",
    nextThread: "Keep going. 10 entries and you're in the top 10% of contributors.",
    accentColor: "#3b82f6",
    contentType: "milestone" as const,
  }
  if (count === 10) return {
    tier: 3 as const,
    icon: "🔥",
    title: "10 entries: double digits",
    body: "You're not just a member, you're a contributor. Your timeline is one of the most complete in the community.",
    nextThread: "Share your profile link. Your linestry is worth showing off.",
    accentColor: "#f59e0b",
    contentType: "milestone" as const,
  }
  return null
}

// ─── Board-add milestone celebration ─────────────────────────────────────────
// A rider's first and second board land a Tier-4 modal that frames their whole
// timeline; the third board onward falls back to the Tier-2 quiver toast in
// getCelebrationForNewClaim. The overlap stat needs the stats route, so this is
// async and queues once the fetch settles (the celebration queue tolerates the
// short delay).

async function queueBoardMilestoneCelebration(
  claim: Claim,
  userId: string,
  boards: { id: string; brand: string; model: string; model_year: number }[],
  ridingSince: number | undefined,
  queue: (payload: CelebrationPayload) => void,
) {
  const board = boards.find((b) => b.id === claim.object_id)
  const boardLabel = board ? `${board.brand} ${board.model}` : "this board"
  const currentYear = new Date().getFullYear()
  const yearsRiding = ridingSince ? currentYear - ridingSince : null

  let overlapCount = 0
  try {
    const res = await fetch(`/api/stats/user?userId=${userId}&boardId=${claim.object_id}`)
    if (res.ok) {
      const stats = await res.json()
      overlapCount = typeof stats?.board_overlap_count === "number" ? stats.board_overlap_count : 0
    }
  } catch {
    // The overlap line is a bonus; a failed stats fetch just drops it.
  }

  const body = ridingSince && yearsRiding && yearsRiding > 0
    ? `You just connected ${ridingSince} to ${currentYear}. That's a ${yearsRiding}-year timeline.`
    : "Every board you've ridden is part of your story."

  const stat = overlapCount > 0
    ? overlapCount === 1
      ? `1 other member also rides the ${boardLabel}.`
      : `${overlapCount} other members also ride the ${boardLabel}.`
    : undefined

  queue({
    tier: 4,
    icon: "🏂",
    title: `Nice. The ${boardLabel}, solid choice.`,
    body,
    stat,
    accentColor: "#3b82f6",
    contentType: "board",
  })
}

// ─── Owner timeline panel ───────────────────────────────────────────────────
// Extracted verbatim from the former /[community]/profile ProfilePage so the
// viewer's own timeline (full owner toolkit, claims read unfiltered by
// visibility, optimistic adds via getAllClaims) renders in exactly one place.
// Rendered by /people/[id] when the viewer is the subject; the old profile URLs
// now redirect there. See profile-unification-and-visibility-fix-brief.md.

export function OwnerTimelinePanel() {
  const router = useRouter()
  const {
    activePersonId, authReady, sessionClaims, dbClaims, setDbClaims,
    deletedClaimIds, claimOverrides, profileOverride, ridingDays,
    membership, triggerPrefs, setTriggerPrefs, setShowMemberCard,
    catalog, catalogLoaded, queueCelebration, setShowWelcomeCelebration,
    pendingTagCount,
  } = useLineageStore()

  const myDays = ridingDays.filter((d) => d.created_by === activePersonId)
  const [editingProfile, setEditingProfile]   = useState(false)
  const [addingClaim,    setAddingClaim]       = useState(false)
  const [addingStory,    setAddingStory]       = useState(false)
  const [playingTimeline, setPlayingTimeline]  = useState(false)
  const [timelineOrder,  setTimelineOrder]     = useState<"asc" | "desc">("desc")
  const [stories,        setStories]           = useState<Story[]>([])
  // Stories this author kept OFF their timeline (on_timeline=false). Rendered
  // in a separate Contributions section below the timeline, never merged into
  // `stories` (so they don't show on the timeline or trip the story
  // celebration, which keys off the `stories` array).
  const [contributions,  setContributions]     = useState<Story[]>([])
  const [claimDefaultFilter, setClaimDefaultFilter] = useState<string>("all")
  // Lifted so the summary stat tiles can drive the timeline filter (BUG-034).
  const [timelineFilter, setTimelineFilter]    = useState<FilterType>("all")
  const timelineRef = useRef<HTMLDivElement>(null)

  // First-visit timeline entrance (Task 4). Latched once for the page session:
  // it turns on after the welcome explosion has been seen and the entrance has
  // not played yet, then we persist timeline_animated so it never replays.
  // FeedView owns the bake-off that ends the reveal, so we keep passing the
  // latched value rather than flipping the prop back off.
  const [animateEntrance, setAnimateEntrance] = useState(false)

  // Loaded flags for the async profile fetches. The celebration effects gate
  // on these so the first-visit seen-id high-water seed captures the full
  // dbClaims/stories set. Without them, the seed runs while both arrays are
  // still empty and the next render fires a celebration for every entry that
  // just arrived. Set true on both success and error so a failed fetch can't
  // keep the celebration logic permanently disabled.
  const [claimsLoaded,  setClaimsLoaded]  = useState(false)
  const [storiesLoaded, setStoriesLoaded] = useState(false)

  // Platform-wide weighted token total for the equity share estimate (A3).
  // Mirrors the fetch on /account/membership; a pending or failed fetch leaves
  // this null so the share line falls back to the encouraging prompt copy.
  const [poolTotal, setPoolTotal] = useState<number | null>(null)

  // Owner's public Stack (/t/[slug]) availability — drives the Stack/Timeline
  // toggle. Read from the profiles row fetched below. Kept on the owner panel so
  // the unified /people/[id] still offers the cross-link to the curated Stack
  // when the owner has a public timeline enabled (the public RiderPage carries
  // the same toggle).
  const [publicTimeline, setPublicTimeline] = useState<{ enabled: boolean; slug: string | null } | null>(null)

  // Track previous claim count to detect new additions
  const prevClaimCountRef = useRef<number | null>(null)
  const welcomeFiredRef   = useRef(false)

  // BUG-046: a logged-out visitor has no "my timeline" to show, and the old
  // behaviour rendered a seeded mock/demo persona (e.g. "3 boards, 12 events")
  // that jarringly differed from the real counts after sign-in. Per Jay's
  // June 16 decision we no longer show the mock demo here and do not gate behind
  // a sign-in wall: non-auth visitors go to the public riders directory, which
  // is real public data. The body is also gated below so the demo never flashes.
  useEffect(() => {
    if (!authReady) return
    if (!isAuthUser(activePersonId)) {
      router.replace("/people")
    }
  }, [authReady, activePersonId, router])

  // Equity pool total (A3). One public fetch, same pattern as
  // /account/membership; failures are swallowed so the share line just falls
  // back to the prompt copy.
  useEffect(() => {
    fetch("/api/equity/pool")
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.total_weighted_tokens === "number") setPoolTotal(d.total_weighted_tokens)
      })
      .catch(() => {})
  }, [])

  // Fire welcome explosion once on first profile visit after signup
  useEffect(() => {
    if (!authReady || !isAuthUser(activePersonId)) return
    if (welcomeFiredRef.current) return
    if (triggerPrefs.welcome_pending && !triggerPrefs.welcome_celebration_shown) {
      welcomeFiredRef.current = true
      // Small delay so the page renders first
      const t = setTimeout(() => setShowWelcomeCelebration(true), 600)
      return () => clearTimeout(t)
    }
  }, [authReady, activePersonId, triggerPrefs.welcome_pending, triggerPrefs.welcome_celebration_shown, setShowWelcomeCelebration])

  // Latch the first-visit timeline entrance once the welcome explosion has been
  // shown. animateEntrance is its own one-way latch (it never resets to false), so
  // it keeps FeedView animating to completion regardless of the prefs flip. The
  // latch is set during render rather than with a synchronous setState in an effect
  // (react-hooks/set-state-in-effect); the follow-up effect persists the flag so an
  // interrupted session can't replay it.
  if (
    !animateEntrance &&
    isAuthUser(activePersonId) &&
    triggerPrefs.welcome_celebration_shown &&
    !triggerPrefs.timeline_animated
  ) {
    setAnimateEntrance(true)
  }

  useEffect(() => {
    if (animateEntrance && !triggerPrefs.timeline_animated) {
      setTriggerPrefs({ timeline_animated: true })
    }
  }, [animateEntrance, triggerPrefs.timeline_animated, setTriggerPrefs])

  const basePerson = getPersonById(activePersonId)
  const person = basePerson
    ? { ...basePerson, ...profileOverride }
    : Object.keys(profileOverride).length > 0
      ? { id: activePersonId, ...profileOverride } as typeof basePerson & typeof profileOverride
      : null

  useEffect(() => {
    if (!isAuthUser(activePersonId)) return
    const store = useLineageStore.getState()

    supabase
      .from("profiles")
      .select("*")
      .eq("id", activePersonId)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          store.setProfileOverride({
            display_name: data.display_name,
            birth_year: data.birth_year ?? undefined,
            riding_since: data.riding_since ?? undefined,
            bio: data.bio ?? undefined,
            home_resort_id: data.home_resort_id ?? undefined,
            privacy_level: data.privacy_level as PrivacyLevel,
            links: data.links ?? undefined,
          })
          setPublicTimeline({
            enabled: data.public_timeline_enabled === true && !!data.public_slug,
            slug: data.public_slug ?? null,
          })
        }
      })

    // PB-009 Phase 1: own-profile read through claims_public. In Phase 2,
    // pending tags addressed to this user will instead surface in /me/tags;
    // for Phase 1 every row is 'approved' so behaviour is unchanged.
    //
    // claimsLoaded flips true once this query settles (success or error) so
    // the celebration effect below can wait for dbClaims to arrive before
    // seeding its first-visit high-water mark.
    supabase
      .from("claims_public")
      .select("*")
      .eq("subject_id", activePersonId)
      .then(({ data, error }) => {
        if (!error && data) setDbClaims(data as Claim[])
        setClaimsLoaded(true)
      })

    // PB-009 Phase 2: own profile shows stories authored by + tagged-in.
    // Tagged-in reads through story_riders_public, so pending tags stay hidden
    // until approved via /me/tags.
    //
    // Same loaded-flag pattern as claims: storiesLoaded gates the story
    // celebration so the seed sees the full authored+tagged-in set on first
    // visit instead of an empty array.
    // Authored fetch is filtered to on_timeline=true: off-timeline stories the
    // author wrote about other entities are pulled separately into Contributions
    // (below) and never appear on the timeline. The tagged-in fetch is left
    // unfiltered. Being tagged in someone else's off-timeline story is still a
    // tag against you, governed by PB-009, not by this flag.
    Promise.all([
      fetch(`/api/stories?author_id=${activePersonId}&on_timeline=true&limit=100`).then((r) => r.json()).catch(() => []),
      fetch(`/api/stories?rider_id=${activePersonId}&limit=100`).then((r) => r.json()).catch(() => []),
    ])
      .then(([authored, taggedIn]) => {
        const byId = new Map<string, Story>()
        for (const s of (Array.isArray(authored)  ? authored  : []) as Story[]) byId.set(s.id, s)
        for (const s of (Array.isArray(taggedIn)  ? taggedIn  : []) as Story[]) byId.set(s.id, s)
        const merged = Array.from(byId.values()).sort((a, b) =>
          (b.story_date ?? "").localeCompare(a.story_date ?? "")
        )
        setStories(merged)
      })
      .finally(() => setStoriesLoaded(true))

    // Contributions: stories this author kept off their own timeline.
    fetch(`/api/stories?author_id=${activePersonId}&on_timeline=false&limit=100`)
      .then((r) => r.json())
      .then((rows) => setContributions(Array.isArray(rows) ? (rows as Story[]) : []))
      .catch(() => setContributions([]))
  }, [activePersonId]) // eslint-disable-line react-hooks/exhaustive-deps

  const allClaims    = getAllClaims(sessionClaims, dbClaims, deletedClaimIds, claimOverrides, activePersonId)
  const personClaims = allClaims.filter((c) => c.subject_id === activePersonId)

  // BUG-104: the post-add celebration's "Entry #N on your timeline" must match
  // the timeline "All" pill, which folds companion rode_with rows, drops boards
  // (they live in their own shelf), and adds days + stories. Compute it through
  // the same helper FeedView's pill uses so the two can never diverge. Raw
  // personClaims.length over-counted both folds and boards, so it overstated the
  // entry number and looked like deletes were being ignored.
  const { claims: groupedPersonClaims } = groupRodeAtCompanions(personClaims)
  const timelineEntryCount = countTimelineEntries(groupedPersonClaims, myDays.length, stories.length)

  // Detect new claim additions and fire contextual celebration + milestone checks.
  //
  // Bug history: this used to compare personClaims.length against a useRef
  // baseline. The baseline was seeded on the first effect tick, BEFORE the
  // async supabase fetch for dbClaims resolved, so every page load went
  // (small initial count) -> (full count) and re-fired the most-recent
  // claim's celebration. The fix is three layers:
  //  1. Persist a per-user set of "seen" claim IDs in localStorage so we
  //     can tell async-arrival from a fresh add.
  //  2. Wait for catalogLoaded before doing any work, so entity names
  //     resolve when we build the celebration payload.
  //  3. Wait for claimsLoaded before seeding the high-water mark on a
  //     first-ever visit. Without (3), the seed captures the (empty)
  //     pre-fetch personClaims, then the post-fetch render treats every
  //     loaded claim as unseen and mis-fires one celebration on visit 1.
  useEffect(() => {
    if (!isAuthUser(activePersonId)) return
    if (!catalogLoaded) return
    if (!claimsLoaded) return

    const existingSeen = readSeenIds(activePersonId, "claim")
    const count        = personClaims.length
    const prev         = prevClaimCountRef.current

    // First visit ever for this (user, browser): silently mark every
    // currently-loaded claim as seen so existing entries don't replay
    // their celebrations. Future additions still fire because their IDs
    // won't be in the persisted set.
    if (existingSeen === null) {
      writeSeenIds(activePersonId, "claim", new Set(personClaims.map((c) => c.id)))
      prevClaimCountRef.current = count
      return
    }

    const unseen = personClaims.filter((c) => !existingSeen.has(c.id))
    if (unseen.length > 0) {
      // Persist the new seen set first so a re-render mid-effect can't replay.
      const next = new Set(existingSeen)
      for (const c of unseen) next.add(c.id)
      writeSeenIds(activePersonId, "claim", next)

      // Fire the contextual celebration only for the latest unseen claim.
      // If multiple landed at once (bulk import, async catch-up after a long
      // offline session), the rest are still marked seen above so they won't
      // replay later. We just don't spam a stack of toasts.
      const newClaim = unseen[unseen.length - 1]
      const boardCount = personClaims.filter((c) => c.predicate === "owned_board").length
      if (newClaim.predicate === "owned_board" && boardCount <= 2) {
        // First or second board lands the Tier-4 timeline-framing modal. It is
        // async (the overlap stat comes from the stats route), so fire and
        // forget; the celebration queue tolerates the short delay.
        void queueBoardMilestoneCelebration(newClaim, activePersonId, catalog.boards, person?.riding_since, queueCelebration)
      } else {
        // BUG-104: show the number the user actually sees for this entry, not the
        // raw claim total. A board reads the distinct-board "Boards" pill (so a
        // 3rd+ board never reports "Entry #0" when the timeline is otherwise
        // empty); every timeline claim reads the "All" pill. Both come from the
        // same helpers the pills use, so the celebration can't overstate.
        const celebrationCount = newClaim.predicate === "owned_board"
          ? new Set(personClaims.filter((c) => c.predicate === "owned_board").map((c) => c.object_id)).size
          : timelineEntryCount
        queueCelebration(getCelebrationForNewClaim(newClaim, celebrationCount, catalog))
      }

      // FTUE step tracking, driven by the newest claim's predicate.
      const { predicate } = newClaim
      if (predicate === "owned_board" && !triggerPrefs.ftue_added_board) {
        setTriggerPrefs({ ftue_added_board: true })
      }
      if ((predicate === "competed_at" || predicate === "spectated_at" || predicate === "rode_at") && !triggerPrefs.ftue_added_event) {
        setTriggerPrefs({ ftue_added_event: true })
      }
      if (predicate === "rode_with" && !triggerPrefs.ftue_connected_person) {
        setTriggerPrefs({ ftue_connected_person: true })
      }
    }

    // Milestone celebrations, gated by both the persistent triggerPrefs flag
    // AND a real in-session count increase, so async-arrival of pre-existing
    // claims doesn't accidentally trip them on first load.
    if (prev !== null && count > prev) {
      const milestoneDelay = 1200
      if (count === 1 && !triggerPrefs.milestone_first_shown) {
        setTimeout(() => {
          const m = getMilestoneCelebration(1)
          if (m) queueCelebration(m)
        }, milestoneDelay)
        setTriggerPrefs({ milestone_first_shown: true })
      } else if (count === 5 && !triggerPrefs.milestone_5_shown) {
        setTimeout(() => {
          const m = getMilestoneCelebration(5)
          if (m) queueCelebration(m)
        }, milestoneDelay)
        setTriggerPrefs({ milestone_5_shown: true })
      } else if (count === 10 && !triggerPrefs.milestone_10_shown) {
        setTimeout(() => {
          const m = getMilestoneCelebration(10)
          if (m) queueCelebration(m)
        }, milestoneDelay)
        setTriggerPrefs({ milestone_10_shown: true })
      }
    }

    prevClaimCountRef.current = count
  }, [personClaims.length, activePersonId, catalogLoaded, claimsLoaded]) // eslint-disable-line react-hooks/exhaustive-deps

  // Detect new story additions and fire celebration + step tracking.
  //
  // Same async-load bug as the claims effect above: the stories fetch
  // resolves AFTER the first effect tick seeds the ref, so every visit
  // appeared to be a "new story added". Also note that `stories` includes
  // BOTH authored-by-me and tagged-in-me, so before this fix any time
  // another user tagged Jay in a story, his next /profile visit would
  // celebrate the tagged-in story as if he'd authored it. Same id-based
  // persistence pattern as claims fixes both cases, and the same
  // storiesLoaded gate keeps the first-visit seed honest.
  const prevStoriesCountRef = useRef<number | null>(null)
  useEffect(() => {
    if (!isAuthUser(activePersonId)) return
    if (!storiesLoaded) return

    const existingSeen = readSeenIds(activePersonId, "story")
    const count = stories.length

    if (existingSeen === null) {
      writeSeenIds(activePersonId, "story", new Set(stories.map((s) => s.id)))
      prevStoriesCountRef.current = count
      return
    }

    const unseen = stories.filter((s) => !existingSeen.has(s.id))
    if (unseen.length > 0) {
      const next = new Set(existingSeen)
      for (const s of unseen) next.add(s.id)
      writeSeenIds(activePersonId, "story", next)

      if (!triggerPrefs.ftue_shared_story) {
        setTriggerPrefs({ ftue_shared_story: true })
      }
      // stories[] is sorted desc by story_date, so unseen[0] is the newest.
      const latestStory = unseen[0]
      queueCelebration({
        tier: 2,
        icon: "📖",
        title: latestStory?.title ? `"${latestStory.title}" is now on the record` : "Your story is part of the permanent record",
        body: "Stories are what bring the history to life. Thank you for adding yours.",
        nextThread: "Tag people, a board, or a place to connect your story to the collective.",
        contentType: "story",
      })
    }

    prevStoriesCountRef.current = count
  }, [stories.length, activePersonId, storiesLoaded]) // eslint-disable-line react-hooks/exhaustive-deps

  const homeResort = person?.home_resort_id
    ? PLACES.find((p) => p.id === (person as { home_resort_id?: string }).home_resort_id)
    : null

  // Equity share estimate (A3). estimateShares returns null when myWeighted is
  // 0 (free rider, no tokens yet) or the pool total has not loaded, so the
  // share line shows the encouraging prompt instead of a zero estimate.
  const myWeighted =
    membership.token_balance.founder * 2 +
    membership.token_balance.member +
    membership.token_balance.contribution
  const shareEst = poolTotal !== null ? estimateShares(myWeighted, poolTotal) : null

  // BUG-046: never render the mock/demo profile for a non-auth visitor. They are
  // being redirected to /people by the effect above; until that lands (and while
  // auth is still resolving) show a bare shell instead of the seeded persona.
  // activePersonId is persisted, so a signed-in member's UUID is present on first
  // paint and they skip this branch with no flash.
  if (!isAuthUser(activePersonId)) {
    return (
      <div className="min-h-screen bg-background">
        <Nav />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Nav />

      {editingProfile && person && (
        <EditProfileModal
          person={person}
          onClose={() => setEditingProfile(false)}
        />
      )}
      {addingClaim && (
        <AddClaimModal
          defaultFilter={claimDefaultFilter}
          onClose={() => { setAddingClaim(false); setClaimDefaultFilter("all") }}
        />
      )}
      {addingStory && (
        <AddStoryModal
          onClose={() => setAddingStory(false)}
          onSaved={(s) => { setStories((prev) => [s, ...prev]); setAddingStory(false) }}
        />
      )}
      {playingTimeline && person && (
        <TimelinePlayer
          person={person}
          claims={personClaims}
          onClose={() => setPlayingTimeline(false)}
        />
      )}

      <div className="max-w-3xl mx-auto px-4 py-10">

        {/* Breadcrumb + Stack/Timeline toggle. The unified /people/[id] keeps the
            owner's cross-link to their public Stack at /t/[slug] (shown only when
            a public timeline is enabled), matching the public profile's top row. */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="text-xs text-muted">
            <Link href="/people" className="hover:text-foreground">Riders</Link>
            <span className="mx-2">/</span>
            <span className="text-muted">{person?.display_name ?? "You"}</span>
          </div>
          {publicTimeline?.enabled && publicTimeline.slug && (
            <StackTimelineToggle
              active="timeline"
              stackHref={`/t/${publicTimeline.slug}`}
              variant="light"
            />
          )}
        </div>

        {/* PB-009 Phase 2: pending-tag pill, owner-only by virtue of this
            page being the active user's own profile (no [id] segment). */}
        {pendingTagCount > 0 && (
          <Link
            href="/me/tags"
            className="inline-flex items-center gap-2 px-3 py-1.5 mb-4 rounded-full bg-blue-600/10 text-blue-700 hover:bg-blue-600/20 transition-colors text-xs font-medium"
          >
            <span>
              {pendingTagCount} {pendingTagCount === 1 ? "tag" : "tags"} pending review
            </span>
            <span aria-hidden>→</span>
          </Link>
        )}

        {/* ── Rider Card ── */}
        {person && (
          <RiderCard
            person={person}
            claims={personClaims}
            membership={membership}
            homeResort={homeResort ?? null}
            isOwn
            userId={activePersonId}
            onEdit={() => setEditingProfile(true)}
            onPlayTimeline={() => setPlayingTimeline(true)}
            onMemberCard={() => setShowMemberCard(true)}
            onStatClick={(cat) => {
              setTimelineFilter(cat)
              timelineRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
            }}
          />
        )}

        {/* Equity share so far (own profile only: this page redirects anyone
            who is not the signed-in user). A member or any rider who has earned
            tokens sees a live estimate; a free rider with no tokens sees the
            encouraging prompt. Replaces the old "{n} tokens · In the equity
            pool" teaser so we never stack two token readouts (brief A3). */}
        {isAuthUser(activePersonId) && (
          <div className="flex items-center gap-4 mb-4 flex-wrap">
            {shareEst ? (
              <Link href="/equity"
                className="flex items-center gap-1.5 text-muted hover:text-foreground transition-colors"
                style={{ fontSize: 10, fontFamily: "var(--font-body)" }}>
                <span style={{ color: "#f59e0b" }}>◆</span>
                <span>Your share so far: ~{shareEst.shares.toLocaleString()} shares ({shareEst.pct.toFixed(2)}%)</span>
              </Link>
            ) : (
              <p className="text-muted max-w-xl" style={{ fontSize: 10, fontFamily: "var(--font-body)", lineHeight: 1.6 }}>
                Every entry counts toward the equity pool, even on the free tier. Add entries, post stories, and show up daily to start building your share.{" "}
                <Link href="/equity" className="underline hover:text-foreground">How it works →</Link>
              </p>
            )}
          </div>
        )}

        {/* Earned today (token-game-feel brief D2/D3): the owner's daily token
            progress, shown for every tier including free. */}
        {isAuthUser(activePersonId) && <DailyTokenChip className="mb-6" />}

        {/* Quick-action row — wraps on narrow screens so the action buttons never
            push the row past the viewport and shrink the whole page (BUG-008).
            timelineRef anchors the scroll-into-view from a stat tile click (BUG-034). */}
        <div ref={timelineRef} className="flex flex-wrap items-center justify-between gap-2 mb-6">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black tracking-widest uppercase text-foreground">Timeline</h2>
            <button
              onClick={() => setTimelineOrder((o) => o === "desc" ? "asc" : "desc")}
              title={timelineOrder === "desc" ? "Showing newest first" : "Showing oldest first"}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted hover:text-foreground hover:bg-surface-hover border border-border-default transition-colors"
            >
              {timelineOrder === "desc" ? "↓ Newest" : "↑ Oldest"}
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setAddingStory(true)}
              className="px-3 py-2 rounded-lg bg-violet-700 text-white text-sm font-medium hover:bg-violet-600 transition-colors"
            >
              ✍ Add story
            </button>
            <button
              onClick={() => setAddingClaim(true)}
              className="px-3 py-2 rounded-lg bg-[#1C1917] text-white text-sm font-medium hover:bg-[#292524] transition-colors"
            >
              + Add claim
            </button>
          </div>
        </div>

        {/* Invite-discovery prompt: surfaces unclaimed riders the viewer has tagged */}
        {isAuthUser(activePersonId) && catalogLoaded && (
          <BulkInvitePrompt
            activePersonId={activePersonId}
            claims={personClaims}
            allClaims={allClaims}
            stories={stories}
            people={catalog.people}
          />
        )}

        {/* Membership upsell for free users with 20+ entries (replaces old milestone cards) */}
        {membership.tier === "free" && personClaims.length >= 20 && !triggerPrefs.milestone_card_20_dismissed && (
          <div className="mb-4 p-4 rounded-xl border"
            style={{ borderColor: "#f59e0b30", background: "#f59e0b08", fontFamily: "var(--font-body)" }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-foreground" style={{ fontSize: 11, lineHeight: 1.7 }}>
                  <strong>You&apos;ve added {personClaims.length} entries to the collective history.</strong><br />
                  Members earn tokens for every verified entry, including these.
                </p>
                <Link href="/membership"
                  className="inline-block mt-2 text-blue-400 hover:text-blue-300 transition-colors"
                  style={{ fontSize: 10 }}>
                  What is membership? →
                </Link>
              </div>
              <button onClick={() => setTriggerPrefs({ milestone_card_20_dismissed: true })}
                className="text-muted hover:text-foreground shrink-0 transition-colors"
                style={{ fontSize: 14, background: "none", border: "none", cursor: "pointer" }}>
                ×
              </button>
            </div>
          </div>
        )}

        {/* Feed */}
        <FeedView
          claims={personClaims}
          days={myDays}
          stories={stories}
          personName={person?.display_name ?? "Your"}
          isOwn={true}
          hideActionButtons={true}
          ridingSince={person?.riding_since}
          person={person ?? undefined}
          onStoryAdded={(s) => setStories((prev) => [s, ...prev])}
          onStoryDeleted={(id) => setStories((prev) => prev.filter((s) => s.id !== id))}
          order={timelineOrder}
          animateEntrance={animateEntrance}
          filter={timelineFilter}
          onFilterChange={setTimelineFilter}
        />

        {/* Contributions: stories the owner authored but kept off their own
            timeline. Owner view, so each card keeps the edit/delete menu and Jay
            can re-toggle a story back onto his timeline from here. Renders
            nothing when there are none (no empty header). */}
        {contributions.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-black tracking-widest uppercase text-foreground">Contributions</h2>
            <p className="text-xs text-muted mt-1 mb-5">Stories you added to other pages, kept off your timeline.</p>
            {contributions.map((s) => (
              <StoryCard
                key={s.id}
                story={s}
                isOwn
                onDelete={(id) => setContributions((prev) => prev.filter((x) => x.id !== id))}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
