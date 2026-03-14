"use client"

import { useState, useMemo } from "react"
import { Nav } from "@/components/ui/nav"
import { PEOPLE, CLAIMS, getPlaceById, getPersonById } from "@/lib/mock-data"
import { useLineageStore } from "@/store/lineage-store"
import { AddEntityModal } from "@/components/ui/add-entity-modal"
import { QuickClaimPopover } from "@/components/ui/quick-claim-popover"
import Link from "next/link"
import { cn } from "@/lib/utils"
import type { Person } from "@/types"

type SortTab = "all" | "origin" | "riders" | "resort"

const SORT_TABS: { id: SortTab; label: string; title: string }[] = [
  { id: "all",    label: "All",    title: "Sort by most claims" },
  { id: "origin", label: "Origin", title: "Group by decade started" },
  { id: "riders", label: "Riders", title: "Sort alphabetically" },
  { id: "resort", label: "Resort", title: "Group by home resort" },
]

function RiderRow({ person, isMe }: { person: Person; isMe: boolean }) {
  const claimCount = CLAIMS.filter((c) => c.subject_id === person.id).length
  const placeCount = CLAIMS.filter((c) => c.subject_id === person.id && c.predicate === "rode_at").length
  const homeResort = person.home_resort_id ? getPlaceById(person.home_resort_id) : null
  const href = isMe ? "/profile" : `/riders/${person.id}`
  const isUnverified = person.community_status === "unverified"
  const addedByPerson = person.added_by ? getPersonById(person.added_by) : null

  return (
    <div className="flex items-center gap-2">
      <Link href={href} className="flex-1 min-w-0 block group">
        <div className="flex items-center gap-4 px-4 py-3.5 bg-surface border border-border-default rounded-xl hover:bg-surface-hover transition-all">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold text-foreground shrink-0">
            {person.display_name[0]}
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="font-semibold text-foreground text-sm group-hover:text-blue-400 transition-colors">
                {person.display_name}
              </span>
              {isMe && (
                <span className="text-[10px] text-muted border border-border-default rounded px-1.5 py-0.5">you</span>
              )}
              {isUnverified && (
                <span className="text-[10px] text-amber-600 border border-amber-900/50 rounded px-1.5 py-0.5">unverified</span>
              )}
              {person.riding_since && (
                <span className="text-[11px] text-muted">riding since {person.riding_since}</span>
              )}
            </div>
            {person.bio && (
              <p className="text-xs text-muted mt-0.5 truncate">{person.bio}</p>
            )}
            {homeResort && (
              <p className="text-[11px] text-muted mt-0.5">🏔 {homeResort.name}</p>
            )}
            {isUnverified && addedByPerson && (
              <div className="flex items-center gap-1 mt-1 text-[10px] text-muted">
                <div className="w-3 h-3 rounded-full bg-surface-2 flex items-center justify-center text-[8px] font-bold text-foreground">
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
                <div className="text-[10px] text-muted">claim{claimCount !== 1 ? "s" : ""}</div>
              </>
            )}
            {placeCount > 0 && (
              <div className="text-[10px] text-muted mt-0.5">{placeCount} place{placeCount !== 1 ? "s" : ""}</div>
            )}
          </div>
        </div>
      </Link>
      {!isMe && (
        <QuickClaimPopover
          entityId={person.id}
          entityType="person"
          entityName={person.display_name}
        />
      )}
    </div>
  )
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="text-xs font-semibold text-muted uppercase tracking-widest mb-3 mt-7 first:mt-0 flex items-center gap-3">
      <span>{label}</span>
      <span className="h-px flex-1 bg-border-default" />
      <span className="normal-case tracking-normal font-normal">{count} rider{count !== 1 ? "s" : ""}</span>
    </div>
  )
}

