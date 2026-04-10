"use client"

import { useState, useMemo, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Nav } from "@/components/ui/nav"
import { getPlaceById, getPersonById } from "@/lib/mock-data"
import { useLineageStore, isAuthUser } from "@/store/lineage-store"
import { AddEntityModal } from "@/components/ui/add-entity-modal"
import { QuickClaimPopover } from "@/components/ui/quick-claim-popover"
import { InviteRiderModal } from "@/components/ui/invite-rider-modal"
import { RiderAvatar, getInitials } from "@/components/ui/rider-avatar"
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

// ── Rider type classification ─────────────────────────────────────────────────

type RiderKind = "founding" | "paid" | "free-account" | "unclaimed" | "catalog"

function getRiderKind(person: Person): RiderKind {
  if (isAuthUser(person.id)) {
    const tier = person.membership_tier ?? "free"
    if (tier === "founding")                       return "founding"
    if (tier === "annual" || tier === "lifetime")   return "paid"
    return "free-account"
  }
  if (person.community_status === "unverified")    return "unclaimed"
  return "catalog"
}

const KIND_META: Record<RiderKind, { label: string; color: string; avatarBg: string; badge?: string }> = {
  founding:     { label: "Founding",     color: "#f59e0b", avatarBg: "#78350f", badge: "✦ Founding" },
  paid:         { label: "Member",       color: "#3b82f6", avatarBg: "#1e3a8a", badge: "◈ Member"   },
  "free-account": { label: "Rider",      color: "#10b981", avatarBg: "#064e3b", badge: undefined    },
  unclaimed:    { label: "Unclaimed",    color: "#f97316", avatarBg: "#431407", badge: undefined    },
  catalog:      { label: "Catalog",      color: "#52525b", avatarBg: "#27272a", badge: undefined    },
}

const KIND_ORDER: RiderKind[] = ["founding", "paid", "free-account", "unclaimed", "catalog"]

const SECTION_LABELS: Record<RiderKind, string> = {
  founding:       "Founding Members",
  paid:           "Members",
  "free-account": "Riders",
  unclaimed:      "Unclaimed Profiles",
  catalog:        "Catalog",
}

// ── RiderRow ─────────────────────────────────────────────────────────────────

