"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

// Catalog provenance, Phase 1. Reads board_sources (public-read) and lists the
// primary-source catalogues a board is documented in, as DISCRETE years. It
// deliberately does NOT draw a continuous range: our sightings are sparse, so a
// gap is a year we have not sourced, not a year the board was absent. See
// data/catalog/review/provenance-layer-spec.md.

interface BoardSource {
  id: string
  publisher: string
  doc_title: string | null
  source_url: string
  page: number | null
  model_year: number | null
}

export function BoardSources({ boardId }: { boardId: string }) {
  const [sources, setSources] = useState<BoardSource[] | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase
      .from("board_sources")
      .select("id, publisher, doc_title, source_url, page, model_year")
      .eq("board_id", boardId)
      .eq("kind", "existence")
      .then(({ data }) => { if (!cancelled) setSources((data as BoardSource[]) ?? []) })
    return () => { cancelled = true }
  }, [boardId])

  // Render nothing until loaded, and nothing for boards with no citations.
  if (!sources || sources.length === 0) return null

  // Earliest documented year first, then publisher. Discrete rows, never a span.
  const sorted = [...sources].sort(
    (a, b) => (a.model_year ?? 9999) - (b.model_year ?? 9999) || a.publisher.localeCompare(b.publisher),
  )
  const earliest = sorted.find((s) => s.model_year != null)?.model_year ?? null

  return (
    <div className="bg-surface border border-border-default rounded-xl p-6 mb-6">
      <h2 className="text-xs font-semibold text-muted uppercase tracking-widest mb-1">Documented in</h2>
      <p className="text-xs text-muted mb-3">
        Primary-source catalogues this board appears in
        {earliest != null ? <>, first documented <span className="tabular-nums">{earliest}</span></> : null}. Each
        entry is a specific year and graphic; gaps are years we have not sourced yet, not years the board was absent.
      </p>
      <ul className="space-y-1.5">
        {sorted.map((s) => (
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
