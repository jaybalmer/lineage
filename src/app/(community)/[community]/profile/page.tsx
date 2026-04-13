"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Nav } from "@/components/ui/nav"
import { FeedView } from "@/components/feed/feed-view"
import { useLineageStore, getAllClaims, isAuthUser } from "@/store/lineage-store"
import { getPersonById, PLACES } from "@/lib/mock-data"
import { EditProfileModal } from "@/components/ui/edit-profile-modal"
import { RiderCard } from "@/components/ui/rider-card"
import { AddClaimModal } from "@/components/ui/add-claim-modal"
import { AddStoryModal } from "@/components/ui/add-story-modal"
import { TimelinePlayer } from "@/components/ui/timeline-player"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import type { Claim, PrivacyLevel, Story, TriggerPrefs } from "@/types"

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
      ? `This board is from ${board!.model_year} — you're preserving a piece of snowboard history.`
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
      body: "The people you ride with are part of your lineage. Your network in the community just grew.",
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
    title: "Your first entry — timeline started",
    body: "Every epic timeline starts with a single entry. Yours is now on the record.",
    nextThread: "Add 4 more to unlock your founding rider badge.",
    accentColor: "#22c55e",
    contentType: "milestone" as const,
  }
  if (count === 5) return {
    tier: 3 as const,
    icon: "⚡",
    title: "5 entries — your timeline is coming to life",
    body: "You're building something real. 5 entries means the shape of your riding career is starting to show.",
    nextThread: "Keep going — 10 entries and you're in the top 10% of contributors.",
    accentColor: "#3b82f6",
    contentType: "milestone" as const,
  }
  if (count === 10) return {
    tier: 3 as const,
    icon: "🔥",
    title: "10 entries — double digits",
    body: "You're not just a member, you're a contributor. Your timeline is one of the most complete in the community.",
    nextThread: "Share your profile link — your lineage is worth showing off.",
    accentColor: "#f59e0b",
    contentType: "milestone" as const,
  }
  return null
}

// ─── FTUE first-session step guide ───────────────────────────────────────────

const FTUE_STEPS = [
  { key: "ftue_added_board",     label: "Add your first board",     hint: "What did you ride first?" },
  { key: "ftue_added_event",     label: "Tag an event or contest",  hint: "Were you at anything?" },
  { key: "ftue_connected_person", label: "Connect with a rider",    hint: "Who did you ride with?" },
  { key: "ftue_shared_story",    label: "Share a story",            hint: "What's your favorite memory?" },
] as const

type FtueStepKey = typeof FTUE_STEPS[number]["key"]

