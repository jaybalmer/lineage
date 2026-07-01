"use client"

// FNRad Featured Timelines: the editor curation surface for a non-profile owner
// (an episode's featured set or a show's canon). Candidates come from a live
// catalog search, and — for episodes — from the connections already added to the
// episode (pass `connectionsUrl`), so the editor picks from what they just added
// rather than searching again. When the featured set is empty, a starter is
// pre-seeded from those connections (1-3 of each type). Closing with unsaved
// changes asks for confirmation. Owner-agnostic: `stackUrl` is the PUT endpoint;
// pass `guestsUrl` to also manage header guests (episodes only). Editor-gated by
// the caller.

import { useEffect, useMemo, useRef, useState } from "react"
import { useLineageStore } from "@/store/lineage-store"
import { cn } from "@/lib/utils"
import type { PublicStackEntryType } from "@/types"
import type { ResolvedStackEntry } from "@/lib/public-timeline-read"

const HARD_MAX = 20
const STARTER_PER_TYPE = 3

type RefType = Extract<PublicStackEntryType, "rider" | "place" | "event" | "board">

type Candidate = { uid: string; type: RefType; id: string; label: string; sublabel: string | null }

type SelEntry = {
  uid: string
  entry_type: RefType
  entry_ref_id: string
  custom_title: string
  custom_summary: string
  label: string
  sublabel: string | null
}

const TYPE_CHIP: Record<RefType, { label: string; cls: string }> = {
  rider: { label: "Rider", cls: "text-violet-700 bg-violet-500/10" },
  place: { label: "Place", cls: "text-teal-700 bg-teal-500/10" },
  event: { label: "Event", cls: "text-amber-700 bg-amber-500/10" },
  board: { label: "Board", cls: "text-emerald-700 bg-emerald-500/10" },
}

// Connections API shape (episodes): grouped raw rows. Orgs/brands are omitted
// here because the featured set has no org entry type.
type ConnResponse = Partial<Record<"riders" | "places" | "events" | "boards" | "orgs", { ref_id: string }[]>>