export default function RidersPage() {
  const { activePersonId, userEntities } = useLineageStore()
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<SortTab>("all")
  const [myOnly, setMyOnly] = useState(false)
  const [addOpen, setAddOpen] = useState(false)

  const allPeople = useMemo(
    () => [...PEOPLE, ...(userEntities.people ?? [])],
    [userEntities.people]
  )

  // IDs of riders the active user rode with
  const myRiderIds = useMemo(() => {
    if (!activePersonId) return new Set<string>()
    return new Set(
      CLAIMS.filter((c) => c.subject_id === activePersonId && c.predicate === "rode_with").map((c) => c.object_id)
    )
  }, [activePersonId])

  // Claim counts computed once
  const claimCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of CLAIMS) map.set(c.subject_id, (map.get(c.subject_id) ?? 0) + 1)
    return map
  }, [])

  // Search + mine filter
  const searched = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allPeople.filter((p) => {
      if (myOnly && !myRiderIds.has(p.id)) return false
      if (q && !p.display_name.toLowerCase().includes(q) && !p.bio?.toLowerCase().includes(q)) return false
      return true
    })
  }, [query, myOnly, allPeople, myRiderIds])

  // Sort / group
  const result = useMemo(() => {
    const copy = [...searched]

    if (sort === "all") {
      copy.sort((a, b) => (claimCounts.get(b.id) ?? 0) - (claimCounts.get(a.id) ?? 0))
      return { type: "flat" as const, items: copy }
    }

    if (sort === "riders") {
      copy.sort((a, b) => a.display_name.localeCompare(b.display_name))
      return { type: "flat" as const, items: copy }
    }

    if (sort === "origin") {
      const withYear = copy
        .filter((p) => p.riding_since != null)
        .sort((a, b) => a.riding_since! - b.riding_since!)
      const noYear = copy
        .filter((p) => p.riding_since == null)
        .sort((a, b) => a.display_name.localeCompare(b.display_name))

      const decadeMap = new Map<string, Person[]>()
      for (const p of withYear) {
        const decade = `${Math.floor(p.riding_since! / 10) * 10}s`
        if (!decadeMap.has(decade)) decadeMap.set(decade, [])
        decadeMap.get(decade)!.push(p)
      }
      const groups: { label: string; items: Person[] }[] = [...decadeMap.entries()].map(
        ([label, items]) => ({ label, items })
      )
      if (noYear.length) groups.push({ label: "Unknown", items: noYear })
      return { type: "grouped" as const, groups }
    }

    if (sort === "resort") {
      const withResort = copy.filter((p) => p.home_resort_id != null)
      const noResort = copy
        .filter((p) => p.home_resort_id == null)
        .sort((a, b) => a.display_name.localeCompare(b.display_name))

      const resortMap = new Map<string, { name: string; items: Person[] }>()
      for (const p of withResort) {
        const resort = getPlaceById(p.home_resort_id!)
        const key = p.home_resort_id!
        if (!resortMap.has(key)) resortMap.set(key, { name: resort?.name ?? "Unknown", items: [] })
        resortMap.get(key)!.items.push(p)
      }
      const groups: { label: string; items: Person[] }[] = [...resortMap.entries()]
        .sort((a, b) => a[1].name.localeCompare(b[1].name))
        .map(([, { name, items }]) => ({
          label: name,
          items: items.sort((a, b) => a.display_name.localeCompare(b.display_name)),
        }))
      if (noResort.length) groups.push({ label: "No home resort", items: noResort })
      return { type: "grouped" as const, groups }
    }

    return { type: "flat" as const, items: copy }
  }, [searched, sort, claimCounts])

  const totalCount = searched.length

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Riders</h1>
            <p className="text-sm text-muted mt-1">
              {totalCount} rider{totalCount !== 1 ? "s" : ""} in the community graph
            </p>
          </div>
          <button
            onClick={() => setAddOpen(true)}
            className="px-4 py-2 rounded-lg bg-blue-600 text-sm font-medium text-foreground hover:bg-blue-500 transition-all"
          >
            + Add rider
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">⌕</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search riders…"
            className="w-full pl-8 pr-4 py-2 bg-surface border border-border-default rounded-xl text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        {/* Sort tabs + Mine filter */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-1">
            {SORT_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSort(tab.id)}
                title={tab.title}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                  sort === tab.id
                    ? "bg-surface-active border-border-default text-foreground"
                    : "border-transparent text-muted hover:text-foreground hover:bg-surface-hover"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setMyOnly(!myOnly)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border shrink-0",
              myOnly
                ? "bg-blue-600/20 border-blue-500/50 text-blue-400"
                : "border-border-default text-muted hover:text-foreground hover:bg-surface-hover"
            )}
          >
            My Riders{myOnly && myRiderIds.size > 0 ? ` · ${myRiderIds.size}` : ""}
          </button>
        </div>

        {/* List */}
        {totalCount === 0 ? (
          <div className="text-sm text-muted text-center py-12 border border-dashed border-border-default rounded-xl">
            No riders found.{" "}
            <button onClick={() => setAddOpen(true)} className="text-blue-500 hover:text-blue-400">
              Add one.
            </button>
          </div>
        ) : result.type === "flat" ? (
          <div className="space-y-2">
            {result.items.map((person) => (
              <RiderRow key={person.id} person={person} isMe={person.id === activePersonId} />
            ))}
          </div>
        ) : (
          <div>
            {result.groups.map(({ label, items }) => (
              <div key={label}>
                <SectionHeader label={label} count={items.length} />
                <div className="space-y-2">
                  {items.map((person) => (
                    <RiderRow key={person.id} person={person} isMe={person.id === activePersonId} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
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