function FtueGuide({ triggerPrefs, onAddClaim, onAddStory }: {
  triggerPrefs: TriggerPrefs
  onAddClaim: () => void
  onAddStory: () => void
}) {
  const { setTriggerPrefs } = useLineageStore()

  if (triggerPrefs.ftue_complete) return null

  const completedKeys = FTUE_STEPS.filter((s) => triggerPrefs[s.key]).map((s) => s.key)
  const completedCount = completedKeys.length
  const totalCount = FTUE_STEPS.length

  if (completedCount === totalCount) return null

  const progressPct = Math.round((completedCount / totalCount) * 100)

  return (
    <div style={{
      marginBottom: 20,
      padding:      "16px 18px",
      borderRadius: 12,
      background:   "#B8862A0A",
      border:       "1px solid #B8862A28",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#F5F2EE", letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'IBM Plex Mono', monospace" }}>
          First steps
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <p style={{ margin: 0, fontSize: 11, color: "#78716C", fontFamily: "'IBM Plex Mono', monospace" }}>
            {completedCount} of {totalCount}
          </p>
          <button
            onClick={() => setTriggerPrefs({ ftue_complete: true })}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#78716C", fontSize: 14, lineHeight: 1, padding: "0 2px" }}
          >
            ×
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: "#B8862A20", borderRadius: 2, marginBottom: 14, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${progressPct}%`, background: "#B8862A", borderRadius: 2, transition: "width 0.4s ease" }} />
      </div>

      {/* Steps */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {FTUE_STEPS.map((step) => {
          const done = Boolean(triggerPrefs[step.key as FtueStepKey])
          const isStory = step.key === "ftue_shared_story"
          return (
            <div key={step.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                background:  done ? "#B8862A" : "transparent",
                border:      done ? "none" : "1.5px solid #B8862A44",
                display:     "flex", alignItems: "center", justifyContent: "center",
                transition:  "background 0.3s ease",
              }}>
                {done && <span style={{ fontSize: 10, color: "#1C1917", fontWeight: 700 }}>✓</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 12, color: done ? "#78716C" : "#F5F2EE", textDecoration: done ? "line-through" : "none", transition: "color 0.2s" }}>
                  {step.label}
                </span>
                {!done && (
                  <span style={{ fontSize: 11, color: "#78716C", marginLeft: 6 }}>
                    — {step.hint}
                  </span>
                )}
              </div>
              {!done && (
                <button
                  onClick={isStory ? onAddStory : onAddClaim}
                  style={{
                    padding:      "3px 10px",
                    borderRadius: 6,
                    fontSize:     11,
                    fontWeight:   500,
                    cursor:       "pointer",
                    border:       "1px solid #B8862A44",
                    background:   "transparent",
                    color:        "#B8862A",
                    flexShrink:   0,
                    transition:   "background 0.15s",
                  }}
                  onMouseEnter={(e) => { (e.target as HTMLElement).style.background = "#B8862A18" }}
                  onMouseLeave={(e) => { (e.target as HTMLElement).style.background = "transparent" }}
                >
                  Add
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter()
  const {
    activePersonId, authReady, sessionClaims, dbClaims, setDbClaims,
    deletedClaimIds, claimOverrides, profileOverride, ridingDays,
    membership, triggerPrefs, setTriggerPrefs, setShowMemberCard,
    catalog, catalogLoaded, queueCelebration, setShowWelcomeCelebration,
  } = useLineageStore()

  const myDays = ridingDays.filter((d) => d.created_by === activePersonId)
  const [editingProfile, setEditingProfile]   = useState(false)
  const [addingClaim,    setAddingClaim]       = useState(false)
  const [addingStory,    setAddingStory]       = useState(false)
  const [playingTimeline, setPlayingTimeline]  = useState(false)
  const [timelineOrder,  setTimelineOrder]     = useState<"asc" | "desc">("desc")
  const [stories,        setStories]           = useState<Story[]>([])

  // Track previous claim count to detect new additions
  const prevClaimCountRef = useRef<number | null>(null)
  const welcomeFiredRef   = useRef(false)

  useEffect(() => {
    if (!authReady) return
    if (!isAuthUser(activePersonId)) {
      router.replace("/auth/signin")
    }
  }, [authReady, activePersonId, router])

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
        }
      })

    supabase
      .from("claims")
      .select("*")
      .eq("subject_id", activePersonId)
      .then(({ data, error }) => {
        if (!error && data) setDbClaims(data as Claim[])
      })

    fetch(`/api/stories?author_id=${activePersonId}&limit=100`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setStories(data as Story[]) })
  }, [activePersonId]) // eslint-disable-line react-hooks/exhaustive-deps

  const allClaims    = getAllClaims(sessionClaims, dbClaims, deletedClaimIds, claimOverrides, activePersonId)
  const personClaims = allClaims.filter((c) => c.subject_id === activePersonId)

  // Detect new claim additions and fire contextual celebration + milestone checks
  useEffect(() => {
    const count = personClaims.length
    const prev  = prevClaimCountRef.current

    if (prev === null) {
      prevClaimCountRef.current = count
      return
    }

    if (count > prev) {
      // A new claim was just added — fire contextual celebration
      const newClaim = personClaims[personClaims.length - 1]
      if (newClaim && catalogLoaded) {
        const celebration = getCelebrationForNewClaim(newClaim, count, catalog)
        queueCelebration(celebration)

        // Update FTUE step tracking
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

      // Check milestones (fire after a brief delay so contextual fires first)
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
  }, [personClaims.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Detect new story additions and fire celebration + step tracking
  const prevStoriesCountRef = useRef<number | null>(null)
  useEffect(() => {
    const count = stories.length
    const prev  = prevStoriesCountRef.current
    if (prev === null) { prevStoriesCountRef.current = count; return }
    if (count > prev) {
      if (!triggerPrefs.ftue_shared_story) {
        setTriggerPrefs({ ftue_shared_story: true })
      }
      const latestStory = stories[0]
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
  }, [stories.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const homeResort = person?.home_resort_id
    ? PLACES.find((p) => p.id === (person as { home_resort_id?: string }).home_resort_id)
    : null

  // Check all FTUE steps complete
  useEffect(() => {
    if (triggerPrefs.ftue_complete) return
    const allDone = FTUE_STEPS.every((s) => Boolean(triggerPrefs[s.key as FtueStepKey]))
    if (allDone) {
      setTriggerPrefs({ ftue_complete: true })
      queueCelebration({
        tier: 3,
        icon: "🎉",
        title: "First session complete",
        body: "You've added a board, tagged an event, connected with a rider, and shared a story. Your timeline is alive.",
        nextThread: "Keep building — the more you add, the richer the collective history gets.",
        accentColor: "#B8862A",
        contentType: "milestone",
      })
    }
  }, [triggerPrefs.ftue_added_board, triggerPrefs.ftue_added_event, triggerPrefs.ftue_connected_person, triggerPrefs.ftue_shared_story]) // eslint-disable-line react-hooks/exhaustive-deps

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
        <AddClaimModal onClose={() => setAddingClaim(false)} />
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
          />
        )}

        {/* Token stats — members only */}
        {membership.tier !== "free" && (
          <div className="flex items-center gap-4 mb-4 flex-wrap">
            <Link href="/account/membership"
              className="flex items-center gap-1.5 text-muted hover:text-foreground transition-colors"
              style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" }}>
              <span style={{ color: "#f59e0b" }}>◆</span>
              <span>{membership.token_balance.founder * 2 + membership.token_balance.member + membership.token_balance.contribution} tokens</span>
            </Link>
            <span className="text-muted" style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" }}>· Revenue share active</span>
          </div>
        )}

        {/* Quick-action row */}
        <div className="flex items-center justify-between gap-2 mb-6">
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
              className="px-3 py-2 rounded-lg bg-[#1C1917] text-[#F5F2EE] text-sm font-medium hover:bg-[#292524] transition-colors"
            >
              + Add claim
            </button>
          </div>
        </div>

        {/* FTUE first-session guide — shown until all steps complete */}
        {isAuthUser(activePersonId) && (
          <FtueGuide
            triggerPrefs={triggerPrefs}
            onAddClaim={() => setAddingClaim(true)}
            onAddStory={() => setAddingStory(true)}
          />
        )}

        {/* Membership upsell for free users with 20+ entries (replaces old milestone cards) */}
        {membership.tier === "free" && personClaims.length >= 20 && !triggerPrefs.milestone_card_20_dismissed && (
          <div className="mb-4 p-4 rounded-xl border"
            style={{ borderColor: "#B8862A30", background: "#B8862A08", fontFamily: "'IBM Plex Mono', monospace" }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-foreground" style={{ fontSize: 11, lineHeight: 1.7 }}>
                  <strong>You&apos;ve added {personClaims.length} entries to the collective history.</strong><br />
                  Members earn tokens for every verified entry — including these.
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
        />
      </div>
    </div>
  )
}
