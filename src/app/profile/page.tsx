"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Nav } from "@/components/ui/nav"
import { FeedView } from "@/components/feed/feed-view"
import { useLineageStore, getAllClaims, isAuthUser } from "@/store/lineage-store"
import { getPersonById, PLACES } from "@/lib/mock-data"
import { EditProfileModal } from "@/components/ui/edit-profile-modal"
import { RiderCard } from "@/components/ui/rider-card"
import { AddClaimModal } from "@/components/ui/add-claim-modal"
import { AddDayModal } from "@/components/ui/add-day-modal"
import { TimelinePlayer } from "@/components/ui/timeline-player"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import type { Claim, PrivacyLevel } from "@/types"

export default function ProfilePage() {
  const router = useRouter()
  const { activePersonId, authReady, sessionClaims, dbClaims, setDbClaims, deletedClaimIds, claimOverrides, profileOverride, ridingDays, membership, triggerPrefs, setTriggerPrefs, setShowMemberCard } = useLineageStore()
  const myDays = ridingDays.filter((d) => d.created_by === activePersonId)
  const [editingProfile, setEditingProfile] = useState(false)
  const [addingClaim, setAddingClaim] = useState(false)
  const [addingDay, setAddingDay] = useState(false)
  const [playingTimeline, setPlayingTimeline] = useState(false)

  // Redirect to sign-in only after the server-validated auth check completes.
  // Waiting for authReady prevents false sign-outs when the JWT is expired
  // but the refresh token is still valid (getUser() handles the refresh).
  useEffect(() => {
    if (!authReady) return
    if (!isAuthUser(activePersonId)) {
      router.replace("/auth/signin")
    }
  }, [authReady, activePersonId, router])

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
        // Note: JWT errors here are NOT used to sign the user out.
        // catalog-loader's getUser() is the authoritative auth check — it
        // handles token refresh and will clear state if truly unauthenticated.
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
          <h2 className="text-2xl font-black tracking-widest uppercase text-foreground">Timeline</h2>
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

        {/* Feed — StartCard is injected inside at the riding_start milestone position */}
        <FeedView
          claims={personClaims}
          days={myDays}
          personName={person?.display_name ?? "Your"}
          isOwn={true}
          hideActionButtons={true}
          ridingSince={person?.riding_since}
          person={person ?? undefined}
        />
      </div>
    </div>
  )
}
