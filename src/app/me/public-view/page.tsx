"use client"

// PB-010A Phase 3: the owner manage surface for the Stack View (decision D2 —
// a dedicated route, linked from /me/settings/public-timeline).
//
// Signed-in surface, so the store IS available here (unlike the public route):
// candidates come from the owner's own public claims + stories (read straight
// through claims_public / the public stories endpoints), the catalog supplies
// entity names, and the saved selection comes from GET /api/me/stack. Editing
// rewrites the whole set via PUT (the "rebuilt on each edit" model). Reorder is
// move-up / move-down (decision D1 — no drag-and-drop dependency). A brand-new
// owner is seeded with a suggested starter they can trim and publish in two taps
// (decision D7). There is intentionally no "+" claim affordance anywhere (D3).

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Nav } from "@/components/ui/nav"
import { MeSubNav } from "@/components/ui/me-subnav"
import { useLineageStore, isAuthUser } from "@/store/lineage-store"
import { supabase } from "@/lib/supabase"
import { cn, formatDateRange } from "@/lib/utils"
import type {
  Claim, Story, PublicStackEntry, PublicStackEntryType, PublicStackCategoryKey,
} from "@/types"

const TARGET_MIN = 6
const TARGET_SOFT_MAX = 15
const HARD_MAX = 20

const TYPE_CHIP: Record<PublicStackEntryType, { label: string; cls: string }> = {
  story: { label: "Story", cls: "text-violet-700 bg-violet-500/10" },
  place: { label: "Place", cls: "text-teal-700 bg-teal-500/10" },
  event: { label: "Event", cls: "text-amber-700 bg-amber-500/10" },
  board: { label: "Board", cls: "text-emerald-700 bg-emerald-500/10" },
  rider: { label: "Rider", cls: "text-violet-700 bg-violet-500/10" },
  category_summary: { label: "Summary", cls: "text-blue-700 bg-blue-500/10" },
}

const CATEGORY_LABEL: Record<PublicStackCategoryKey, string> = {
  places: "Places summary", boards: "Boards summary", events: "Events summary",
  riders: "Riders summary", stories: "Stories summary",
}

const EVENT_PREDICATES = new Set(["competed_at", "spectated_at", "organized_at", "organized"])

type Candidate = {
  uid: string
  entry_type: PublicStackEntryType
  entry_ref_id: string | null
  category_key: PublicStackCategoryKey | null
  label: string
  sublabel: string | null
  group: "story" | "place" | "board" | "event" | "rider" | "summary"
  year: number | null
  photoCount: number
  hasStory: boolean
}

type SelEntry = {
  uid: string
  entry_type: PublicStackEntryType
  entry_ref_id: string | null
  category_key: PublicStackCategoryKey | null
  custom_title: string
  custom_summary: string
  label: string
  sublabel: string | null
  year: number | null
}

function yearOf(date?: string | null): number | null {
  if (!date) return null
  const y = parseInt(String(date).slice(0, 4))
  return Number.isFinite(y) && y > 0 ? y : null
}

