"use client"

import { useState, useMemo, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Nav } from "@/components/ui/nav"
import { getPlaceById, getPersonById } from "@/lib/mock-data"
import { useLineageStore, isAuthUser } from "@/store/lineage-store"
import { usePersonHref } from "@/lib/use-person-href"
import { AddEntityModal } from "@/components/ui/add-entity-modal"
import { QuickClaimPopover } from "@/components/ui/quick-claim-popover"
import { InviteRiderModal } from "@/components/ui/invite-rider-modal"
import { RiderAvatar, getRiderTier, type RiderTier } from "@/components/ui/rider-avatar"
import { MemberBadge } from "@/components/ui/member-badge"
import { isInvitableNodeStatus, trackInviteEvent } from "@/lib/invite-tracking"
import { CommunityLink } from "@/components/ui/community-link"
import Link from "next/link"
import { cn } from "@/lib/utils"
import type { Person } from "@/types"

type SortTab = "all" | "entries" | "origin" | "riders" | "resort" | "unclaimed"

const SORT_TABS: { id: SortTab; label: string; title: string }[] = [
  { id: "all",       label: "All",       title: "Group by tier, most claims first" },
  { id: "entries",   label: "Entries",   title: "Sort by most entries & connections" },
  { id: "origin",    label: "Origin",    title: "Group by decade started" },
  { id: "riders",    label: "Riders",    title: "Sort alphabetically" },
  { id: "resort",    label: "Resort",    title: "Group by home resort" },
  { id: "unclaimed", label: "Unclaimed", title: "Riders not yet on Linestry" },
]

// ── Rider type classification (delegates to shared getRiderTier) ─────────────

type RiderKind = RiderTier

function getRiderKind(person: Person): RiderKind {
  return getRiderTier(person)
}

const KIND_META: Record<RiderKind, { label: string; color: string; avatarBg: string; badge?: string }> = {
  founding:       { label: "Founding",   color: "#f59e0b", avatarBg: "#78350f", badge: "✦ Founding" },
  paid:           { label: "Member",     color: "#f97316", avatarBg: "#431407", badge: "◈ Member"   },
  "free-account": { label: "Rider",      color: "#10b981", avatarBg: "#064e3b", badge: undefined    },
  unclaimed:      { label: "Unclaimed",  color: "#3b82f6", avatarBg: "#1e3a8a", badge: undefined    },
  catalog:        { label: "Catalog",    color: "#52525b", avatarBg: "#27272a", badge: undefined    },
  verified:       { label: "Verified",   color: "#10b981", avatarBg: "#064e3b", badge: "✓ Verified" },
}

const KIND_ORDER: RiderKind[] = ["founding", "paid", "verified", "free-account", "unclaimed", "catalog"]

const SECTION_LABELS: Record<RiderKind, string> = {
  founding:       "Founding Members",
  paid:           "Members",
  verified:       "Verified",
  "free-account": "Riders",
  unclaimed:      "Unclaimed Profiles",
  catalog:        "Catalog",
}

// ── RiderRow ─────────────────────────────────────────────────────────────────