export function StackCurateModal({
  title = "Curate featured set",
  stackUrl, guestsUrl, connectionsUrl,
  initialEntries, initialGuestIds = [],
  onClose, onSaved,
}: {
  title?: string
  stackUrl: string
  guestsUrl?: string
  /** Episodes: the /api/events/[id]/connections endpoint, so its added
   *  riders/places/events/boards become quick-pick candidates + the starter. */
  connectionsUrl?: string
  initialEntries: ResolvedStackEntry[]
  initialGuestIds?: string[]
  onClose: () => void
  onSaved: () => void
}) {
  const { catalog, addToast } = useLineageStore()
  const [query, setQuery] = useState("")
  const [saving, setSaving] = useState(false)
  const [editingUid, setEditingUid] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [isStarter, setIsStarter] = useState(false)

  const [selection, setSelection] = useState<SelEntry[]>(() =>
    initialEntries
      .filter((e): e is ResolvedStackEntry & { entry_type: RefType } =>
        e.entry_type === "rider" || e.entry_type === "place" || e.entry_type === "event" || e.entry_type === "board")
      .filter((e) => e.refId)
      .map((e) => ({
        uid: `${e.entry_type}:${e.refId}`, entry_type: e.entry_type, entry_ref_id: e.refId as string,
        custom_title: "", custom_summary: "", label: e.title, sublabel: e.kickerMeta,
      })),
  )
  const [guestIds, setGuestIds] = useState<string[]>(initialGuestIds)

  // ── The episode's already-added connections, as candidates ──
  const [connRows, setConnRows] = useState<ConnResponse | null>(null)
  useEffect(() => {
    if (!connectionsUrl) return
    fetch(connectionsUrl).then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) setConnRows(d) }).catch(() => {})
  }, [connectionsUrl])

  const labelFor = useMemo(() => ({
    rider: (id: string) => catalog.people.find((p) => p.id === id)?.display_name ?? null,
    place: (id: string) => catalog.places.find((p) => p.id === id)?.name ?? null,
    event: (id: string) => catalog.events.find((e) => e.id === id)?.name ?? null,
    board: (id: string) => { const b = catalog.boards.find((x) => x.id === id); return b ? `${b.brand} ${b.model}` : null },
  }), [catalog])

  const connCandidates = useMemo<Candidate[]>(() => {
    if (!connRows) return []
    const out: Candidate[] = []
    const groups: [keyof ConnResponse, RefType][] = [["riders", "rider"], ["boards", "board"], ["places", "place"], ["events", "event"]]
    for (const [key, type] of groups) {
      for (const row of connRows[key] ?? []) {
        const label = labelFor[type](row.ref_id)
        if (label) out.push({ uid: `${type}:${row.ref_id}`, type, id: row.ref_id, label, sublabel: TYPE_CHIP[type].label })
      }
    }
    return out
  }, [connRows, labelFor])

  // ── Starter: when there is no saved set yet, pre-seed from the connections. ──
  const seededRef = useRef(false)
  useEffect(() => {
    if (seededRef.current) return
    if (initialEntries.length > 0) { seededRef.current = true; return }
    if (connCandidates.length === 0) return
    seededRef.current = true
    const perType: Record<RefType, number> = { rider: 0, place: 0, event: 0, board: 0 }
    const picks: Candidate[] = []
    for (const c of connCandidates) {
      if (perType[c.type] < STARTER_PER_TYPE && picks.length < HARD_MAX) { perType[c.type]++; picks.push(c) }
    }
    if (picks.length > 0) {
      setIsStarter(true)
      setSelection(picks.map((c) => ({
        uid: c.uid, entry_type: c.type, entry_ref_id: c.id,
        custom_title: "", custom_summary: "", label: c.label, sublabel: null,
      })))
    }
  }, [connCandidates, initialEntries])

  // ── Catalog search candidates (fallback when the connection isn't listed) ──
  const catalogCandidates = useMemo<Candidate[]>(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    const out: Candidate[] = []
    for (const p of catalog.people) if (p.display_name?.toLowerCase().includes(q)) out.push({ uid: `rider:${p.id}`, type: "rider", id: p.id, label: p.display_name, sublabel: "Rider" })
    for (const pl of catalog.places) if (pl.name?.toLowerCase().includes(q)) out.push({ uid: `place:${pl.id}`, type: "place", id: pl.id, label: pl.name, sublabel: [pl.region, pl.country].filter(Boolean).join(", ") || "Place" })
    for (const e of catalog.events) if (e.name?.toLowerCase().includes(q)) out.push({ uid: `event:${e.id}`, type: "event", id: e.id, label: e.name, sublabel: e.year ? String(e.year) : "Event" })
    for (const b of catalog.boards) { const name = `${b.brand} ${b.model}`; if (name.toLowerCase().includes(q)) out.push({ uid: `board:${b.id}`, type: "board", id: b.id, label: name, sublabel: b.model_year ? String(b.model_year) : "Board" }) }
    return out.slice(0, 30)
  }, [query, catalog])

  const selectedUids = useMemo(() => new Set(selection.map((s) => s.uid)), [selection])

  function touch() { setDirty(true); setIsStarter(false) }
  function addCandidate(c: Candidate) {
    touch()
    setSelection((prev) => {
      if (prev.some((s) => s.uid === c.uid) || prev.length >= HARD_MAX) return prev
      return [...prev, { uid: c.uid, entry_type: c.type, entry_ref_id: c.id, custom_title: "", custom_summary: "", label: c.label, sublabel: c.sublabel }]
    })
  }
  function removeUid(uid: string) { touch(); setSelection((prev) => prev.filter((s) => s.uid !== uid)) }
  function move(idx: number, dir: -1 | 1) {
    touch()
    setSelection((prev) => {
      const next = [...prev]; const j = idx + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[idx], next[j]] = [next[j], next[idx]]
      return next
    })
  }
  function setCustom(uid: string, patch: Partial<Pick<SelEntry, "custom_title" | "custom_summary">>) {
    touch(); setSelection((prev) => prev.map((s) => (s.uid === uid ? { ...s, ...patch } : s)))
  }

  const guestPeople = useMemo(
    () => guestIds.map((id) => catalog.people.find((p) => p.id === id)).filter(Boolean) as { id: string; display_name: string }[],
    [guestIds, catalog.people],
  )
  function toggleGuest(personId: string) {
    touch(); setGuestIds((prev) => (prev.includes(personId) ? prev.filter((g) => g !== personId) : [...prev, personId]))
  }

  // ── Close with an unsaved-changes guard (Issue D) ──
  function requestClose() {
    if (saving) return
    if (dirty && !window.confirm("Discard your unsaved changes to the featured set?")) return
    onClose()
  }

  async function save() {
    setSaving(true)
    try {
      const reqs: Promise<Response>[] = [
        fetch(stackUrl, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entries: selection.map((s) => ({
              entry_type: s.entry_type, entry_ref_id: s.entry_ref_id,
              custom_title: s.custom_title || undefined, custom_summary: s.custom_summary || undefined,
            })),
          }),
        }),
      ]
      if (guestsUrl) {
        reqs.push(fetch(guestsUrl, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ person_ids: guestIds }),
        }))
      }
      const results = await Promise.all(reqs)
      const failed = results.find((r) => !r.ok)
      if (failed) {
        const j = await failed.json().catch(() => ({}))
        addToast(j?.error ?? "Could not save the featured set.", "error")
        return
      }
      addToast("Featured set saved.")
      setDirty(false)
      onSaved()
      onClose()
    } catch {
      addToast("Could not save the featured set.", "error")
    } finally {
      setSaving(false)
    }
  }

  const count = selection.length
  const quickPick = connCandidates.filter((c) => !selectedUids.has(c.uid))

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 overflow-y-auto" onClick={requestClose}>
      <div className="bg-background border border-border-default rounded-2xl w-full max-w-2xl my-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-default">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <button onClick={requestClose} className="text-muted hover:text-foreground text-xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-6">
          {isStarter && (
            <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-3 text-xs text-muted">
              <span className="text-foreground font-medium">We drafted a starter</span> from this episode&apos;s connections. Trim it, reorder it, then Save — or clear it and pick your own.
            </div>
          )}

          {/* From this episode's connections (quick pick) */}
          {quickPick.length > 0 && (
            <div>
              <label className="text-[10px] font-semibold text-muted uppercase tracking-widest">From this episode&apos;s connections</label>
              <div className="mt-1.5 space-y-1 max-h-48 overflow-y-auto">
                {quickPick.map((c) => {
                  const isGuest = c.type === "rider" && guestIds.includes(c.id)
                  return (
                    <div key={c.uid} className="flex items-center gap-2 rounded-lg border border-border-default bg-surface px-3 py-2">
                      <span className={cn("text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0", TYPE_CHIP[c.type].cls)}>{TYPE_CHIP[c.type].label}</span>
                      <p className="flex-1 min-w-0 text-sm text-foreground truncate">{c.label}</p>
                      {guestsUrl && c.type === "rider" && (
                        <button onClick={() => toggleGuest(c.id)}
                          className={cn("text-[11px] rounded-lg px-2 py-1 border transition-colors shrink-0",
                            isGuest ? "border-violet-600 text-violet-700 bg-violet-500/10" : "border-border-default text-muted hover:text-foreground")}
                          title="Mark as a header guest">
                          {isGuest ? "Guest ✓" : "Guest"}
                        </button>
                      )}
                      <button onClick={() => addCandidate(c)} disabled={count >= HARD_MAX}
                        className="text-xs font-medium rounded-lg px-2.5 py-1 border border-border-default text-muted hover:text-foreground disabled:opacity-50 transition-colors shrink-0">
                        Add
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Search (catalog-wide, for anything not in the connections) */}
          <div>
            <label className="text-[10px] font-semibold text-muted uppercase tracking-widest">
              {connectionsUrl ? "Or search everything" : "Add what was discussed"}
            </label>
            <input
              value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search riders, boards, places, events…"
              className="mt-1.5 w-full bg-surface border border-border-default rounded-lg px-3 py-2 text-sm text-foreground placeholder-zinc-500 focus:outline-none focus:border-blue-500"
            />
            {catalogCandidates.length > 0 && (
              <div className="mt-2 space-y-1 max-h-56 overflow-y-auto">
                {catalogCandidates.map((c) => {
                  const added = selectedUids.has(c.uid)
                  const isGuest = c.type === "rider" && guestIds.includes(c.id)
                  return (
                    <div key={c.uid} className="flex items-center gap-2 rounded-lg border border-border-default bg-surface px-3 py-2">
                      <span className={cn("text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0", TYPE_CHIP[c.type].cls)}>{TYPE_CHIP[c.type].label}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground truncate">{c.label}</p>
                        {c.sublabel && <p className="text-[11px] text-muted truncate">{c.sublabel}</p>}
                      </div>
                      {guestsUrl && c.type === "rider" && (
                        <button onClick={() => toggleGuest(c.id)}
                          className={cn("text-[11px] rounded-lg px-2 py-1 border transition-colors shrink-0",
                            isGuest ? "border-violet-600 text-violet-700 bg-violet-500/10" : "border-border-default text-muted hover:text-foreground")}
                          title="Mark as a header guest">
                          {isGuest ? "Guest ✓" : "Guest"}
                        </button>
                      )}
                      <button onClick={() => (added ? removeUid(c.uid) : addCandidate(c))} disabled={!added && count >= HARD_MAX}
                        className={cn("text-xs font-medium rounded-lg px-2.5 py-1 border transition-colors shrink-0",
                          added ? "border-blue-600 text-blue-700 bg-blue-500/10"
                            : count >= HARD_MAX ? "border-border-default text-muted opacity-50 cursor-not-allowed"
                              : "border-border-default text-muted hover:text-foreground")}>
                        {added ? "Added ✓" : "Add"}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
            {query.trim().length >= 2 && catalogCandidates.length === 0 && (
              <p className="mt-2 text-xs text-muted">No catalog matches. Add the rider/board/place/event first, then feature it.</p>
            )}
          </div>

          {/* Guests summary (episodes only) */}
          {guestsUrl && guestPeople.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-muted uppercase tracking-widest mb-2">Header guests</div>
              <div className="flex flex-wrap gap-1.5">
                {guestPeople.map((g) => (
                  <span key={g.id} className="inline-flex items-center gap-1.5 text-xs rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-700 px-2.5 py-1">
                    {g.display_name}
                    <button onClick={() => toggleGuest(g.id)} className="hover:text-violet-900" aria-label="Remove guest">×</button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Featured set */}
          <div>
            <div className="text-[10px] font-semibold text-muted uppercase tracking-widest mb-2">Featured set ({count})</div>
            {count === 0 ? (
              <p className="text-sm text-muted border border-dashed border-border-default rounded-xl p-5 text-center">
                Add from this episode&apos;s connections above, or search the catalog.
              </p>
            ) : (
              <div className="space-y-2">
                {selection.map((s, idx) => (
                  <div key={s.uid} className="rounded-xl border border-border-default bg-surface p-3">
                    <div className="flex items-start gap-2">
                      <div className="flex flex-col gap-0.5 pt-0.5">
                        <button onClick={() => move(idx, -1)} disabled={idx === 0} className="text-muted hover:text-foreground disabled:opacity-30 text-xs leading-none" aria-label="Move up">▲</button>
                        <button onClick={() => move(idx, 1)} disabled={idx === count - 1} className="text-muted hover:text-foreground disabled:opacity-30 text-xs leading-none" aria-label="Move down">▼</button>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={cn("text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded", TYPE_CHIP[s.entry_type].cls)}>{TYPE_CHIP[s.entry_type].label}</span>
                        </div>
                        <p className="text-sm font-medium text-foreground truncate">{s.custom_title || s.label}</p>
                        {(s.custom_summary || s.sublabel) && <p className="text-xs text-muted truncate">{s.custom_summary || s.sublabel}</p>}
                        {editingUid === s.uid && (
                          <div className="mt-2 space-y-2">
                            <input value={s.custom_title} onChange={(e) => setCustom(s.uid, { custom_title: e.target.value })} placeholder="Custom title (optional)" maxLength={200}
                              className="w-full bg-background border border-border-default rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-blue-500" />
                            <input value={s.custom_summary} onChange={(e) => setCustom(s.uid, { custom_summary: e.target.value })} placeholder="Custom note (optional)" maxLength={600}
                              className="w-full bg-background border border-border-default rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-blue-500" />
                          </div>
                        )}
                      </div>
                      {/* Actions: pill buttons matching the Guest/Add style on the candidate rows */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => setEditingUid(editingUid === s.uid ? null : s.uid)}
                          className={cn("text-xs font-medium rounded-lg px-2.5 py-1 border transition-colors",
                            editingUid === s.uid ? "border-blue-600 text-blue-700 bg-blue-500/10" : "border-border-default text-muted hover:text-foreground")}>
                          {editingUid === s.uid ? "Done" : "Edit"}
                        </button>
                        <button onClick={() => removeUid(s.uid)}
                          className="text-xs font-medium rounded-lg px-2.5 py-1 border border-red-500/30 text-red-500 hover:text-red-400 hover:border-red-500/50 transition-colors">
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-border-default">
          <span className="text-[11px] text-muted">{dirty ? "Unsaved changes" : ""}</span>
          <div className="flex items-center gap-3">
            <button onClick={requestClose} className="text-sm text-muted hover:text-foreground transition-colors">Cancel</button>
            <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors">
              {saving ? "Saving…" : "Save featured set"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
