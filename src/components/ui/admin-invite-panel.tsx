"use client"

// node-claim-by-admin-invite: the /admin/claims proactive-invite panel. Lets an
// editor search any invitable (catalog/unclaimed) node by name and send it a
// claim invite without waiting for the rider to submit their own email. Search
// hits GET /api/admin/invite-node?q=; selecting a result opens the shared
// InviteToClaimSheet, which POSTs the invite.

import { useRef, useState } from "react"
import { InviteToClaimSheet } from "@/components/ui/invite-to-claim-sheet"

type NodeResult = {
  id: string
  display_name: string
  node_status: string
  invite_email: string | null
}

export function AdminInvitePanel() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<NodeResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<NodeResult | null>(null)
  // Nodes invited this session (id -> email), so the list reflects a just-sent
  // invite without a re-fetch.
  const [invited, setInvited] = useState<Record<string, string>>({})
  const reqSeq = useRef(0)

  async function runSearch(q: string) {
    setQuery(q)
    const trimmed = q.trim()
    if (trimmed.length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    const seq = ++reqSeq.current
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/invite-node?q=${encodeURIComponent(trimmed)}`)
      const data = (await res.json().catch(() => [])) as NodeResult[]
      if (seq !== reqSeq.current) return // a newer search superseded this one
      setResults(Array.isArray(data) ? data : [])
    } catch {
      if (seq === reqSeq.current) setResults([])
    } finally {
      if (seq === reqSeq.current) setLoading(false)
    }
  }

  return (
    <div className="postcard mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-bold text-gray-900">Invite a rider to claim</h2>
      <p className="mt-1 mb-3 text-xs text-gray-600">
        Search an unclaimed rider and email them a claim link. Their existing history folds into the
        account they create. No review queue.
      </p>
      <input
        value={query}
        onChange={(e) => runSearch(e.target.value)}
        placeholder="Search a rider by name…"
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none"
      />

      {query.trim().length >= 2 && (
        <div className="mt-2 divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200">
          {loading && results.length === 0 ? (
            <div className="px-3 py-3 text-xs text-gray-500">Searching…</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-3 text-xs text-gray-500">No invitable riders match that name.</div>
          ) : (
            results.map((r) => {
              const sentEmail = invited[r.id] ?? r.invite_email
              return (
                <button
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-gray-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-gray-900">
                      {r.display_name}
                    </span>
                    <span className="text-[11px] uppercase tracking-wider text-gray-400">
                      {r.node_status}
                    </span>
                  </span>
                  {sentEmail ? (
                    <span className="shrink-0 truncate text-[11px] font-semibold text-blue-700">
                      Invited: {sentEmail}
                    </span>
                  ) : (
                    <span className="shrink-0 text-xs font-semibold text-blue-600">Invite →</span>
                  )}
                </button>
              )
            })
          )}
        </div>
      )}

      {selected && (
        <InviteToClaimSheet
          nodeId={selected.id}
          personName={selected.display_name}
          initialEmail={invited[selected.id] ?? selected.invite_email}
          onClose={() => setSelected(null)}
          onInvited={(em) => setInvited((prev) => ({ ...prev, [selected.id]: em }))}
        />
      )}
    </div>
  )
}
