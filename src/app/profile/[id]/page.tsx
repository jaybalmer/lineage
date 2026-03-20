"use client"

import { use, useState, useEffect } from "react"
import { Nav } from "@/components/ui/nav"
import { PEOPLE, CLAIMS, getPersonById, getSharedContext } from "@/lib/mock-data"
import { FeedView } from "@/components/feed/feed-view"
import { useLineageStore, getAllClaims, isAuthUser } from "@/store/lineage-store"
import { supabase } from "@/lib/supabase"
import { RiderAvatar } from "@/components/ui/rider-avatar"
import Link from "next/link"
import { notFound } from "next/navigation"
import type { Claim, Person } from "@/types"

export default function ProfileDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { activePersonId, profileOverride, sessionClaims, dbClaims, deletedClaimIds, claimOverrides } = useLineageStore()
  const isCurrentUser = id === activePersonId

  // Redirect current user to /profile
  if (isCurrentUser) {
    // Can't call redirect in a hook — use Link instead in the return
  }

  const basePerson = getPersonById(id)
  const [realPerson, setRealPerson] = useState<Person | null>(null)
  const [personBClaims, setPersonBClaims] = useState<Claim[]>([])

  const mockIds = new Set(PEOPLE.map((p) => p.id))

  // Load real profile + public claims if not a mock person
  useEffect(() => {
    if (mockIds.has(id)) return
    supabase
      .from("profiles")
      .select("id, display_name, birth_year, riding_since, privacy_level, bio, home_resort_id")
      .eq("id", id)
      .single()
      .then(({ data }) => {
        if (data) {
          setRealPerson({
            id: data.id,
            display_name: data.display_name,
            birth_year: data.birth_year ?? undefined,
            riding_since: data.riding_since ?? undefined,
            privacy_level: data.privacy_level as "public",
            bio: data.bio ?? undefined,
            home_resort_id: data.home_resort_id ?? undefined,
          })
        }
      })
    supabase
      .from("claims")
      .select("*")
      .eq("subject_id", id)
      .eq("visibility", "public")
      .then(({ data }) => setPersonBClaims((data ?? []) as Claim[]))
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!basePerson && !realPerson && mockIds.has(id)) notFound()

  const person = isCurrentUser
    ? { ...(basePerson ?? {}), ...profileOverride } as Person
    : (realPerson ?? basePerson)

  if (!person) {
    return (
      <div className="min-h-screen bg-background">
        <Nav />
        <div className="max-w-3xl mx-auto px-4 py-16 text-center text-muted">Loading…</div>
      </div>
    )
  }

  const allClaims = getAllClaims(sessionClaims, dbClaims, deletedClaimIds, claimOverrides, activePersonId)
  const personClaims = mockIds.has(id)
    ? CLAIMS.filter((c) => c.subject_id === id)
    : (isAuthUser(id) ? personBClaims : allClaims.filter((c) => c.subject_id === id))

  const { sharedPlaces, sharedEvents } = isCurrentUser
    ? { sharedPlaces: [], sharedEvents: [] }
    : getSharedContext(activePersonId, id)

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <div className="max-w-3xl mx-auto px-4 py-10">

        {/* Breadcrumb */}
        <div className="text-xs text-muted mb-6">
          <Link href="/connections" className="hover:text-foreground">Connections</Link>
          <span className="mx-2">/</span>
          <span className="text-muted">{person.display_name}</span>
        </div>

        {/* Profile header */}
        <div className="flex items-start gap-5 mb-6">
          <RiderAvatar person={person} size="xl" ring={!!(person.membership_tier && person.membership_tier !== "free")} className="flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-foreground">{person.display_name}</h1>
              {!isCurrentUser && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link href={`/compare?b=${id}`}>
                    <button className="px-3 py-1.5 rounded-lg bg-surface-hover border border-border-default text-xs text-muted hover:border-border-default hover:text-foreground transition-all">
                      Compare ⬡
                    </button>
                  </Link>
                  <Link href={`/connections/${id}`}>
                    <button className="px-3 py-1.5 rounded-lg bg-blue-600 text-xs text-foreground font-medium hover:bg-blue-500 transition-all">
                      View connection →
                    </button>
                  </Link>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted flex-wrap">
              {person.birth_year && <span>b. {person.birth_year}</span>}
              {person.riding_since && <span>Riding since {person.riding_since}</span>}
            </div>
            {person.bio && (
              <p className="text-sm text-muted mt-2 leading-relaxed">{person.bio}</p>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="flex gap-6 pb-5 mb-6 border-b border-border-default">
          {[
            { label: "claims", value: personClaims.length },
            { label: "places", value: personClaims.filter((c) => c.predicate === "rode_at").length },
            { label: "boards", value: personClaims.filter((c) => c.predicate === "owned_board").length },
            { label: "connections", value: personClaims.filter((c) => c.predicate === "rode_with").length },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <div className="text-lg font-bold text-foreground">{value}</div>
              <div className="text-[11px] text-muted">{label}</div>
            </div>
          ))}
        </div>

        {/* Shared context */}
        {!isCurrentUser && (sharedPlaces.length > 0 || sharedEvents.length > 0) && (
          <div className="bg-blue-950/30 border border-blue-900/40 rounded-xl p-4 mb-6">
            <div className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-3">You both…</div>
            <div className="flex flex-wrap gap-2">
              {sharedPlaces.map(({ place }) => (
                <span key={place.id} className="text-xs px-3 py-1.5 bg-blue-900/30 border border-blue-800/40 rounded-lg text-blue-200">
                  🏔 Rode {place.name}
                </span>
              ))}
              {sharedEvents.map(({ event }) => (
                <span key={event.id} className="text-xs px-3 py-1.5 bg-blue-900/30 border border-blue-800/40 rounded-lg text-blue-200">
                  🏆 {event.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Feed — StartCard injected at riding_start milestone position */}
        <FeedView
          claims={personClaims}
          personName={person.display_name}
          isOwn={isCurrentUser}
          ridingSince={person.riding_since}
          person={person}
        />
      </div>
    </div>
  )
}
