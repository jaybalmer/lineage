"use client"

import { useState, useMemo } from "react"
import { Nav } from "@/components/ui/nav"
import { PEOPLE, CLAIMS, getPlaceById } from "@/lib/mock-data"
import { useLineageStore } from "@/store/lineage-store"
import Link from "next/link"

export default function PeoplePage() {
  const { activePersonId } = useLineageStore()
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return PEOPLE.filter((p) =>
      !q || p.display_name.toLowerCase().includes(q) || p.bio?.toLowerCase().includes(q)
    )
  }, [query])

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Nav />
      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-white">People</h1>
          <p className="text-sm text-zinc-500 mt-1">Riders who&apos;ve added their lineage</p>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 text-sm">⌕</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search riders…"
            className="w-full pl-8 pr-4 py-2 bg-[#111] border border-[#2a2a2a] rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
          />
        </div>

        {/* Rider list */}
        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className="text-sm text-zinc-600 text-center py-12 border border-dashed border-[#2a2a2a] rounded-xl">
              No riders found
            </div>
          )}
          {filtered.map((person) => {
            const isMe = person.id === activePersonId
            const claimCount = CLAIMS.filter((c) => c.subject_id === person.id).length
            const placeCount = CLAIMS.filter((c) => c.subject_id === person.id && c.predicate === "rode_at").length
            const homeResort = person.home_resort_id ? getPlaceById(person.home_resort_id) : null
            const href = isMe ? "/profile" : `/riders/${person.id}`

            return (
              <Link key={person.id} href={href}>
                <div className="flex items-center gap-4 px-4 py-3.5 bg-[#111] border border-[#1e1e1e] rounded-xl hover:border-[#2a2a2a] transition-all group">

                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold text-white shrink-0">
                    {person.display_name[0]}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-semibold text-white text-sm group-hover:text-blue-300 transition-colors">
                        {person.display_name}
                      </span>
                      {isMe && (
                        <span className="text-[10px] text-zinc-600 border border-[#2a2a2a] rounded px-1.5 py-0.5">you</span>
                      )}
                      {person.riding_since && (
                        <span className="text-[11px] text-zinc-600">riding since {person.riding_since}</span>
                      )}
                    </div>
                    {person.bio && (
                      <p className="text-xs text-zinc-500 mt-0.5 truncate">{person.bio}</p>
                    )}
                    {homeResort && (
                      <p className="text-[11px] text-zinc-700 mt-0.5">🏔 {homeResort.name}</p>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="shrink-0 text-right hidden sm:block">
                    <div className="text-xs font-semibold text-white">{claimCount}</div>
                    <div className="text-[10px] text-zinc-600">claim{claimCount !== 1 ? "s" : ""}</div>
                    {placeCount > 0 && (
                      <div className="text-[10px] text-zinc-700 mt-0.5">{placeCount} place{placeCount !== 1 ? "s" : ""}</div>
                    )}
                  </div>

                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
