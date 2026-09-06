"use client"

// Duplicate-person merge: the /admin/claims panel that folds a duplicate ghost
// node into a canonical person (member profile or people node) via
// POST /api/admin/merge-person -> public.merge_person_into. Dry-run first to see
// exactly what would move, then a typed-name confirm to commit. Sibling of
// AdminInvitePanel.

import { useRef, useState } from "react"

type GhostResult = { id: string; display_name: string; node_status: string }
type CanonResult = {
  id: string
  display_name: string
  node_status: string | null
  source: "profile" | "people"
  membership_tier: string | null
}

type MergeResult = {
  dry_run: boolean
  ghost_id: string
  canonical_id: string
  canonical_kind: string
  references_repointed: Record<string, string[]>
  references_deduplicated: Record<string, string[]>
  alias_rewrites: number
}

function totalRefs(obj: Record<string, string[]> | undefined): number {
  if (!obj) return 0
  return Object.values(obj).reduce((n, ids) => n + (Array.isArray(ids) ? ids.length : 0), 0)
}

function nonEmpty(obj: Record<string, string[]> | undefined): [string, number][] {
  if (!obj) return []
  return Object.entries(obj)
    .map(([k, ids]) => [k, Array.isArray(ids) ? ids.length : 0] as [string, number])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
}