function RiderRow({ person, isMe, connected, onInvite, claims, activeCommunitySlug }: {
  person: Person
  isMe: boolean
  connected: boolean
  onInvite?: (p: Person) => void
  claims: import("@/types").Claim[]
  activeCommunitySlug: string
}) {
  const personLink = usePersonHref()
  const claimCount = claims.filter((c) => c.subject_id === person.id).length
  const placeCount = claims.filter((c) => c.subject_id === person.id && c.predicate === "rode_at").length
  const homeResort = person.home_resort_id ? getPlaceById(person.home_resort_id) : null
  const href = isMe ? `/${activeCommunitySlug}/profile` : personLink(person)
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
          <RiderAvatar person={person} size="lg" ring={kind !== "catalog"} />

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
              {kind === "verified" && meta.badge ? (
                <span
                  className="text-[10px] rounded px-1.5 py-0.5 font-medium"
                  style={{ color: meta.color, background: `${meta.color}18`, border: `1px solid ${meta.color}33` }}
                >
                  {meta.badge}
                </span>
              ) : (
                <MemberBadge tier={person.membership_tier} className="text-[10px]" />
              )}
              {person.riding_since && (
                <span className="text-[11px] text-muted">riding since {person.riding_since}</span>
              )}
              {connected && (
                <span
                  className="text-[10px] rounded px-1.5 py-0.5 font-medium"
                  style={{ color: "#7c3aed", background: "#7c3aed18", border: "1px solid #7c3aed33" }}
                >
                  You rode together
                </span>
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
        <div className="flex items-center justify-end gap-1.5 shrink-0 flex-wrap max-w-[45%]">
          {connected && (
            <CommunityLink
              href={`/connections/${person.id}`}
              className="px-2.5 py-1.5 rounded-lg border border-border-default text-[11px] text-muted hover:text-foreground hover:bg-surface-hover transition-colors shrink-0"
              title="See your connection with this rider"
            >
              See connection
            </CommunityLink>
          )}
          {isInvitableNodeStatus(person.node_status) && onInvite && (
            <button
              onClick={() => {
                trackInviteEvent("invite_prompt_clicked", {
                  surface: "person_list",
                  person_id: person.id,
                  node_status: person.node_status,
                })
                onInvite(person)
              }}
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
  const { activePersonId, userEntities, catalog, activeCommunitySlug } = useLineageStore()
  const isAuth = isAuthUser(activePersonId)
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<SortTab>(yearParam ? "origin" : "all")
  // ?mine=1 pre-enables the My Riders filter (the "See all" link from the
  // "People in your timeline" strip on My Timeline lands here).
  const [myOnly, setMyOnly] = useState(searchParams.get("mine") === "1")
  const [addOpen, setAddOpen] = useState(false)
  const [invitePerson, setInvitePerson] = useState<Person | null>(null)
  // ?community=all opts out of the community filter and shows the global directory.
  const showAllCommunities = searchParams.get("community") === "all"

  // catalog.people already merges the people table + registered profiles.
  // Filter to active community by default; pass-through when community_slugs is unpopulated
  // so the page degrades gracefully for entities that haven't been backfilled yet.
  const allPeople = useMemo(() => {
    const merged = [...catalog.people, ...(userEntities.people ?? [])]
    if (showAllCommunities || !activeCommunitySlug) return merged
    return merged.filter((p) => !p.community_slugs?.length || p.community_slugs.includes(activeCommunitySlug))
  }, [catalog.people, userEntities.people, activeCommunitySlug, showAllCommunities])

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
      // The Unclaimed tab composes with search and My Riders: "Unclaimed" + "My
      // Riders" yields unclaimed riders you rode with (the connect-job slice).
      if (sort === "unclaimed" && !isInvitableNodeStatus(p.node_status)) return false
      if (q && !p.display_name.toLowerCase().includes(q) && !p.bio?.toLowerCase().includes(q)) return false
      return true
    })
  }, [query, myOnly, sort, allPeople, myRiderIds])

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

    if (sort === "unclaimed") {
      // Already filtered to invitable nodes in `searched`. Show them under the
      // single "Unclaimed Profiles" label, most claims first, reusing the
      // kind-grouped renderer so the section header keeps the unclaimed blue.
      copy.sort((a, b) => (claimCounts.get(b.id) ?? 0) - (claimCounts.get(a.id) ?? 0))
      return {
        type: "kind-grouped" as const,
        groups: [{ label: SECTION_LABELS.unclaimed, kind: "unclaimed" as RiderKind, items: copy }],
      }
    }

    if (sort === "entries") {
      // Flat ranking by total claims (timeline entries + connections), most first
      copy.sort(
        (a, b) =>
          (claimCounts.get(b.id) ?? 0) - (claimCounts.get(a.id) ?? 0) ||
          a.display_name.localeCompare(b.display_name)
      )
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
              {totalCount} rider{totalCount !== 1 ? "s" : ""} in the community
            </p>
          </div>
          <button
            onClick={() => setAddOpen(true)}
            className="px-4 py-2 rounded-lg bg-[#1C1917] text-sm font-medium text-white hover:bg-[#292524] transition-all"
          >
            + Add rider
          </button>
        </div>

        {/* Search — standard list-page control (matches Places/Boards/Events/Brands), BUG-006 */}
        <div className="relative mb-4">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm pointer-events-none">🔍</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search riders…"
            className="w-full bg-surface border border-border-default rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground placeholder-muted focus:outline-none focus:border-blue-500 transition-colors"
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground text-lg leading-none">×</button>
          )}
        </div>

        {/* Sort tabs + Mine filter */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-1 flex-wrap">
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
              <RiderRow key={person.id} person={person} isMe={person.id === activePersonId} connected={person.id !== activePersonId && myRiderIds.has(person.id)} onInvite={setInvitePerson} claims={allClaims} activeCommunitySlug={activeCommunitySlug} />
            ))}
          </div>
        ) : result.type === "kind-grouped" ? (
          <div>
            {result.groups.map(({ label, kind, items }) => (
              <div key={kind}>
                <SectionHeader label={label} count={items.length} color={KIND_META[kind].color} />
                <div className="space-y-2">
                  {items.map((person) => (
                    <RiderRow key={person.id} person={person} isMe={person.id === activePersonId} connected={person.id !== activePersonId && myRiderIds.has(person.id)} onInvite={setInvitePerson} claims={allClaims} activeCommunitySlug={activeCommunitySlug} />
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
                    <RiderRow key={person.id} person={person} isMe={person.id === activePersonId} connected={person.id !== activePersonId && myRiderIds.has(person.id)} onInvite={setInvitePerson} claims={allClaims} activeCommunitySlug={activeCommunitySlug} />
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
          surface="person_list"
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
