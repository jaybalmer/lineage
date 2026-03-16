"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Nav } from "@/components/ui/nav"
import { FeedView } from "@/components/feed/feed-view"
import { StartCard } from "@/components/feed/start-card"
import { useLineageStore, getAllClaims, isAuthUser } from "@/store/lineage-store"
import { getPersonById, PLACES } from "@/lib/mock-data"
import { EditProfileModal, getLinkIcon } from "@/components/ui/edit-profile-modal"
import { AddClaimModal } from "@/components/ui/add-claim-modal"
import { AddDayModal } from "@/components/ui/add-day-modal"
import { TimelinePlayer } from "@/components/ui/timeline-player"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import type { Claim, PrivacyLevel } from "@/types"

const TIER_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  annual:   { label: "MEMBER",            color: "#3b82f6", bg: "#3b82f620" },
  lifetime: { label: "LIFETIME MEMBER",   color: "#8b5cf6", bg: "#8b5cf620" },
  founding: { label: "FOUNDING MEMBER ✦", color: "#f59e0b", bg: "#f59e0b20" },
}

export default function ProfilePage() {
  const router = useRouter()
  const { activePersonId, sessionClaims, dbClaims, setDbClaims, deletedClaimIds, claimOverrides, profileOverride, ridingDays, membership, triggerPrefs, setTriggerPrefs } = useLineageStore()
  const myDays = ridingDays.filter((d) => d.created_by === activePersonId)
  const [editingProfile, setEditingProfile] = useState(false)
  const [addingClaim, setAddingClaim] = useState(false)
  const [addingDay, setAddingDay] = useState(false)
  const [playingTimeline, setPlayingTimeline] = useState(false)

  // Redirect to sign-in if not authenticated
  useEffect(() => {
    if (!isAuthUser(activePersonId)) {
      router.replace("/auth/signin")
    }
  }, [activePersonId, router])

  const basePerson = getPersonById(activePersonId)
  const person = basePerson
    ? { ...basePerson, ...profileOverride }
    : Object.keys(profileOverride).length > 0
      ? { id: activePersonId, ...profileOverride } as typeof basePerson & typeof profileOverride
      : null

  // Load profile + DB claims on mount for authenticated users
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
        if (error?.code === "PGRST301" || error?.message?.includes("JWT")) {
          store.setActivePersonId("")
        }
      })
  }, [activePersonId]) // eslint-disable-line react-hooks/exhaustive-deps

  const allClaims = getAllClaims(sessionClaims, dbClaims, deletedClaimIds, claimOverrides, activePersonId)
  const personClaims = allClaims.filter((c) => c.subject_id === activePersonId)

  const homeResort = person?.home_resort_id
    ? PLACES.find((p) => p.id === (person as { home_resort_id?: string }).home_resort_id)
    : null

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
      {addingDay && (
        <AddDayModal onClose={() => setAddingDay(false)} />
      )}
      {playingTimeline && person && (
        <TimelinePlayer
          person={person}
          claims={personClaims}
          onClose={() => setPlayingTimeline(false)}
        />
      )}

      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Profile header */}
        <div className="mb-8">
          <div className="flex items-start gap-5">
            <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-xl font-bold text-foreground flex-shrink-0">
              {person?.display_name?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="min-w-0 flex-1">
              {/* Member badge */}
              {TIER_BADGE[membership.tier] && (
                <div className="mb-1">
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold"
                    style={{
                      background: TIER_BADGE[membership.tier].bg,
                      color: TIER_BADGE[membership.tier].color,
                      fontSize: 9,
                      letterSpacing: 1,
                      fontFamily: "'IBM Plex Mono', monospace",
                    }}>
                    {TIER_BADGE[membership.tier].label}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-foreground">{person?.display_name ?? "Your profile"}</h1>
                <button
                  onClick={() => setPlayingTimeline(true)}
                  title="Play timeline"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-background text-xs font-semibold hover:opacity-80 transition-opacity"
                >
                  <span className="text-[10px]">▶</span>
                  <span>My Timeline</span>
                </button>
                <button
                  onClick={() => setEditingProfile(true)}
                  className="text-xs text-muted hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-surface-active"
                >
                  Edit
                </button>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted flex-wrap">
                {person?.birth_year && <span>b. {person.birth_year}</span>}
                {person?.riding_since && <span>Riding since {person.riding_since}</span>}
                {homeResort && <span>🏔 {homeResort.name}</span>}
              </div>
              {person?.bio && (
                <p className="text-sm text-muted mt-2 leading-relaxed max-w-lg">{person.bio}</p>
              )}
              {!person?.bio && (
                <button
                  onClick={() => setEditingProfile(true)}
                  className="mt-2 text-xs text-muted hover:text-muted transition-colors"
                >
                  + Add a bio
                </button>
              )}
              {person?.links && person.links.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {person.links.map((link, i) => (
                    <a
                      key={i}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-hover border border-border-default rounded-lg text-xs text-muted hover:text-foreground hover:border-border-default transition-all"
                    >
                      <span>{getLinkIcon(link.url)}</span>
                      <span>{link.label}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Token stats row — members only */}
          {membership.tier !== "free" && (
            <div className="flex items-center gap-4 mt-3 flex-wrap">
              <Link href="/account/membership"
                className="flex items-center gap-1.5 text-muted hover:text-foreground transition-colors"
                style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" }}>
                <span style={{ color: "#f59e0b" }}>◆</span>
                <span>{membership.token_balance.founder * 2 + membership.token_balance.member + membership.token_balance.contribution} tokens</span>
              </Link>
              <span className="text-muted" style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" }}>· Revenue share active</span>
            </div>
          )}

          {/* Stats + action row */}
          <div className="flex items-center justify-between mt-5 pt-5 border-t border-border-default">
            <span className="text-sm text-muted">
              <span className="text-foreground font-bold">{personClaims.length}</span> claims
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setAddingDay(true)}
                className="px-3 py-2 rounded-lg bg-emerald-800 text-white text-sm font-medium hover:bg-emerald-700 transition-colors flex items-center gap-1.5"
              >
                ☀️ Log day
              </button>
              <button
                onClick={() => setAddingClaim(true)}
                className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors"
              >
                + Add claim
              </button>
            </div>
          </div>
        </div>

        {/* Contribution milestone card — non-members only, on own profile */}
        {membership.tier === "free" && (
          (personClaims.length >= 20 && !triggerPrefs.milestone_card_20_dismissed) ? (
            <div className="mb-4 p-4 rounded-xl border"
              style={{ borderColor: "#3b82f630", background: "#3b82f608", fontFamily: "'IBM Plex Mono', monospace" }}>
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
          ) : personClaims.length >= 5 && !triggerPrefs.milestone_card_5_dismissed ? (
            <div className="mb-4 p-4 rounded-xl border"
              style={{ borderColor: "#3b82f630", background: "#3b82f608", fontFamily: "'IBM Plex Mono', monospace" }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-foreground" style={{ fontSize: 11, lineHeight: 1.7 }}>
                    <strong>You&apos;ve added {personClaims.length} entries to the collective history.</strong><br />
                    Your contributions are making the record more complete.<br />
                    Members earn tokens for every verified entry — including these.
                  </p>
                  <Link href="/membership"
                    className="inline-block mt-2 text-blue-400 hover:text-blue-300 transition-colors"
                    style={{ fontSize: 10 }}>
                    What is membership? →
                  </Link>
                </div>
                <button onClick={() => setTriggerPrefs({ milestone_card_5_dismissed: true })}
                  className="text-muted hover:text-foreground shrink-0 transition-colors"
                  style={{ fontSize: 14, background: "none", border: "none", cursor: "pointer" }}>
                  ×
                </button>
              </div>
            </div>
          ) : null
        )}

        {/* Origin card */}
        {person && <StartCard person={person} claims={personClaims} isOwn={true} />}

        {/* Feed */}
        <FeedView
          claims={personClaims}
          days={myDays}
          personName={person?.display_name ?? "Your"}
          isOwn={true}
          hideActionButtons={true}
        />
      </div>
    </div>
  )
}
