"use client"

import { useState, useMemo } from "react"
import { Nav } from "@/components/ui/nav"
import { PEOPLE, CLAIMS, getPlaceById, getPersonById } from "@/lib/mock-data"
import { useLineageStore } from "@/store/lineage-store"
import { AddEntityModal } from "@/components/ui/add-entity-modal"
import Link from "next/link"
import type { Person } from "@/types"

function RiderRow({ person, isMe }: { person: Person; isMe: boolean }) {
  const claimCount = CLAIMS.filter((c) => c.subject_id === person.id).length
  const placeCount = CLAIMS.filter((c) => c.subject_id === person.id && c.predicate === "rode_at").length
  const homeResort = person.home_resort_id ? getPlaceById(person.home_resort_id) : null
  const href = isMe ? "/profile" : `/riders/${person.id}`
  const isUnverified = person.community_status === "unverified"
  const addedByPerson = person.added_by ? getPersonById(person.added_by) : null

  return (
    <Link href={href}>
      <div className="flex items-center gap-4 px-4 py-3.5 bg-surface border border-border-default rounded-xl hover:border-border-default transition-all group">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold text-foreground shrink-0">
          {person.display_name[0]}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-semibold text-foreground text-sm group-hover:text-blue-300 transition-colors">
              {person.display_name}
            </span>
            {isMe && (
              <span className="text-[10px] text-zinc-600 border border-border-default rounded px-1.5 py-0.5">you</span>
            )}
            {isUnverified && (
              <span className="text-[10px] text-amber-600 border border-amber-900/50 rounded px-1.5 py-0.5">unverified</span>
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
          {isUnverified && addedByPerson && (
            <div className="flex items-center gap-1 mt-1 text-[10px] text-zinc-700">
              <div className="w-3 h-3 rounded-full bg-zinc-800 flex items-center justify-center text-[8px] font-bold">
                {addedByPerson.display_name[0]}
              </div>
              Added by {addedByPerson.display_name}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="shrink-0 text-right hidden sm:block">
          {claimCount > 0 && (
            <>
              <div className="text-xs font-semibold text-foreground">{claimCount}</div>
              <div className="text-[10px] text-zinc-600">claim{claimCount !== 1 ? "s" : ""}</div>
            </>
          )}
          {placeCount > 0 && (
            <div className="text-[10px] text-zinc-700 mt-0.5">{placeCount} place{placeCount !== 1 ? "s" : ""}</div>
          )}
        </div>
      </div>
    </Link>
  )
}

export default function PeoplePage() {
  const { activePersonId, userEntities } = useLineageStore()
  const [query, setQuery] = useState("")
  const [addOpen, setAddOpen] = useState(false)

  const allPeople = [...PEOPLE, ...(userEntities.people ?? [])]

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allPeople.filter((p) =>
      !q || p.display_name.toLowerCase().includes(q) || p.bio?.toLowerCase().includes(q)
    )
  }, [query, allPeople.length])

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">People</h1>
            <p className="text-sm text-zinc-500 mt-1">Riders who&apos;ve added their lineage</p>
          </div>
          <button
            onClick={() => setAddOpen(true)}
            className="px-4 py-2 rounded-lg bg-blue-600 text-sm font-medium text-foreground hover:bg-blue-500 transition-all"
          >
            + Add rider
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 text-sm">⌕</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search riders…"
            className="w-full pl-8 pr-4 py-2 bg-surface border border-border-default rounded-xl text-sm text-foreground placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
          />
        </div>

        {/* Rider list */}
        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className="text-sm text-zinc-600 text-center py-12 border border-dashed border-border-default rounded-xl">
              No riders found.{" "}
              <button onClick={() => setAddOpen(true)} className="text-blue-500 hover:text-blue-400">Add one.</button>
            </div>
          )}
          {filtered.map((person) => (
            <RiderRow
              key={person.id}
              person={person}
              isMe={person.id === activePersonId}
            />
          ))}
        </div>
      </div>

      {addOpen && (
        <AddEntityModal
          entityType="person"
          onClose={() => setAddOpen(false)}
          onAdded={() => setAddOpen(false)}
        />
      )}
    </div>
  )
}
