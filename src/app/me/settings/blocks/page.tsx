"use client"

import { useCallback, useEffect, useState } from "react"
import { Nav } from "@/components/ui/nav"
import { MeSubNav } from "@/components/ui/me-subnav"
import { useLineageStore, isAuthUser } from "@/store/lineage-store"
import { getInitials } from "@/components/ui/rider-avatar"

interface AsserterSummary { id: string; display_name: string | null; avatar_url: string | null }
interface BlockRow { id: string; blocked_party: string; block_kind: "user" | "email" | "ip"; reason: string | null; created_at: string }
interface ListResponse { blocks: BlockRow[]; asserters: Record<string, AsserterSummary> }

export default function MeBlocksSettingsPage() {
  const { activePersonId, authReady, addToast } = useLineageStore()
  const [data, setData] = useState<ListResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    if (!isAuthUser(activePersonId)) return
    setLoading(true)
    fetch("/api/me/blocks")
      .then((r) => r.json())
      .then((r: ListResponse) => setData(r))
      .catch(() => addToast("Could not load your block list.", "error"))
      .finally(() => setLoading(false))
  }, [activePersonId, addToast])

  useEffect(() => {
    if (!authReady) return
    if (!isAuthUser(activePersonId)) { setLoading(false); return }
    refresh()
  }, [authReady, activePersonId, refresh])

  const unblock = (blockId: string) => {
    fetch(`/api/me/blocks/${blockId}`, { method: "DELETE" })
      .then((r) => {
        if (!r.ok) return addToast("Could not unblock.", "error")
        addToast("Unblocked.")
        refresh()
      })
      .catch(() => addToast("Could not unblock.", "error"))
  }

  if (!authReady || loading) {
    return (
      <>
        <Nav />
        <MeSubNav />
        <main className="max-w-5xl mx-auto px-4 py-8 text-muted text-sm">Loading…</main>
      </>
    )
  }
  if (!isAuthUser(activePersonId)) {
    return (
      <>
        <Nav />
        <MeSubNav />
        <main className="max-w-5xl mx-auto px-4 py-8 text-muted text-sm">Sign in to manage blocks.</main>
      </>
    )
  }

  const blocks = data?.blocks ?? []
  const asserters = data?.asserters ?? {}

  return (
    <>
      <Nav />
      <MeSubNav />
      <main className="max-w-5xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-semibold text-foreground">Blocked</h1>
        <p className="text-sm text-muted mt-1 mb-1">
          Tags from blocked riders are auto-declined.
        </p>
        <p className="text-[11px] text-muted mb-5">
          Unblocking does not restore declined tags.
        </p>

        {blocks.length === 0 ? (
          <div className="border border-border-default rounded-xl p-8 text-center text-muted text-sm bg-surface">
            You haven't blocked anyone.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {blocks.map((b) => {
              const a = b.block_kind === "user" ? (asserters[b.blocked_party] ?? null) : null
              const name = a?.display_name
                ?? (b.block_kind === "user" ? "Unknown rider" : b.blocked_party)
              return (
                <li
                  key={b.id}
                  className="flex items-center gap-3 border border-border-default rounded-xl px-4 py-3 bg-surface"
                >
                  <div className="w-10 h-10 rounded-full bg-surface-active flex items-center justify-center text-foreground text-xs font-semibold">
                    {b.block_kind === "user" ? getInitials(name) : "✕"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-foreground">{name}</div>
                    <div className="text-[11px] text-muted">
                      Blocked {new Date(b.created_at).toLocaleDateString()}
                      {b.block_kind !== "user" && ` · ${b.block_kind} block`}
                    </div>
                  </div>
                  <button
                    onClick={() => unblock(b.id)}
                    className="px-3 py-1.5 rounded-lg text-xs text-muted hover:text-foreground border border-border-default hover:bg-surface-hover"
                  >
                    Unblock
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </>
  )
}