export default function MePublicViewPage() {
  const { activePersonId, authReady, catalog, catalogLoaded, addToast } = useLineageStore()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [claims, setClaims] = useState<Claim[]>([])
  const [stories, setStories] = useState<Story[]>([])
  const [saved, setSaved] = useState<PublicStackEntry[] | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [slug, setSlug] = useState<string | null>(null)
  const [origin, setOrigin] = useState("")
  const [selection, setSelection] = useState<SelEntry[]>([])
  const [isStarter, setIsStarter] = useState(false)
  const [editingUid, setEditingUid] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const seededRef = useRef(false)

  useEffect(() => { if (typeof window !== "undefined") setOrigin(window.location.origin) }, [])

  // ── Load the owner's public claims + stories + current saved stack ──
  useEffect(() => {
    if (!authReady) return
    if (!isAuthUser(activePersonId)) { setLoading(false); return }

    let cancelled = false
    Promise.all([
      fetch("/api/me/stack").then((r) => r.json()).catch(() => ({ entries: [] })),
      fetch("/api/me/public-timeline").then((r) => r.json()).catch(() => ({ enabled: false, slug: null })),
      supabase.from("claims_public").select("*").eq("subject_id", activePersonId).eq("visibility", "public")
        .then(({ data }) => (data ?? []) as Claim[]),
      Promise.all([
        // on_timeline=true only: the stack mirrors the public timeline, so a
        // story kept off the author's timeline is not offered as a stack entry.
        fetch(`/api/stories?author_id=${activePersonId}&on_timeline=true&limit=100`).then((r) => r.json()).catch(() => []),
        fetch(`/api/stories?rider_id=${activePersonId}&limit=100`).then((r) => r.json()).catch(() => []),
      ]).then(([a, b]) => {
        const byId = new Map<string, Story>()
        for (const s of (Array.isArray(a) ? a : []) as Story[]) byId.set(s.id, s)
        for (const s of (Array.isArray(b) ? b : []) as Story[]) byId.set(s.id, s)
        return Array.from(byId.values()).filter((s) => s.visibility === "public")
      }),
    ]).then(([stackRes, ptRes, claimRows, storyRows]) => {
      if (cancelled) return
      setSaved((stackRes?.entries ?? []) as PublicStackEntry[])
      setEnabled(Boolean(ptRes?.enabled))
      setSlug(ptRes?.slug ?? null)
      setClaims(claimRows)
      setStories(storyRows)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [authReady, activePersonId])

  // ── Build the candidate set from the loaded claims + stories + catalog ──
  const candidates = useMemo<Candidate[]>(() => {
    if (!catalogLoaded) return []
    const out: Candidate[] = []
    const storyBoardIds = new Set<string>()
    for (const s of stories) for (const b of s.board_ids ?? []) storyBoardIds.add(b)

    // Stories
    for (const s of stories) {
      out.push({
        uid: `story:${s.id}`, entry_type: "story", entry_ref_id: s.id, category_key: null,
        label: s.title || (s.body ?? "").split("\n")[0].slice(0, 60) || "Untitled story",
        sublabel: yearOf(s.story_date) ? String(yearOf(s.story_date)) : null,
        group: "story", year: yearOf(s.story_date), photoCount: s.photos?.length ?? 0, hasStory: true,
      })
    }

    // Claim-derived: dedupe per entity, keep earliest start for the year hint.
    const placeYears = new Map<string, { start?: string; end?: string }>()
    const boardSeen = new Set<string>()
    const eventSeen = new Set<string>()
    const riderSeen = new Set<string>()

    for (const c of claims) {
      if (!c.object_id) continue
      if (c.object_type === "place" && (c.predicate === "rode_at" || c.predicate === "worked_at")) {
        const cur = placeYears.get(c.object_id)
        if (!cur) placeYears.set(c.object_id, { start: c.start_date, end: c.end_date })
      } else if (c.object_type === "board" && c.predicate === "owned_board" && !boardSeen.has(c.object_id)) {
        boardSeen.add(c.object_id)
        const b = catalog.boards.find((x) => x.id === c.object_id)
        if (b) out.push({
          uid: `board:${b.id}`, entry_type: "board", entry_ref_id: b.id, category_key: null,
          label: `${b.brand} ${b.model}`, sublabel: b.model_year ? `'${String(b.model_year).slice(2)}` : null,
          group: "board", year: b.model_year ?? yearOf(c.start_date), photoCount: 0, hasStory: storyBoardIds.has(b.id),
        })
      } else if (c.object_type === "event" && EVENT_PREDICATES.has(c.predicate) && !eventSeen.has(c.object_id)) {
        eventSeen.add(c.object_id)
        const e = catalog.events.find((x) => x.id === c.object_id)
        if (e) out.push({
          uid: `event:${e.id}`, entry_type: "event", entry_ref_id: e.id, category_key: null,
          label: e.name, sublabel: (e.year ?? yearOf(e.start_date)) ? String(e.year ?? yearOf(e.start_date)) : null,
          group: "event", year: e.year ?? yearOf(e.start_date), photoCount: 0, hasStory: false,
        })
      } else if (c.object_type === "person" && c.predicate === "rode_with" && !riderSeen.has(c.object_id)) {
        riderSeen.add(c.object_id)
        const p = catalog.people.find((x) => x.id === c.object_id)
        if (p) out.push({
          uid: `rider:${p.id}`, entry_type: "rider", entry_ref_id: p.id, category_key: null,
          label: `Rode with ${p.display_name}`, sublabel: formatDateRange(c.start_date, c.end_date) || null,
          group: "rider", year: yearOf(c.start_date), photoCount: 0, hasStory: false,
        })
      }
    }
    for (const [id, span] of placeYears) {
      const pl = catalog.places.find((x) => x.id === id)
      if (!pl) continue
      out.push({
        uid: `place:${id}`, entry_type: "place", entry_ref_id: id, category_key: null,
        label: pl.name, sublabel: formatDateRange(span.start, span.end) || null,
        group: "place", year: yearOf(span.start), photoCount: 0, hasStory: false,
      })
    }

    // Category summaries — offered when the category has at least one item.
    const counts: Record<PublicStackCategoryKey, number> = {
      places: placeYears.size, boards: boardSeen.size, events: eventSeen.size,
      riders: riderSeen.size, stories: stories.length,
    }
    ;(Object.keys(counts) as PublicStackCategoryKey[]).forEach((key) => {
      if (counts[key] > 0) out.push({
        uid: `summary:${key}`, entry_type: "category_summary", entry_ref_id: null, category_key: key,
        label: CATEGORY_LABEL[key], sublabel: `${counts[key]} item${counts[key] === 1 ? "" : "s"}`,
        group: "summary", year: null, photoCount: 0, hasStory: false,
      })
    })

    return out
  }, [claims, stories, catalog, catalogLoaded])

  const candByKey = useMemo(() => new Map(candidates.map((c) => [c.uid, c])), [candidates])

  // ── Seed the editing selection once: saved set if any, else suggested starter.
  useEffect(() => {
    if (seededRef.current) return
    if (loading || !catalogLoaded || saved === null) return
    seededRef.current = true

    if (saved.length > 0) {
      setSelection(saved.map((e): SelEntry => {
        const uid = e.entry_type === "category_summary" ? `summary:${e.category_key}` : `${e.entry_type}:${e.entry_ref_id}`
        const cand = candByKey.get(uid)
        return {
          uid, entry_type: e.entry_type, entry_ref_id: e.entry_ref_id, category_key: e.category_key,
          custom_title: e.custom_title ?? "", custom_summary: e.custom_summary ?? "",
          label: cand?.label ?? (e.category_key ? CATEGORY_LABEL[e.category_key] : "(no longer available)"),
          sublabel: cand?.sublabel ?? null, year: cand?.year ?? null,
        }
      }))
      return
    }

    // Suggested starter (D7): photo-rich stories + first/latest place + boards
    // that have a story + one of each category summary, capped at 10.
    const picks: Candidate[] = []
    const seen = new Set<string>()
    const take = (c?: Candidate) => { if (c && !seen.has(c.uid) && picks.length < 10) { seen.add(c.uid); picks.push(c) } }

    const storyCands = candidates.filter((c) => c.group === "story")
    storyCands.slice().sort((a, b) => b.photoCount - a.photoCount).slice(0, 3).forEach(take)
    const placeCands = candidates.filter((c) => c.group === "place" && c.year !== null)
      .slice().sort((a, b) => (a.year ?? 0) - (b.year ?? 0))
    take(placeCands[0]); take(placeCands[placeCands.length - 1])
    candidates.filter((c) => c.group === "board" && c.hasStory).slice(0, 2).forEach(take)
    ;(["places", "boards", "events", "riders", "stories"] as PublicStackCategoryKey[])
      .forEach((k) => take(candByKey.get(`summary:${k}`)))

    if (picks.length > 0) {
      setIsStarter(true)
      setSelection(picks.map((c) => ({
        uid: c.uid, entry_type: c.entry_type, entry_ref_id: c.entry_ref_id, category_key: c.category_key,
        custom_title: "", custom_summary: "", label: c.label, sublabel: c.sublabel, year: c.year,
      })))
    }
  }, [loading, catalogLoaded, saved, candidates, candByKey])

  // ── Selection ops ──
  const selectedUids = useMemo(() => new Set(selection.map((s) => s.uid)), [selection])

  const addCandidate = useCallback((c: Candidate) => {
    setIsStarter(false)
    setSelection((prev) => {
      if (prev.some((s) => s.uid === c.uid) || prev.length >= HARD_MAX) return prev
      return [...prev, {
        uid: c.uid, entry_type: c.entry_type, entry_ref_id: c.entry_ref_id, category_key: c.category_key,
        custom_title: "", custom_summary: "", label: c.label, sublabel: c.sublabel, year: c.year,
      }]
    })
  }, [])

  const removeUid = useCallback((uid: string) => {
    setIsStarter(false)
    setSelection((prev) => prev.filter((s) => s.uid !== uid))
  }, [])

  const move = useCallback((idx: number, dir: -1 | 1) => {
    setIsStarter(false)
    setSelection((prev) => {
      const next = [...prev]
      const j = idx + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[idx], next[j]] = [next[j], next[idx]]
      return next
    })
  }, [])

  const setCustom = useCallback((uid: string, patch: Partial<Pick<SelEntry, "custom_title" | "custom_summary">>) => {
    setIsStarter(false)
    setSelection((prev) => prev.map((s) => (s.uid === uid ? { ...s, ...patch } : s)))
  }, [])

  const sortByYear = useCallback(() => {
    setIsStarter(false)
    setSelection((prev) => [...prev].sort((a, b) => {
      // Summaries (no year) sink to the end; otherwise chronological.
      if (a.year === null && b.year === null) return 0
      if (a.year === null) return 1
      if (b.year === null) return -1
      return a.year - b.year
    }))
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/me/stack", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: selection.map((s) => ({
            entry_type: s.entry_type, entry_ref_id: s.entry_ref_id, category_key: s.category_key,
            custom_title: s.custom_title || undefined, custom_summary: s.custom_summary || undefined,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) { addToast(data?.error ?? "Could not save your stack.", "error"); return }
      setSaved((data.entries ?? []) as PublicStackEntry[])
      setIsStarter(false)
      addToast(enabled ? "Stack saved. Share your link below." : "Stack saved. Turn on your public timeline to share it.")
    } catch {
      addToast("Could not save your stack.", "error")
    } finally {
      setSaving(false)
    }
  }

  const publicUrl = slug ? `${origin}/t/${slug}` : ""
  const copy = async () => {
    if (!publicUrl) return
    try { await navigator.clipboard.writeText(publicUrl); setCopied(true); setTimeout(() => setCopied(false), 1800) }
    catch { addToast("Could not copy. Select the link manually.", "error") }
  }

  // ── Render ──
  if (!authReady || loading || !catalogLoaded) {
    return (<><Nav /><MeSubNav /><main className="max-w-5xl mx-auto px-4 py-8 text-muted text-sm">Loading…</main></>)
  }
  if (!isAuthUser(activePersonId)) {
    return (<><Nav /><MeSubNav /><main className="max-w-5xl mx-auto px-4 py-8 text-muted text-sm">Sign in to manage your public view.</main></>)
  }

  const grouped: { key: Candidate["group"]; label: string }[] = [
    { key: "story", label: "Stories" }, { key: "place", label: "Places" },
    { key: "board", label: "Boards" }, { key: "event", label: "Events" },
    { key: "rider", label: "Riders" }, { key: "summary", label: "Category summaries" },
  ]

  const count = selection.length

  return (
    <>
      <Nav />
      <MeSubNav />
      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
          <h1 className="text-2xl font-semibold text-foreground">Your public view (Stack)</h1>
          <Link href="/me/settings/public-timeline" className="text-xs text-accent-strong hover:underline">
            ← Public timeline settings
          </Link>
        </div>
        <p className="text-sm text-muted mb-5 max-w-2xl">
          Hand-pick a short, scannable set of highlights to lead with — the moments you want people to
          see first when you share your link. Aim for {TARGET_MIN}–12 cards.
        </p>

        {!enabled && (
          <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
            <span className="text-foreground">Your public timeline is off.</span>{" "}
            <Link href="/me/settings/public-timeline" className="text-accent-strong hover:underline">Turn it on</Link>{" "}
            <span className="text-muted">so your shareable link works. You can still curate your stack here.</span>
          </div>
        )}

        {isStarter && (
          <div className="mb-5 rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 text-sm text-muted">
            <span className="text-foreground font-medium">Here&apos;s a starter stack we drafted for you.</span>{" "}
            Trim it, reorder it, then Save — or clear it and start fresh.
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* ── Selected (the stack) ── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">
                Your stack <span className="text-muted font-normal">({count})</span>
              </h2>
              <div className="flex items-center gap-2">
                {count > 1 && (
                  <button onClick={sortByYear} className="text-xs text-muted hover:text-foreground border border-border-default rounded-lg px-2 py-1 transition-colors">
                    Sort by year
                  </button>
                )}
                {count > 0 && (
                  <button onClick={() => { setSelection([]); setIsStarter(false) }} className="text-xs text-muted hover:text-foreground border border-border-default rounded-lg px-2 py-1 transition-colors">
                    Clear
                  </button>
                )}
              </div>
            </div>

            {count === 0 ? (
              <p className="text-sm text-muted border border-dashed border-border-default rounded-xl p-6 text-center">
                Nothing selected yet. Add highlights from the right.
              </p>
            ) : (
              <div className="space-y-2">
                {selection.map((s, idx) => (
                  <div key={s.uid} className="rounded-xl border border-border-default bg-surface p-3">
                    <div className="flex items-start gap-2">
                      <div className="flex flex-col gap-0.5 pt-0.5">
                        <button onClick={() => move(idx, -1)} disabled={idx === 0}
                          className="text-muted hover:text-foreground disabled:opacity-30 text-xs leading-none" aria-label="Move up">▲</button>
                        <button onClick={() => move(idx, 1)} disabled={idx === count - 1}
                          className="text-muted hover:text-foreground disabled:opacity-30 text-xs leading-none" aria-label="Move down">▼</button>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={cn("text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded", TYPE_CHIP[s.entry_type].cls)}>
                            {s.entry_type === "category_summary" && s.category_key ? CATEGORY_LABEL[s.category_key] : TYPE_CHIP[s.entry_type].label}
                          </span>
                          {(s.custom_title || s.custom_summary) && (
                            <span className="text-[9px] text-muted uppercase tracking-wider">edited</span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-foreground truncate">{s.custom_title || s.label}</p>
                        {(s.custom_summary || s.sublabel) && (
                          <p className="text-xs text-muted truncate">{s.custom_summary || s.sublabel}</p>
                        )}

                        {editingUid === s.uid && (
                          <div className="mt-2 space-y-2">
                            <input value={s.custom_title} onChange={(e) => setCustom(s.uid, { custom_title: e.target.value })}
                              placeholder="Custom title (optional)" maxLength={200}
                              className="w-full bg-background border border-border-default rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-blue-500" />
                            <input value={s.custom_summary} onChange={(e) => setCustom(s.uid, { custom_summary: e.target.value })}
                              placeholder="Custom summary line (optional)" maxLength={600}
                              className="w-full bg-background border border-border-default rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-blue-500" />
                          </div>
                        )}

                        <div className="flex items-center gap-3 mt-1.5">
                          {s.entry_type !== "category_summary" && (
                            <button onClick={() => setEditingUid(editingUid === s.uid ? null : s.uid)}
                              className="text-[11px] text-muted hover:text-foreground transition-colors">
                              {editingUid === s.uid ? "Done" : "Edit text"}
                            </button>
                          )}
                          <button onClick={() => removeUid(s.uid)} className="text-[11px] text-red-500 hover:text-red-400 transition-colors">
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {count > 0 && count < TARGET_MIN && (
              <p className="text-xs text-muted mt-3">Add a few more — stacks land best around {TARGET_MIN}–12 cards.</p>
            )}
            {count > TARGET_SOFT_MAX && (
              <p className="text-xs text-amber-600 mt-3">Getting long. The tightest stacks stay near {TARGET_MIN}–12 ({HARD_MAX} max).</p>
            )}

            <div className="mt-4 flex items-center gap-3">
              <button onClick={save} disabled={saving}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors">
                {saving ? "Saving…" : "Save stack"}
              </button>
              {slug && (
                <a href={`/t/${slug}?view=stack`} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-accent-strong hover:underline">Preview ↗</a>
              )}
            </div>

            {slug && (
              <div className="mt-4 rounded-xl border border-border-default bg-surface p-3">
                <div className="text-[10px] font-semibold text-muted uppercase tracking-widest mb-2">Your public link</div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <code className="flex-1 min-w-0 text-xs text-foreground bg-surface-hover border border-border-default rounded-lg px-3 py-2 truncate">{publicUrl}</code>
                  <button onClick={copy} className="px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-500 transition-colors flex-shrink-0">
                    {copied ? "Copied" : "Copy link"}
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* ── Candidate picker ── */}
          <section>
            <h2 className="text-sm font-semibold text-foreground mb-3">Add from your timeline</h2>
            {candidates.length === 0 ? (
              <p className="text-sm text-muted">Add some public claims and stories first, then they will show up here.</p>
            ) : (
              <div className="space-y-5">
                {grouped.map(({ key, label }) => {
                  const items = candidates.filter((c) => c.group === key)
                  if (items.length === 0) return null
                  return (
                    <div key={key}>
                      <div className="text-[10px] font-semibold text-muted uppercase tracking-widest mb-2">{label}</div>
                      <div className="space-y-1.5">
                        {items.map((c) => {
                          const added = selectedUids.has(c.uid)
                          const atMax = count >= HARD_MAX
                          return (
                            <div key={c.uid} className="flex items-center gap-2 rounded-lg border border-border-default bg-surface px-3 py-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-foreground truncate">{c.label}</p>
                                {c.sublabel && <p className="text-[11px] text-muted truncate">{c.sublabel}</p>}
                              </div>
                              <button
                                onClick={() => (added ? removeUid(c.uid) : addCandidate(c))}
                                disabled={!added && atMax}
                                className={cn(
                                  "text-xs font-medium rounded-lg px-2.5 py-1 transition-colors flex-shrink-0 border",
                                  added
                                    ? "border-blue-600 text-blue-700 bg-blue-500/10"
                                    : atMax
                                      ? "border-border-default text-muted opacity-50 cursor-not-allowed"
                                      : "border-border-default text-muted hover:text-foreground hover:border-foreground/30",
                                )}
                              >
                                {added ? "Added ✓" : "Add"}
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  )
}
