"use client"

import { use } from "react"
import { Nav } from "@/components/ui/nav"
import { PEOPLE, CLAIMS, getPersonById, getEntityName, getSharedContext } from "@/lib/mock-data"
import { TimelineView } from "@/components/timeline/timeline-view"
import { useLineageStore } from "@/store/lineage-store"
import { formatDateRange } from "@/lib/utils"
import Link from "next/link"
import { notFound } from "next/navigation"

export default function RiderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { activePersonId, profileOverride } = useLineageStore()
  const isCurrentUser = id === activePersonId

  const basePerson = getPersonById(id)
  if (!basePerson) notFound()
  const person = isCurrentUser ? { ...basePerson, ...profileOverride } : basePerson

  const personClaims = CLAIMS.filter((c) => c.subject_id === id)

  const { sharedPlaces, sharedEvents } = isCurrentUser
    ? { sharedPlaces: [], sharedEvents: [] }
    : getSharedContext(activePersonId, id)

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Nav />
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Breadcrumb */}
        <div className="text-xs text-zinc-600 mb-6">
          <Link href="/connections" className="hover:text-zinc-400">Connections</Link>
          <span className="mx-2">/</span>
          <span className="text-zinc-400">{person.display_name}</span>
        </div>

        {/* Profile header */}
        <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center text-xl font-bold text-white flex-shrink-0">
              {person.display_name[0]}
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-white">{person.display_name}</h1>
              {person.birth_year && <p className="text-zinc-500 text-sm">b. {person.birth_year}</p>}
              {person.bio && <p className="text-zinc-400 text-sm mt-2 leading-relaxed">{person.bio}</p>}
            </div>
            <div className="flex-shrink-0 flex gap-2">
              {!isCurrentUser && (
                <>
                  <Link href={`/compare?b=${id}`}>
                    <button className="px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-xs text-zinc-300 hover:border-zinc-500 hover:text-white transition-all">
                      Compare ⬡
                    </button>
                  </Link>
                  <Link href={`/connections/${id}`}>
                    <button className="px-3 py-1.5 rounded-lg bg-blue-600 text-xs text-white font-medium hover:bg-blue-500 transition-all">
                      View connection →
                    </button>
                  </Link>
                  <button className="px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-xs text-zinc-300 hover:border-zinc-500 hover:text-white transition-all">
                    Request verification
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Shared context (shown if viewing another rider) */}
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

        <div className="grid grid-cols-[1fr_260px] gap-6">
          <TimelineView claims={personClaims} personName={person.display_name} isOwn={isCurrentUser} />

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-4 space-y-3">
              <div className="text-xs font-semibold text-zinc-600 uppercase tracking-widest">Stats</div>
              {[
                { label: "Claims", value: personClaims.length },
                { label: "Places", value: personClaims.filter((c) => c.predicate === "rode_at").length },
                { label: "Gear", value: personClaims.filter((c) => c.predicate === "owned_board").length },
                { label: "Connections", value: personClaims.filter((c) => c.predicate === "rode_with").length },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-zinc-500">{label}</span>
                  <span className="font-semibold text-white">{value}</span>
                </div>
              ))}
            </div>

            {/* Sponsors */}
            {personClaims.filter((c) => c.predicate === "sponsored_by").length > 0 && (
              <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-4">
                <div className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-3">Sponsors</div>
                {personClaims.filter((c) => c.predicate === "sponsored_by").map((c) => (
                  <div key={c.id} className="text-sm py-1">
                    <span className="text-white">{getEntityName(c.object_id, c.object_type)}</span>
                    <span className="text-zinc-600 text-xs ml-2">{formatDateRange(c.start_date, c.end_date)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
