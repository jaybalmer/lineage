"use client"

import { useCallback, useEffect, useState } from "react"
import { Nav } from "@/components/ui/nav"
import { MeSubNav } from "@/components/ui/me-subnav"
import { useLineageStore, isAuthUser } from "@/store/lineage-store"
import { getInitials } from "@/components/ui/rider-avatar"

interface AsserterSummary { id: string; display_name: string | null; avatar_url: string | null }
interface TrustRow { id: string; trusted_asserter_id: string; created_at: string }
interface ListResponse { trusts: TrustRow[]; asserters: Record<string, AsserterSummary> }

export default function MeTrustSettingsPage() {
  const { activePersonId, authReady, addToast } = useLineageStore()
  const [data, setData] = useState<ListResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    if (!isAuthUser(activePersonId)) return
    setLoading(true)
    fetch("/api/me/trust")
      .then((r) => r.json())
      .then((r: ListResponse) => setData(r))
      .catch(() => addToast("Could not load your trusted riders.", "error"))
      .finally(() => setLoading(false))
  }, [activePersonId, addToast])

  useEffect(() => {
    if (!authReady) return
    if (!isAuthUser(activePersonId)) { setLoading(false); return }
    refresh()
  }, [authReady, activePersonId, refresh])

  const removeTrust = (asserterId: string) => {
    fetch(`/api/me/trust/${asserterId}`, { method: "DELETE" })
      .then((r) => {
        if (!r.ok) return addToast("Could not remove trust.", "error")
        addToast("Trust removed.")
        refresh()
      })
      .catch(() => addToast("Could not remove trust.", "error"))
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
        <main className="max-w-5xl mx-auto px-4 py-8 text-muted text-sm">Sign in to manage trust.</main>
      </>
    )
  }

  const trusts = data?.trusts ?? []
  const asserters = data?.asserters ?? {}

  return (
    <>
      <Nav />
      <MeSubNav />
      <main className="max-w-5xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-semibold text-foreground">Trusted riders</h1>
        <p className="text-sm text-muted mt-1 mb-5">
          Tags from these riders skip your inbox and auto-approve.
        </p>

        {trusts.length === 0 ? (
          <div className="border border-border-default rounded-xl p-8 text-center text-muted text-sm bg-surface">
            You haven't trusted anyone yet. Trust a rider from the tag they sent you.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {trusts.map((t) => {
              const a = asserters[t.trusted_asserter_id] ?? null
              const name = a?.display_name ?? "Unknown rider"
              return (
                <li
                  key={t.id}
                  className="flex items-center gap-3 border border-border-default rounded-xl px-4 py-3 bg-surface"
                >
                  <div className="w-10 h-10 rounded-full bg-surface-active flex items-center justify-center text-foreground text-xs font-semibold">
                    {getInitials(name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-foreground">{name}</div>
                    <div className="text-[11px] text-muted">
                      Trusted {new Date(t.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={() => removeTrust(t.trusted_asserter_id)}
                    className="px-3 py-1.5 rounded-lg text-xs text-muted hover:text-foreground border border-border-default hover:bg-surface-hover"
                  >
                    Remove trust
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
