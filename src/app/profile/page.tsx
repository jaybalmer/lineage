"use client"

import { useState, useEffect } from "react"
import { Nav } from "@/components/ui/nav"
import { FeedView } from "@/components/feed/feed-view"
import { StartCard } from "@/components/feed/start-card"
import { useLineageStore, getAllClaims, isAuthUser } from "@/store/lineage-store"
import { getPersonById, PLACES } from "@/lib/mock-data"
import { EditProfileModal } from "@/components/ui/edit-profile-modal"
import { supabase } from "@/lib/supabase"
import type { Claim, PrivacyLevel } from "@/types"

export default function ProfilePage() {
  const { activePersonId, sessionClaims, dbClaims, setDbClaims, deletedClaimIds, claimOverrides, profileOverride, ridingDays } = useLineageStore()
  const myDays = ridingDays.filter((d) => d.created_by === activePersonId)
  const [editingProfile, setEditingProfile] = useState(false)

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
          store.setActivePersonId("u1")
        }
      })
  }, [activePersonId]) // eslint-disable-line react-hooks/exhaustive-deps

  const allClaims = getAllClaims(sessionClaims, dbClaims, deletedClaimIds, claimOverrides, activePersonId)
  const personClaims = allClaims.filter((c) => c.subject_id === activePersonId)

  const homeResort = person?.home_resort_id
    ? PLACES.find((p) => p.id === (person as { home_resort_id?: string }).home_resort_id)
    : null

  const placesCount = personClaims.filter((c) => c.predicate === "rode_at").length
  const boardsCount = personClaims.filter((c) => c.predicate === "owned_board").length
  const connectionsCount = personClaims.filter((c) => c.predicate === "rode_with").length

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Nav />

      {editingProfile && person && (
        <EditProfileModal
          person={person}
          onClose={() => setEditingProfile(false)}
        />
      )}

      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Profile header */}
        <div className="mb-8">
          <div className="flex items-start gap-5">
            <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-xl font-bold text-white flex-shrink-0">
              {person?.display_name?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-white">{person?.display_name ?? "Your profile"}</h1>
                <button
                  onClick={() => setEditingProfile(true)}
                  className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors px-2 py-1 rounded hover:bg-[#1e1e1e]"
                >
                  Edit
                </button>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500 flex-wrap">
                {person?.birth_year && <span>b. {person.birth_year}</span>}
                {person?.riding_since && <span>Riding since {person.riding_since}</span>}
                {homeResort && <span>🏔 {homeResort.name}</span>}
              </div>
              {person?.bio && (
                <p className="text-sm text-zinc-400 mt-2 leading-relaxed max-w-lg">{person.bio}</p>
              )}
              {!person?.bio && (
                <button
                  onClick={() => setEditingProfile(true)}
                  className="mt-2 text-xs text-zinc-700 hover:text-zinc-500 transition-colors"
                >
                  + Add a bio
                </button>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className="flex gap-6 mt-5 pt-5 border-t border-[#1e1e1e]">
            {[
              { label: "claims", value: personClaims.length },
              { label: "places", value: placesCount },
              { label: "boards", value: boardsCount },
              { label: "connections", value: connectionsCount },
              { label: "days", value: myDays.length },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <div className="text-lg font-bold text-white">{value}</div>
                <div className="text-[11px] text-zinc-600">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Origin card */}
        {person && (
          <StartCard person={person} claims={personClaims} />
        )}

        {/* Feed */}
        <FeedView
          claims={personClaims}
          days={myDays}
          personName={person?.display_name ?? "Your"}
          isOwn={true}
        />
      </div>
    </div>
  )
}
