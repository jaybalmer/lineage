"use client"

// FNRad Featured Timelines Phase 4: the in-app "community connections" section on
// an episode page. Signed-in members add the riders, places, related events,
// orgs/brands, and boards an episode covered that are not in the editor-curated
// featured set. Simple junction model (brief §5.4): visible immediately, removal
// by the adder or any editor. Renders in-app only (the public page stays the
// curated stack). Names + links resolve from the store catalog, since the add
// picker only offers catalog entities.

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { CommunityLink } from "@/components/ui/community-link"
import { SearchPicker } from "@/components/ui/search-picker"
import { useLineageStore, isAuthUser } from "@/store/lineage-store"
import { personHref, entityHref } from "@/lib/entity-links"

type ConnType = "riders" | "places" | "events" | "orgs" | "boards"
type Conn = { ref_id: string; added_by: string | null }
type ConnState = Record<ConnType, Conn[]>

const EMPTY: ConnState = { riders: [], places: [], events: [], orgs: [], boards: [] }

const GROUPS: { type: ConnType; label: string; addLabel: string }[] = [
  { type: "riders", label: "Riders", addLabel: "rider" },
  { type: "boards", label: "Boards", addLabel: "board" },
  { type: "places", label: "Places", addLabel: "place" },
  { type: "events", label: "Events", addLabel: "event" },
  { type: "orgs", label: "Brands", addLabel: "brand" },
]

export function EpisodeConnections({ eventId }: { eventId: string }) {
  const { catalog, activePersonId, membership } = useLineageStore()
  const isAuth = isAuthUser(activePersonId)
  const isEditor = membership.is_editor
  const [conns, setConns] = useState<ConnState>(EMPTY)
  const [addingType, setAddingType] = useState<ConnType | null>(null)

  useEffect(() => {
    fetch(`/api/events/${eventId}/connections`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setConns({ ...EMPTY, ...d }) })
      .catch(() => {})
  }, [eventId])

  // Resolve one ref to a label + href, per type, from the store catalog.
  function resolve(type: ConnType, refId: string): { label: string; node: React.ReactNode } | null {
    if (type === "riders") {
      const p = catalog.people.find((x) => x.id === refId)
      if (!p) return null
      return { label: p.display_name, node: <Link href={personHref(p, catalog.people)} className="hover:text-foreground">{p.display_name}</Link> }
    }
    if (type === "places") {
      const pl = catalog.places.find((x) => x.id === refId)
      if (!pl) return null
      return { label: pl.name, node: <CommunityLink href={entityHref(refId, "place", catalog)} className="hover:text-foreground">{pl.name}</CommunityLink> }
    }
    if (type === "events") {
      const e = catalog.events.find((x) => x.id === refId)
      if (!e) return null
      return { label: e.name, node: <CommunityLink href={entityHref(refId, "event", catalog)} className="hover:text-foreground">{e.name}</CommunityLink> }
    }
    if (type === "orgs") {
      const o = catalog.orgs.find((x) => x.id === refId)
      if (!o) return null
      return { label: o.name, node: <CommunityLink href={entityHref(refId, "org", catalog)} className="hover:text-foreground">{o.name}</CommunityLink> }
    }
    const b = catalog.boards.find((x) => x.id === refId)
    if (!b) return null
    const name = `${b.brand} ${b.model}`
    return { label: name, node: <CommunityLink href={entityHref(refId, "board", catalog)} className="hover:text-foreground">{name}</CommunityLink> }
  }

  // Candidate catalog items for a type's add picker (excluding already-added).
  const candidatesByType = useMemo(() => {
    const added: Record<ConnType, Set<string>> = {
      riders: new Set(conns.riders.map((c) => c.ref_id)),
      places: new Set(conns.places.map((c) => c.ref_id)),
      events: new Set(conns.events.map((c) => c.ref_id)),
      orgs: new Set(conns.orgs.map((c) => c.ref_id)),
      boards: new Set(conns.boards.map((c) => c.ref_id)),
    }
    return {
      riders: catalog.people.filter((p) => !added.riders.has(p.id)).map((p) => ({ id: p.id, label: p.display_name })),
      places: catalog.places.filter((p) => !added.places.has(p.id)).map((p) => ({ id: p.id, label: p.name })),
      events: catalog.events.filter((e) => !added.events.has(e.id)).map((e) => ({ id: e.id, label: e.name })),
      orgs: catalog.orgs.filter((o) => !added.orgs.has(o.id)).map((o) => ({ id: o.id, label: o.name })),
      boards: catalog.boards.filter((b) => !added.boards.has(b.id)).map((b) => ({ id: b.id, label: `${b.brand} ${b.model}` })),
    } as Record<ConnType, { id: string; label: string }[]>
  }, [conns, catalog])

  async function add(type: ConnType, refId: string) {
    setConns((prev) => ({ ...prev, [type]: [...prev[type], { ref_id: refId, added_by: activePersonId }] }))
    await fetch(`/api/events/${eventId}/connections`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, ref_id: refId }),
    }).catch(() => {})
  }
  async function remove(type: ConnType, refId: string) {
    setConns((prev) => ({ ...prev, [type]: prev[type].filter((c) => c.ref_id !== refId) }))
    await fetch(`/api/events/${eventId}/connections`, {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, ref_id: refId }),
    }).catch(() => {})
  }

  const total = GROUPS.reduce((n, g) => n + conns[g.type].length, 0)
  // Nothing to show and the visitor can't add: hide the section entirely.
  if (total === 0 && !isAuth) return null

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-muted uppercase tracking-widest">Community connections</h2>
      </div>

      {total === 0 && (
        <p className="text-xs text-muted mb-3">
          Nothing added yet. {isAuth ? "Add the riders, gear, and places this episode covered." : null}
        </p>
      )}

      <div className="space-y-4">
        {GROUPS.map(({ type, label, addLabel }) => {
          const items = conns[type]
          const adding = addingType === type
          if (items.length === 0 && !isAuth) return null
          return (
            <div key={type}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-semibold text-muted uppercase tracking-widest">{label}</span>
                {isAuth && (
                  <button
                    onClick={() => setAddingType(adding ? null : type)}
                    className="text-[11px] text-accent-strong hover:underline"
                  >
                    {adding ? "Done" : `+ Add ${addLabel}`}
                  </button>
                )}
              </div>

              {items.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {items.map((c) => {
                    const r = resolve(type, c.ref_id)
                    if (!r) return null
                    const canRemove = isEditor || (!!activePersonId && c.added_by === activePersonId)
                    return (
                      <span key={c.ref_id} className="inline-flex items-center gap-1.5 text-xs rounded-full border border-border-default bg-surface px-2.5 py-1 text-muted">
                        {r.node}
                        {canRemove && (
                          <button onClick={() => remove(type, c.ref_id)} className="hover:text-red-400 leading-none" aria-label={`Remove ${r.label}`}>×</button>
                        )}
                      </span>
                    )
                  })}
                </div>
              )}

              {adding && (
                <div className="mt-2 max-w-sm">
                  <SearchPicker
                    items={candidatesByType[type]}
                    selected={[]}
                    onToggle={(id) => add(type, id)}
                    getLabel={(it) => it.label}
                    placeholder={`Search ${addLabel}s…`}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