export function AdminMergePanel() {
  const [ghostQuery, setGhostQuery] = useState("")
  const [ghostResults, setGhostResults] = useState<GhostResult[]>([])
  const [ghost, setGhost] = useState<GhostResult | null>(null)

  const [canonQuery, setCanonQuery] = useState("")
  const [canonResults, setCanonResults] = useState<CanonResult[]>([])
  const [canon, setCanon] = useState<CanonResult | null>(null)

  const [preview, setPreview] = useState<MergeResult | null>(null)
  const [confirmName, setConfirmName] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<MergeResult | null>(null)

  const ghostSeq = useRef(0)
  const canonSeq = useRef(0)

  async function searchGhost(q: string) {
    setGhostQuery(q)
    setGhost(null)
    setPreview(null)
    setDone(null)
    const trimmed = q.trim()
    if (trimmed.length < 2) return setGhostResults([])
    const seq = ++ghostSeq.current
    try {
      const res = await fetch(`/api/admin/invite-node?q=${encodeURIComponent(trimmed)}`)
      const data = (await res.json().catch(() => [])) as GhostResult[]
      if (seq === ghostSeq.current) setGhostResults(Array.isArray(data) ? data : [])
    } catch {
      if (seq === ghostSeq.current) setGhostResults([])
    }
  }

  async function searchCanon(q: string) {
    setCanonQuery(q)
    setCanon(null)
    setPreview(null)
    setDone(null)
    const trimmed = q.trim()
    if (trimmed.length < 2) return setCanonResults([])
    const seq = ++canonSeq.current
    try {
      const res = await fetch(`/api/admin/person-search?q=${encodeURIComponent(trimmed)}`)
      const data = (await res.json().catch(() => [])) as CanonResult[]
      if (seq === canonSeq.current) setCanonResults(Array.isArray(data) ? data : [])
    } catch {
      if (seq === canonSeq.current) setCanonResults([])
    }
  }

  async function runMerge(dryRun: boolean) {
    if (!ghost || !canon) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/merge-person", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ghost_id: ghost.id,
          canonical_id: canon.id,
          canonical_kind: canon.source === "profile" ? "profiles" : "people",
          dry_run: dryRun,
          confirm_name: dryRun ? undefined : confirmName.trim(),
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError((data as { error?: string } | null)?.error ?? "Merge failed")
        return
      }
      if (dryRun) setPreview(data as MergeResult)
      else {
        setDone(data as MergeResult)
        setPreview(null)
      }
    } catch {
      setError("Network error")
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setGhostQuery(""); setGhostResults([]); setGhost(null)
    setCanonQuery(""); setCanonResults([]); setCanon(null)
    setPreview(null); setConfirmName(""); setError(null); setDone(null)
  }

  const canCommit = !!preview && confirmName.trim() === ghost?.display_name && !busy

  return (
    <div className="postcard mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-bold text-gray-900">Merge a duplicate person</h2>
      <p className="mt-1 mb-3 text-xs text-gray-600">
        Fold a duplicate ghost node into the real person. Preview first, then type the ghost&apos;s
        exact name to commit. This repoints every reference and deletes the ghost.
      </p>

      {done ? (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-800">
          <div className="font-semibold">Merged.</div>
          <div className="mt-1">
            {totalRefs(done.references_repointed)} references repointed,{" "}
            {totalRefs(done.references_deduplicated)} deduplicated, {done.alias_rewrites} alias rewrites.
            The ghost is gone and old URLs now redirect to the canonical.
          </div>
          <button onClick={reset} className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-500">
            Merge another →
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Ghost picker */}
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Duplicate to fold away (ghost)
            </label>
            {ghost ? (
              <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <span className="text-sm text-gray-900">{ghost.display_name}</span>
                <button onClick={() => { setGhost(null); setPreview(null) }} className="text-xs text-gray-500 hover:text-gray-900">Change</button>
              </div>
            ) : (
              <>
                <input
                  value={ghostQuery}
                  onChange={(e) => searchGhost(e.target.value)}
                  placeholder="Search an unclaimed node…"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                />
                {ghostQuery.trim().length >= 2 && ghostResults.length > 0 && (
                  <div className="mt-1 divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200">
                    {ghostResults.map((r) => (
                      <button key={r.id} onClick={() => { setGhost(r); setGhostResults([]) }}
                        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-gray-50">
                        <span className="text-sm text-gray-900">{r.display_name}</span>
                        <span className="text-[11px] uppercase tracking-wider text-gray-400">{r.node_status}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Canonical picker */}
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Keep as the real person (canonical)
            </label>
            {canon ? (
              <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <span className="text-sm text-gray-900">
                  {canon.display_name}
                  <span className="ml-2 text-[11px] uppercase tracking-wider text-gray-400">
                    {canon.source === "profile" ? "member" : "node"}
                  </span>
                </span>
                <button onClick={() => { setCanon(null); setPreview(null) }} className="text-xs text-gray-500 hover:text-gray-900">Change</button>
              </div>
            ) : (
              <>
                <input
                  value={canonQuery}
                  onChange={(e) => searchCanon(e.target.value)}
                  placeholder="Search the person to keep…"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                />
                {canonQuery.trim().length >= 2 && canonResults.length > 0 && (
                  <div className="mt-1 divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200">
                    {canonResults.map((r) => (
                      <button key={`${r.source}:${r.id}`} onClick={() => { setCanon(r); setCanonResults([]) }}
                        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-gray-50">
                        <span className="text-sm text-gray-900">{r.display_name}</span>
                        <span className="text-[11px] uppercase tracking-wider text-gray-400">
                          {r.source === "profile" ? "member" : (r.node_status ?? "node")}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
          )}

          {/* Preview */}
          {ghost && canon && !preview && (
            <button
              onClick={() => runMerge(true)}
              disabled={busy}
              className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {busy ? "Previewing…" : "Preview merge (dry run)"}
            </button>
          )}

          {preview && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="text-xs font-semibold text-amber-900">
                Preview: {totalRefs(preview.references_repointed)} references would move,{" "}
                {totalRefs(preview.references_deduplicated)} deduplicated, into a {preview.canonical_kind === "profiles" ? "member" : "node"}.
              </div>
              <ul className="mt-2 space-y-0.5 text-[11px] text-amber-800">
                {nonEmpty(preview.references_repointed).map(([k, n]) => (
                  <li key={k}>{k}: {n}</li>
                ))}
                {nonEmpty(preview.references_deduplicated).map(([k, n]) => (
                  <li key={`d-${k}`}>{k}: {n} (deduplicated)</li>
                ))}
                {totalRefs(preview.references_repointed) === 0 && totalRefs(preview.references_deduplicated) === 0 && (
                  <li>No references to move; only the ghost row would be removed.</li>
                )}
              </ul>
              <label className="mt-3 block text-[11px] font-semibold text-amber-900">
                Type the ghost&apos;s exact name to commit: <span className="font-mono">{ghost?.display_name}</span>
              </label>
              <input
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                placeholder={ghost?.display_name}
                className="mt-1 w-full rounded-lg border border-amber-300 px-3 py-2 text-sm text-gray-900 placeholder-amber-300 focus:border-amber-500 focus:outline-none"
              />
              <button
                onClick={() => runMerge(false)}
                disabled={!canCommit}
                className="mt-2 w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "Merging…" : "Commit merge (deletes the ghost)"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
