"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Nav } from "@/components/ui/nav"
import { useLineageStore } from "@/store/lineage-store"
import { cn, formatSmartDate } from "@/lib/utils"

type UserRow = {
  id: string
  display_name: string | null
  email: string | null
  membership_tier: string | null
  created_at: string | null
  is_archived: boolean | null
  archived_at: string | null
}

const thCls =
  "px-3 py-2 text-left text-[11px] font-semibold text-muted uppercase tracking-widest"
const cellCls = "px-3 py-2 text-sm"

export default function AdminUsersPage() {
  const { membership, authReady, activePersonId } = useLineageStore()
  const isEditor = membership.is_editor || membership.tier === "founding"

  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [showArchived, setShowArchived] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null)

  const fetchUsers = useCallback(async (): Promise<{ error?: string; members?: UserRow[] }> => {
    const res = await fetch("/api/admin/users")
    return res.json()
  }, [])

  const applyUsers = useCallback((data: { error?: string; members?: UserRow[] }) => {
    if (data.error) {
      setLoadError(data.error)
      setLoading(false)
      return
    }
    setUsers(data.members ?? [])
    setLoading(false)
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    setLoadError(null)
    return fetchUsers().then(applyUsers)
  }, [fetchUsers, applyUsers])

  useEffect(() => {
    let cancelled = false
    fetchUsers().then((data) => { if (!cancelled) applyUsers(data) })
    return () => { cancelled = true }
  }, [fetchUsers, applyUsers])

  async function setArchived(u: UserRow, archived: boolean) {
    setBusyId(u.id)
    setConfirmId(null)
    const res = await fetch(`/api/admin/users/${u.id}/archive`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived }),
    })
    const data = await res.json()
    setBusyId(null)
    if (data.ok) {
      setMsg({ id: u.id, text: archived ? "✓ Archived" : "✓ Restored", ok: true })
      await load()
    } else {
      setMsg({ id: u.id, text: data.error ?? "Error", ok: false })
    }
    setTimeout(() => setMsg(null), 3000)
  }

  // Fail closed behind the server layout gate (requireEditorPage).
  if (!authReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <p className="text-sm text-muted">Checking access…</p>
      </div>
    )
  }
  if (!isEditor) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-xs text-center">
          <div className="text-2xl mb-2">🔒</div>
          <h1 className="text-sm font-semibold text-foreground">Editor access required</h1>
          <p className="text-xs text-muted mt-1">Your account doesn&apos;t have editor access.</p>
        </div>
      </div>
    )
  }

  const q = search.trim().toLowerCase()
  const filtered = users
    .filter((u) => showArchived || !u.is_archived)
    .filter((u) =>
      !q ||
      (u.display_name ?? "").toLowerCase().includes(q) ||
      (u.email ?? "").toLowerCase().includes(q)
    )

  const archivedCount = users.filter((u) => u.is_archived).length

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-xs font-semibold text-muted uppercase tracking-widest">User Admin</span>
            <span className="text-xs px-2 py-0.5 bg-amber-900/30 border border-amber-700/40 text-amber-400 rounded-full">Editors only</span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Users</h1>
              <p className="text-sm text-muted mt-1">
                Archive (soft-hide) a user to remove them from every public surface. No data is deleted; archiving is reversible. The account holder still sees their own profile when logged in.
              </p>
            </div>
            <Link
              href="/admin"
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface border border-border-default text-xs text-foreground hover:bg-surface-hover transition-colors"
            >
              ← Dataset Editor
            </Link>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email…"
            className="bg-surface border border-border-default rounded-lg px-3 py-2 text-sm text-foreground placeholder-zinc-600 focus:outline-none focus:border-blue-500 w-60"
          />
          <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="accent-blue-500"
            />
            Show archived {archivedCount > 0 && <span className="tabular-nums">({archivedCount})</span>}
          </label>
          <span className="text-xs text-muted tabular-nums ml-auto">{filtered.length} shown</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-muted text-sm">Loading users…</div>
        ) : loadError ? (
          <div className="py-12 text-center space-y-2">
            <p className="text-red-400 text-sm">Error loading users</p>
            <p className="text-muted text-xs">{loadError}</p>
            <button onClick={load} className="text-blue-400 text-xs underline mt-2">Retry</button>
          </div>
        ) : (
          <div className="rounded-xl border border-border-default overflow-hidden">
            <table className="w-full">
              <thead className="bg-surface border-b border-border-default">
                <tr>
                  <th className={thCls}>User</th>
                  <th className={thCls}>Tier</th>
                  <th className={thCls}>Joined</th>
                  <th className={cn(thCls, "text-right")}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u, i) => {
                  const isMe = u.id === activePersonId
                  const rowMsg = msg?.id === u.id ? msg : null
                  return (
                    <tr
                      key={u.id}
                      className={cn(
                        "border-b border-border-default last:border-0 transition-colors",
                        isMe && "ring-1 ring-inset ring-blue-500/30",
                        u.is_archived ? "bg-red-950/10" : i % 2 === 0 ? "bg-background" : "bg-surface/40"
                      )}
                    >
                      <td className={cellCls}>
                        <div className="flex items-center gap-1.5">
                          <span className={cn("font-medium", u.is_archived ? "text-muted line-through" : "text-foreground")}>
                            {u.display_name ?? "—"}
                          </span>
                          {isMe && <span className="text-[9px] text-blue-400 font-semibold">(you)</span>}
                          {u.is_archived && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-900/30 border border-red-700/40 text-red-400">
                              Archived
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted">{u.email || `${u.id.slice(0, 12)}…`}</div>
                      </td>
                      <td className={cn(cellCls, "text-muted text-xs")}>{u.membership_tier ?? "free"}</td>
                      <td className={cn(cellCls, "text-muted text-xs")}>
                        {u.created_at ? formatSmartDate(u.created_at.slice(0, 10)) : "—"}
                      </td>
                      <td className={cn(cellCls, "text-right")}>
                        {rowMsg ? (
                          <span className={cn("text-xs", rowMsg.ok ? "text-green-400" : "text-red-400")}>{rowMsg.text}</span>
                        ) : u.is_archived ? (
                          <button
                            onClick={() => setArchived(u, false)}
                            disabled={busyId === u.id}
                            className="px-2.5 py-1 text-[11px] rounded border border-emerald-700/40 text-emerald-400 hover:bg-emerald-900/20 transition-colors disabled:opacity-40"
                          >
                            {busyId === u.id ? "…" : "Un-archive"}
                          </button>
                        ) : confirmId === u.id ? (
                          <div className="flex items-center gap-1.5 justify-end">
                            <span className="text-[11px] text-muted">Archive?</span>
                            <button
                              onClick={() => setArchived(u, true)}
                              disabled={busyId === u.id}
                              className="px-2 py-1 text-[11px] rounded border border-red-700/50 text-red-400 hover:bg-red-900/20 transition-colors disabled:opacity-40"
                            >
                              {busyId === u.id ? "…" : "Yes, archive"}
                            </button>
                            <button
                              onClick={() => setConfirmId(null)}
                              className="px-2 py-1 text-[11px] text-muted hover:text-foreground transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmId(u.id)}
                            disabled={isMe}
                            title={isMe ? "You can't archive your own account" : "Hide this user from all public surfaces"}
                            className="px-2.5 py-1 text-[11px] rounded border border-border-default text-muted hover:text-red-400 hover:border-red-700/50 transition-colors disabled:opacity-30 disabled:hover:text-muted disabled:hover:border-border-default"
                          >
                            Archive
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-10 text-center text-sm text-muted">
                      No users match.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-4 text-[10px] text-muted">
          Archiving hides a user from the people directory, connections, compare, entity rosters, and the community feed. It does not sign them out or block them. Reversible at any time.
        </p>
      </div>
    </div>
  )
}
