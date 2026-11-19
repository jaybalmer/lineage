"use client"

// Seeded board image takedown (board-image-seeding brief, D7). Lists flagged and
// recent seeded images with Remove, plus a remove-every-row-from-a-publisher action
// for a rights-holder request. Gated server-side by src/app/admin/layout.tsx; the
// API route enforces requireEditor independently.

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { CommunityLink } from "@/components/ui/community-link"
import { Nav } from "@/components/ui/nav"
import { useLineageStore } from "@/store/lineage-store"
import { seededCaption } from "@/lib/board-seeded-image"

type Row = {
  id: string
  board_id: string
  publisher: string
  doc_title: string | null
  page: number | null
  source_url: string
  image_url: string | null
  hosted_url: string | null
  source_tier: number | null
  model_year: number | null
  created_at: string
  flags?: number
  boards: { brand: string; model: string; model_year: number } | null
}

const REASON_PLACEHOLDER = "Rights holder request, wrong board, poor quality"

function ImageRow({ row, onRemove }: { row: Row; onRemove: (id: string, reason: string) => Promise<void> }) {
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const src = row.hosted_url ?? row.image_url ?? ""
  return (
    <li className="flex gap-3 items-start bg-surface border border-border-default rounded-lg p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="w-16 h-20 object-cover rounded bg-surface-2 shrink-0" />
      <div className="flex-1 min-w-0 space-y-1">
        <div className="text-sm font-semibold text-foreground truncate">
          <CommunityLink href={`/boards/${row.board_id}`} className="hover:underline">
            {row.boards ? `${row.boards.brand} ${row.boards.model} ${row.boards.model_year}` : row.board_id}
          </CommunityLink>
          {row.flags ? <span className="ml-2 text-xs text-red-500">🚩 {row.flags}</span> : null}
        </div>
        <a href={row.source_url} target="_blank" rel="noopener noreferrer" className="block text-xs text-muted hover:text-foreground truncate">
          Tier {row.source_tier ?? "?"} · {seededCaption(row)} ↗
        </a>
        <div className="flex gap-2">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={REASON_PLACEHOLDER}
            className="flex-1 min-w-0 text-xs bg-background border border-border-default rounded px-2 py-1"
          />
          <button
            disabled={busy || !reason.trim()}
            onClick={async () => { setBusy(true); await onRemove(row.id, reason); setBusy(false) }}
            className="text-xs px-2 py-1 rounded bg-red-600 text-white disabled:opacity-40"
          >
            Remove
          </button>
        </div>
      </div>
    </li>
  )
}

export default function AdminBoardImagesPage() {
  const addToast = useLineageStore((s) => s.addToast)
  const [data, setData] = useState<{ flagged: Row[]; recent: Row[]; publishers: Record<string, number> } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pub, setPub] = useState("")
  const [pubReason, setPubReason] = useState("")

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/board-images")
    if (!res.ok) { setError(`Could not load (${res.status})`); return }
    setData(await res.json())
  }, [])
  useEffect(() => { load() }, [load])

  async function remove(body: Record<string, string>) {
    const res = await fetch("/api/admin/board-images", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) { addToast(json.error ?? "Remove failed", "error"); return }
    addToast(`Removed ${json.removed} image${json.removed === 1 ? "" : "s"}.`, "info")
    await load()
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        <div>
          <Link href="/admin" className="text-xs text-muted hover:text-foreground">Admin</Link>
          <h1 className="text-2xl font-bold mt-1">Board images</h1>
          <p className="text-sm text-muted mt-1">
            Seeded placeholder images. Removal is soft: the row is kept with its reason and the seeder never re-adds it.
          </p>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {!data && !error && <p className="text-sm text-muted">Loading…</p>}

        {data && (
          <>
            <section className="space-y-2">
              <h2 className="text-xs font-semibold text-muted uppercase tracking-widest">Remove everything from a publisher</h2>
              <div className="flex flex-wrap gap-2">
                <select value={pub} onChange={(e) => setPub(e.target.value)} className="text-sm bg-background border border-border-default rounded px-2 py-1">
                  <option value="">Choose publisher</option>
                  {Object.entries(data.publishers).sort((a, b) => b[1] - a[1]).map(([p, n]) => (
                    <option key={p} value={p}>{p} ({n})</option>
                  ))}
                </select>
                <input
                  value={pubReason}
                  onChange={(e) => setPubReason(e.target.value)}
                  placeholder={REASON_PLACEHOLDER}
                  className="flex-1 min-w-[12rem] text-sm bg-background border border-border-default rounded px-2 py-1"
                />
                <button
                  disabled={!pub || !pubReason.trim()}
                  onClick={async () => {
                    if (!window.confirm(`Remove all ${data.publishers[pub]} seeded images from ${pub}?`)) return
                    await remove({ publisher: pub, reason: pubReason })
                    setPub(""); setPubReason("")
                  }}
                  className="text-sm px-3 py-1 rounded bg-red-600 text-white disabled:opacity-40"
                >
                  Remove all
                </button>
              </div>
            </section>

            <section className="space-y-2">
              <h2 className="text-xs font-semibold text-muted uppercase tracking-widest">Flagged ({data.flagged.length})</h2>
              {data.flagged.length === 0
                ? <p className="text-sm text-muted">No flagged seeded images.</p>
                : <ul className="space-y-2">{data.flagged.map((r) => <ImageRow key={r.id} row={r} onRemove={(id, reason) => remove({ id, reason })} />)}</ul>}
            </section>

            <section className="space-y-2">
              <h2 className="text-xs font-semibold text-muted uppercase tracking-widest">Recently seeded</h2>
              {data.recent.length === 0
                ? <p className="text-sm text-muted">No seeded images yet.</p>
                : <ul className="space-y-2">{data.recent.map((r) => <ImageRow key={r.id} row={r} onRemove={(id, reason) => remove({ id, reason })} />)}</ul>}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
