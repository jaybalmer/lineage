"use client"

import { use } from "react"
import { Nav } from "@/components/ui/nav"
import { PLACES, CLAIMS, PEOPLE, getPersonById } from "@/lib/mock-data"
import { formatDateRange } from "@/lib/utils"
import Link from "next/link"
import { notFound } from "next/navigation"

const DECADE_RANGE = Array.from({ length: 4 }, (_, i) => `${(199 + i) * 10}s`)

export default function PlacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const place = PLACES.find((p) => p.id === id)
  if (!place) notFound()

  const rideClaims = CLAIMS.filter((c) => c.object_id === id && c.predicate === "rode_at")
  const workClaims = CLAIMS.filter((c) => c.object_id === id && c.predicate === "worked_at")

  const riderIds = [...new Set(rideClaims.map((c) => c.subject_id))]
  const staffIds = [...new Set(workClaims.map((c) => c.subject_id))]

  // Group riders by era
  const byDecade: Record<string, string[]> = {}
  for (const claim of rideClaims) {
    const year = claim.start_date ? parseInt(claim.start_date.slice(0, 4)) : 0
    const decade = year ? `${Math.floor(year / 10) * 10}s` : "Unknown"
    if (!byDecade[decade]) byDecade[decade] = []
    if (!byDecade[decade].includes(claim.subject_id)) byDecade[decade].push(claim.subject_id)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Nav />
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Breadcrumb */}
        <div className="text-xs text-zinc-600 mb-6">
          <Link href="/places" className="hover:text-zinc-400">Places</Link>
          <span className="mx-2">/</span>
          <span className="text-zinc-400">{place.name}</span>
        </div>

        {/* Header */}
        <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-zinc-600 uppercase tracking-widest">{place.place_type}</span>
              </div>
              <h1 className="text-2xl font-bold text-white">{place.name}</h1>
              {place.region && (
                <p className="text-zinc-500 mt-1">{place.region}{place.country ? `, ${place.country}` : ""}</p>
              )}
            </div>
            <div className="text-right space-y-1">
              {place.osm_id && (
                <div className="text-xs text-zinc-600">
                  <span className="text-zinc-700">OSM</span> <span className="font-mono text-zinc-600">{place.osm_id}</span>
                </div>
              )}
              {place.wikidata_qid && (
                <div className="text-xs text-zinc-700">
                  <span>Wikidata</span> <span className="font-mono">{place.wikidata_qid}</span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 flex gap-4 text-sm">
            <div className="text-center">
              <div className="font-bold text-white text-lg">{riderIds.length}</div>
              <div className="text-zinc-600 text-xs">riders</div>
            </div>
            <div className="w-px bg-[#2a2a2a]" />
            <div className="text-center">
              <div className="font-bold text-white text-lg">{Object.keys(byDecade).length}</div>
              <div className="text-zinc-600 text-xs">decades</div>
            </div>
            <div className="w-px bg-[#2a2a2a]" />
            <div className="text-center">
              <div className="font-bold text-white text-lg">{rideClaims.length}</div>
              <div className="text-zinc-600 text-xs">claims</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_280px] gap-6">
          {/* Place Playback — by decade */}
          <div>
            <h2 className="text-sm font-semibold text-zinc-400 mb-4 uppercase tracking-widest">Riders by era</h2>
            {Object.keys(byDecade).sort().map((decade) => (
              <div key={decade} className="mb-6">
                <div className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-3 flex items-center gap-3">
                  <span>{decade}</span>
                  <div className="flex-1 h-px bg-[#1e1e1e]" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {byDecade[decade].map((riderId) => {
                    const rider = getPersonById(riderId)
                    if (!rider) return null
                    const claim = rideClaims.find((c) => c.subject_id === riderId)
                    return (
                      <Link key={riderId} href={`/riders/${riderId}`}>
                        <div className="flex items-center gap-2 p-2.5 bg-[#111] border border-[#1e1e1e] rounded-lg hover:border-[#333] transition-all">
                          <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-300 flex-shrink-0">
                            {rider.display_name[0]}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-white truncate">{rider.display_name}</div>
                            {claim?.start_date && (
                              <div className="text-[10px] text-zinc-600">{formatDateRange(claim.start_date, claim.end_date)}</div>
                            )}
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}

            {Object.keys(byDecade).length === 0 && (
              <div className="text-sm text-zinc-600 py-8 text-center">No riders documented yet for this place.</div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {staffIds.length > 0 && (
              <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-4">
                <div className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-3">People who worked here</div>
                {staffIds.map((id) => {
                  const person = getPersonById(id)
                  if (!person) return null
                  const claim = workClaims.find((c) => c.subject_id === id)
                  return (
                    <Link key={id} href={`/riders/${id}`}>
                      <div className="flex items-center gap-2 py-2 hover:text-blue-300 transition-colors">
                        <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-400">
                          {person.display_name[0]}
                        </div>
                        <div>
                          <div className="text-xs text-white">{person.display_name}</div>
                          {claim && <div className="text-[10px] text-zinc-600">{formatDateRange(claim.start_date, claim.end_date)}</div>}
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}

            <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-4">
              <div className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-3">Add a claim about this place</div>
              <p className="text-xs text-zinc-600 mb-3">Did you ride here? Work here? Compete here?</p>
              <button className="w-full px-3 py-2 bg-blue-600 rounded-lg text-xs text-white font-medium hover:bg-blue-500 transition-colors">
                + Add to my timeline
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
