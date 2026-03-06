"use client"

import { useState, useEffect } from "react"
import { Nav } from "@/components/ui/nav"
import { TimelineView } from "@/components/timeline/timeline-view"
import { useLineageStore, getAllClaims, isAuthUser } from "@/store/lineage-store"
import { getPersonById, PLACES } from "@/lib/mock-data"
import { EditProfileModal } from "@/components/ui/edit-profile-modal"
import { supabase } from "@/lib/supabase"
import type { Claim, PrivacyLevel } from "@/types"

export default function TimelinePage() {
  const { activePersonId, sessionClaims, dbClaims, setDbClaims, deletedClaimIds, claimOverrides, profileOverride, ridingDays } = useLineageStore()
  const myDays = ridingDays.filter((d) => d.created_by === activePersonId)
  const [editingProfile, setEditingProfile] = useState(false)

  const basePerson = getPersonById(activePersonId)
  // For real auth users, basePerson may be null (they're not in mock data)
  const person = basePerson
    ? { ...basePerson, ...profileOverride }
    : Object.keys(profileOverride).length > 0
      ? { id: activePersonId, ...profileOverride } as typeof basePerson & typeof profileOverride
      : null

  // Load profile + DB claims on mount for authenticated users
  useEffect(() => {
    if (!isAuthUser(activePersonId)) return
    const store = useLineageStore.getState()

    // Load profile from DB so it always reflects what's in Supabase
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

    // Load claims from DB
    supabase
      .from("claims")
      .select("*")
      .eq("subject_id", activePersonId)
      .then(({ data, error }) => {
        if (!error && data) setDbClaims(data as Claim[])
        if (error?.code === "PGRST301" || error?.message?.includes("JWT")) {
          // Session expired — fall back to mock user
          store.setActivePersonId("u1")
        }
      })
  }, [activePersonId]) // eslint-disable-line react-hooks/exhaustive-deps

  const allClaims = getAllClaims(sessionClaims, dbClaims, deletedClaimIds, claimOverrides, activePersonId)
  const personClaims = allClaims.filter((c) => c.subject_id === activePersonId)

  const homeResort = person?.home_resort_id
    ? PLACES.find((p) => p.id === (person as { home_resort_id?: string }).home_resort_id)
    : null

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Nav />

      {editingProfile && person && (
        <EditProfileModal
          person={person}
          onClose={() => setEditingProfile(false)}
        />
      )}

      <div className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-[280px_1fr] gap-8">
        {/* Sidebar */}
        <aside className="space-y-4">
          {/* Profile card */}
          <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                  {person?.display_name?.[0]?.toUpperCase() ?? "?"}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-white text-sm truncate">{person?.display_name}</div>
                  <div className="text-xs text-zinc-500 mt-0.5 space-y-0.5">
                    {person?.birth_year && (
                      <div>b. {person.birth_year}</div>
                    )}
                    {person?.riding_since && (
                      <div>Riding since {person.riding_since}</div>
                    )}
                    {homeResort && (
                      <div className="truncate">🏔 {homeResort.name}</div>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setEditingProfile(true)}
                className="flex-shrink-0 text-xs text-zinc-600 hover:text-zinc-300 transition-colors px-2 py-1 rounded hover:bg-[#1e1e1e]"
                title="Edit profile"
              >
                Edit
              </button>
            </div>
            {person?.bio && (
              <p className="text-xs text-zinc-500 mt-3 leading-relaxed">{person.bio}</p>
            )}
            {!person?.bio && (
              <button
                onClick={() => setEditingProfile(true)}
                className="mt-3 text-xs text-zinc-700 hover:text-zinc-500 transition-colors"
              >
                + Add a bio
              </button>
            )}
          </div>

          {/* Stats */}
          <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-4 space-y-3">
            <div className="text-xs font-semibold text-zinc-600 uppercase tracking-widest">Your stats</div>
            {[
              { label: "Days logged", value: myDays.length },
              { label: "Claims", value: personClaims.length },
              { label: "Places ridden", value: personClaims.filter((c) => c.predicate === "rode_at").length },
              { label: "Boards", value: personClaims.filter((c) => c.predicate === "owned_board").length },
              { label: "Connections", value: personClaims.filter((c) => c.predicate === "rode_with").length },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between text-sm">
                <span className="text-zinc-500">{label}</span>
                <span className="font-semibold text-white">{value}</span>
              </div>
            ))}
          </div>

          {/* Confidence breakdown */}
          <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-4 space-y-2">
            <div className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-3">Provenance</div>
            {(["self-reported", "corroborated", "documented", "partner-verified"] as const).map((level) => {
              const count = personClaims.filter((c) => c.confidence === level).length
              const pct = personClaims.length ? Math.round((count / personClaims.length) * 100) : 0
              return (
                <div key={level}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-500 capitalize">{level.replace("-", " ")}</span>
                    <span className="text-zinc-400">{count}</span>
                  </div>
                  <div className="h-1 bg-[#1e1e1e] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </aside>

        {/* Main timeline */}
        <main>
          <TimelineView claims={personClaims} days={myDays} personName={person?.display_name ?? "Your"} isOwn={true} />
        </main>
      </div>
    </div>
  )
}
