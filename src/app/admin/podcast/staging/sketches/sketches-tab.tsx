"use client"

// Podcast archive staging: the Sketches tab (brief Parts B and C).
//
// Fetches the live staging payload once per tab open and keeps it in component
// state (about 3 MB; never the Zustand store or localStorage). The two toggles
// re-derive the drawing data from that payload and remount the engine:
//   - Show trimmed (B3): trimmed stories are left out by default; on, they draw dimmed.
//   - Show host (B4): the host is in every episode and flattens the
//     Constellation, so he is left out by default.
// The map's land outlines (545 KB) load only when the Map view first opens.
//
// Part C: every story card in the panel gets the same StoryActions control as
// the list views, rendered into the engine's slots through portals (so it keeps
// the app's router context). A saved decision updates the card in place and,
// with trimmed stories hidden, drops a newly trimmed story from the drawing.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { StoryDecision } from "@/lib/podcast-staging"
import type { SketchPayload } from "@/lib/podcast-sketches"
import { StoryActions } from "../staging-actions"
import { mountSketches } from "./sketch-engine"
import type { ActionSlot, EngineData, EngineHandle, MapAssets } from "./sketch-engine"
import "./sketches.css"

const BASE = "/admin/podcast/staging"
const nodeHref = (id: string) => `${BASE}/nodes/${id}`

async function loadMap(): Promise<MapAssets> {
  const [land, coords] = await Promise.all([
    import("@/data/podcast-sketches/land-50m.json"),
    import("@/data/podcast-sketches/place-coords.json"),
  ])
  return {
    land: (land.default ?? land) as unknown as MapAssets["land"],
    coords: (coords.default ?? coords) as unknown as MapAssets["coords"],
  }
}

/** Apply the toggles: drop trimmed stories and the host, then re-run the two-episode rule. */
function derive(p: SketchPayload, showTrimmed: boolean, showHost: boolean): EngineData {
  const stories = p.stories
    .filter((s) => showTrimmed || s[5] !== "trimmed")
    .map((s) => ({ s, ids: showHost ? s[4] : s[4].filter((i) => !p.nodes[i][4]) }))
    .filter((x) => x.ids.length > 0)

  const eps = new Map<number, Set<number>>()
  const st = new Map<number, number>()
  const kept = new Map<number, number>() // stories that are not trimmed
  for (const { s, ids } of stories) {
    for (const i of ids) {
      let set = eps.get(i)
      if (!set) eps.set(i, (set = new Set()))
      set.add(s[0])
      st.set(i, (st.get(i) ?? 0) + 1)
      if (s[5] !== "trimmed") kept.set(i, (kept.get(i) ?? 0) + 1)
    }
  }
  const order = [...eps.keys()]
    .filter((i) => (eps.get(i)?.size ?? 0) >= 2)
    .sort((a, b) => eps.get(b)!.size - eps.get(a)!.size || st.get(b)! - st.get(a)! || p.nodes[a][1].localeCompare(p.nodes[b][1]))
  const re = new Map(order.map((old, i) => [old, i]))

  const S = stories
    .map(({ s, ids }) => {
      // C5: a range of more than 3 years is a span, drawn faint on the Path, not a dot per year.
      const a = s[7], z = s[8] ?? s[7]
      const wide = a != null && z != null && z - a > 3
      const ys = a != null && z != null && !wide ? Array.from({ length: z - a + 1 }, (_, k) => a + k) : []
      const span: [number, number] | null = wide ? [a as number, z as number] : null
      return { ep: s[0], ts: s[1], title: s[2], ex: s[3], ids: ids.map((i) => re.get(i)).filter((i): i is number => i !== undefined), ys, span, decision: s[5], id: s[6] }
    })
    .filter((s) => s.ids.length > 0)

  return {
    N: order.map((i) => {
      const n = p.nodes[i]
      return { id: n[0], name: n[1], t: n[2], decision: n[3], eps: eps.get(i)!.size, st: st.get(i)!, trimmedOnly: !kept.get(i) }
    }),
    S,
    E: p.episodes,
    meta: { episodes: p.meta.episodes, stories_with_year: S.filter((s) => s.ys.length || s.span).length, trimmed_shown: showTrimmed, host_shown: showHost },
  }
}

export function SketchesTab() {
  const [payload, setPayload] = useState<SketchPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showTrimmed, setShowTrimmed] = useState(false)
  const [showHost, setShowHost] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<EngineHandle | null>(null)
  const [slots, setSlots] = useState<ActionSlot[]>([])

  useEffect(() => {
    let live = true
    fetch("/api/admin/podcast-staging/sketches", { cache: "no-store" })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(body.error ?? `Request failed (${r.status})`)
        return body as SketchPayload
      })
      .then((p) => { if (live) setPayload(p) })
      .catch((e: Error) => { if (live) setError(e.message) })
    return () => { live = false }
  }, [])

  const data = useMemo(() => (payload ? derive(payload, showTrimmed, showHost) : null), [payload, showTrimmed, showHost])

  useEffect(() => {
    if (!data || !rootRef.current) return
    const engine = mountSketches(rootRef.current, data, loadMap, { onActionSlots: setSlots, nodeHref })
    engineRef.current = engine
    return () => { engineRef.current = null; engine.destroy() }
  }, [data])

  // A decision saved from a story card: update the engine in place, and the
  // payload too (mutated, not re-set, so the drawing does not remount) so the
  // next toggle derives from the new decision.
  const onDecided = useCallback((storyId: string, decision: StoryDecision) => {
    const row = payload?.stories.find((s) => s[6] === storyId)
    if (row) row[5] = decision
    engineRef.current?.setStoryDecision(storyId, decision)
  }, [payload])

  if (error) {
    return <p className="text-sm text-red-600 dark:text-red-400">Could not load the sketches: {error}</p>
  }
  if (!payload) {
    return (
      <p className="text-sm text-muted" role="status">
        Loading every staged story and node. This is a few megabytes, so it takes a moment.
      </p>
    )
  }

  return (
    <section>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-3 text-sm text-muted">
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={showTrimmed} onChange={(e) => setShowTrimmed(e.target.checked)} />
          Show trimmed
        </label>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={showHost} onChange={(e) => setShowHost(e.target.checked)} />
          Show host
        </label>
        <span className="text-xs">Live from staging, loaded {new Date(payload.meta.built_at).toLocaleTimeString()}. Reload the page to pick up new decisions.</span>
      </div>
      <div ref={rootRef} className="sk-root" />
      {slots.map((slot) =>
        createPortal(
          <StoryActions
            story={{ id: slot.id, decision: slot.decision as StoryDecision, revision_pending: null, excerpt: "" }}
            onDecided={(d) => onDecided(slot.id, d)}
          />,
          slot.el,
          `${slot.id}:${slot.decision}`,
        ),
      )}
    </section>
  )
}