function RiderRow({ person, isMe, onInvite, claims }: {
  person: Person
  isMe: boolean
  onInvite?: (p: Person) => void
  claims: import("@/types").Claim[]
}) {
  const claimCount = claims.filter((c) => c.subject_id === person.id).length
  const placeCount = claims.filter((c) => c.subject_id === person.id && c.predicate === "rode_at").length
  const homeResort = person.home_resort_id ? getPlaceById(person.home_resort_id) : null
  const href = isMe ? "/profile" : `/riders/${person.id}`
  const addedByPerson = person.added_by ? getPersonById(person.added_by) : null
  const kind = getRiderKind(person)
  const meta = KIND_META[kind]

  return (
    <div className="flex items-center gap-2">
      <Link href={href} className="flex-1 min-w-0 block group">
        <div
          className="flex items-center gap-4 px-4 py-3.5 bg-surface rounded-xl hover:bg-surface-hover transition-all border"
          style={{ borderColor: `${meta.color}30` }}
        >
          {/* Avatar */}
          <RiderAvatar person={person} size="lg" ring={kind === "founding" || kind === "paid"} />

          {/* Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span
                className="font-semibold text-sm transition-colors"
                style={{ color: kind === "catalog" ? "#71717a" : undefined }}
              >
                {person.display_name}
              </span>
              {isMe && (
                <span className="text-[10px] text-muted border border-border-default rounded px-1.5 py-0.5">you</span>
              )}
              {meta.badge && (
                <span
                  className="text-[10px] rounded px-1.5 py-0.5 font-medium"
                  style={{ color: meta.color, background: `${meta.color}18`, border: `1px solid ${meta.color}33` }}
                >
                  {meta.badge}
                </span>
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
            {kind === "unclaimed" && addedByPerson && (
              <div className="flex items-center gap-1 mt-1 text-[10px] text-muted">
                <RiderAvatar person={addedByPerson} size="xs" />
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
        <div className="flex items-center gap-1.5 shrink-0">
          {kind === "unclaimed" && onInvite && (
            <button
              onClick={() => onInvite(person)}
              className="px-2.5 py-1.5 rounded-lg border border-border-default text-[11px] text-muted hover:text-foreground hover:bg-surface-hover transition-colors shrink-0"
              title="Invite this rider to claim their profile"
            >
              Invite
            </button>
          )}
          <QuickClaimPopover
            entityId={person.id}
            entityType="person"
            entityName={person.display_name}
          />
        </div>
      )}
    </div>
  )
}

function SectionHeader({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex items-center gap-3 mb-3 mt-7 first:mt-0">
      <span className="text-xs font-semibold uppercase tracking-widest" style={{ color }}>{label}</span>
      <span className="h-px flex-1" style={{ background: `${color}30` }} />
      <span className="text-[11px] text-muted font-normal">{count} rider{count !== 1 ? "s" : ""}</span>
    </div>
  )
}

function RidersPageInner() {
  const searchParams = useSearchParams()
  const yearParam = searchParams.get("year")
  const { activePersonId, userEntities, catalog } = useLineageStore()
  const isAuth = isAuthUser(activePersonId)
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<SortTab>(yearParam ? "origin" : "all")
  const [myOnly, setMyOnly] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [invitePerson, setInvitePerson] = useState<Person | null>(null)

  // catalog.people already merges the people table + registered profiles
  const allPeople = useMemo(
    () => [...catalog.people, ...(userEntities.people ?? [])],
    [catalog.people, userEntities.people]
  )

  const allClaims = catalog.claims

  // IDs of riders the active user rode with
  const myRiderIds = useMemo(() => {
    if (!activePersonId) return new Set<string>()
    return new Set(
      allClaims.filter((c) => c.subject_id === activePersonId && c.predicate === "rode_with").map((c) => c.object_id)
    )
  }, [activePersonId, allClaims])

  // Claim counts computed once
  const claimCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of allClaims) map.set(c.subject_id, (map.get(c.subject_id) ?? 0) + 1)
    return map
  }, [allClaims])

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
      // Group by rider kind in priority order, sorted by claim count within each group
      const byKind = new Map<RiderKind, Person[]>()
      for (const k of KIND_ORDER) byKind.set(k, [])
      for (const p of copy) byKind.get(getRiderKind(p))!.push(p)
      for (const [, arr] of byKind) arr.sort((a, b) => (claimCounts.get(b.id) ?? 0) - (claimCounts.get(a.id) ?? 0))
      const groups = KIND_ORDER
        .filter((k) => byKind.get(k)!.length > 0)
        .map((k) => ({ label: SECTION_LABELS[k], kind: k, items: byKind.get(k)! }))
      return { type: "kind-grouped" as const, groups }
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
            className="px-4 py-2 rounded-lg bg-[#1C1917] text-sm font-medium text-[#F5F2EE] hover:bg-[#292524] transition-all"
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
          {isAuth && (
            <button
              onClick={() => setMyOnly(!myOnly)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border shrink-0",
                myOnly
                  ? "bg-[#1C1917]/15 border-[#1C1917]/30 text-foreground"
                  : "border-border-default text-muted hover:text-foreground hover:bg-surface-hover"
              )}
            >
              My Riders{myOnly && myRiderIds.size > 0 ? ` · ${myRiderIds.size}` : ""}
            </button>
          )}
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
              <RiderRow key={person.id} person={person} isMe={person.id === activePersonId} onInvite={setInvitePerson} claims={allClaims} />
            ))}
          </div>
        ) : result.type === "kind-grouped" ? (
          <div>
            {result.groups.map(({ label, kind, items }) => (
              <div key={kind}>
                <SectionHeader label={label} count={items.length} color={KIND_META[kind].color} />
                <div className="space-y-2">
                  {items.map((person) => (
                    <RiderRow key={person.id} person={person} isMe={person.id === activePersonId} onInvite={setInvitePerson} claims={allClaims} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div>
            {result.groups.map(({ label, items }) => (
              <div key={label}>
                <SectionHeader label={label} count={items.length} color="#52525b" />
                <div className="space-y-2">
                  {items.map((person) => (
                    <RiderRow key={person.id} person={person} isMe={person.id === activePersonId} onInvite={setInvitePerson} claims={allClaims} />
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
      {invitePerson && (
        <InviteRiderModal
          personId={invitePerson.id}
          personName={invitePerson.display_name}
          predicate="rode_with"
          onClose={() => setInvitePerson(null)}
        />
      )}
    </div>
  )
}

export default function RidersPage() {
  return (
    <Suspense>
      <RidersPageInner />
    </Suspense>
  )
}
