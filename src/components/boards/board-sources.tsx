"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

// Catalog provenance. Phase 1 lists the primary-source catalogues a board is
// documented in ("Documented in"); Phase 2 adds a single "View in catalogue"
// pointer at the board image (earliest sighting) so the image - or the brand-logo
// placeholder when there is no photo - links to where that year's graphic lives.
//
// Citations are DISCRETE years, never a continuous range: our sightings are sparse,
// so a gap is a year we have not sourced, not a year the board was absent. No
// third-party image is re-hosted; this layer only cites and links.
// See data/catalog/review/provenance-layer-spec.md.

export interface BoardSource {
  id: string
  publisher: string
  doc_title: string | null
  source_url: string
  page: number | null
  model_year: number | null
}

/** Fetch a board's existence citations once, earliest documented year first. */
export function useBoardSources(boardId: string | undefined): BoardSource[] | null {
  const [sources, setSources] = useState<BoardSource[] | null>(null)
  useEffect(() => {
    if (!boardId) { setSources([]); return }
    let cancelled = false
    supabase
      .from("board_sources")
      .select("id, publisher, doc_title, source_url, page, model_year")
      .eq("board_id", boardId)
      .eq("kind", "existence")
      .then(({ data }) => {
        if (cancelled) return
        const rows = ((data as BoardSource[]) ?? []).sort(
          (a, b) => (a.model_year ?? 9999) - (b.model_year ?? 9999) || a.publisher.localeCompare(b.publisher),
        )
        setSources(rows)
      })
    return () => { cancelled = true }
  }, [boardId])
  return sources
}

/**
 * The "Documented in" section for the board detail page. Pass `sources` to reuse a
 * fetch the page already made; omit it to self-fetch (keeps the component reusable).
 */
export function BoardSources({ boardId, sources: provided }: { boardId: string; sources?: BoardSource[] | null }) {
  const fetched = useBoardSources(provided === undefined ? boardId : undefined)
  const sources = provided !== undefined ? provided : fetched

  if (!sources || sources.length === 0) return null
  const earliest = sources.find((s) => s.model_year != null)?.model_year ?? null

  return (
    <div className="bg-surface border border-border-default rounded-xl p-6 mb-6">
      <h2 className="text-xs font-semibold text-muted uppercase tracking-widest mb-1">Documented in</h2>
      <p className="text-xs text-muted mb-3">
        Primary-source catalogues this board appears in
        {earliest != null ? <>, first documented <span className="tabular-nums">{earliest}</span></> : null}. Each
        entry is a specific year and graphic; gaps are years we have not sourced yet, not years the board was absent.
      </p>
      <ul className="space-y-1.5">
        {sources.map((s) => (
          <li key={s.id} className="text-sm">
            <a
              href={s.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-strong hover:underline"
            >
              {s.model_year != null && <span className="tabular-nums font-medium">{s.model_year}</span>}
              {s.model_year != null ? " · " : ""}
              {s.doc_title || s.publisher}
              {s.page != null ? ` — p${s.page}` : ""}
              {" ↗"}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * A single compact "View in catalogue" pointer for the board image column. Uses the
 * earliest documented sighting (the historically significant one); the full list
 * lives in <BoardSources>. Renders nothing when the board has no citations.
 */
export function BoardImageCatalogueLink({ sources }: { sources: BoardSource[] | null }) {
  if (!sources || sources.length === 0) return null
  const earliest = sources.find((s) => s.model_year != null) ?? sources[0]
  const label = earliest.model_year != null ? `${earliest.model_year} catalogue` : "catalogue"
  return (
    <div className="mt-1.5 w-24 text-center leading-tight">
      <a
        href={earliest.source_url}
        target="_blank"
        rel="noopener noreferrer"
        title={`View this board in the ${earliest.doc_title || earliest.publisher}`}
        className="text-[10px] text-muted hover:text-accent-strong transition-colors"
      >
        📖 In the {label} ↗
      </a>
    </div>
  )
}
