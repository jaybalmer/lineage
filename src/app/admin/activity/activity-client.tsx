"use client"

// Diagnostics Phase 1: activity feed client.
//
// Reads /api/admin/activity (moderator-gated). A 24h per-category count strip
// sits above filter chips; the table below shows one row per analytics_event
// with a category chip, the event name, the actor (linked to their profile),
// and a compact props summary. Error rows are tinted red.

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { Nav } from "@/components/ui/nav"
import { useLineageStore } from "@/store/lineage-store"
import { cn } from "@/lib/utils"

type FilterValue =
  | "all" | "auth" | "ftue" | "content" | "invite" | "moderation" | "error" | "redirect"

interface ActivityRow {
  id: string
  created_at: string
  category: string
  event: string
  actor_id: string | null
  actor_name: string | null
  severity: "warning" | "error" | null
  props: Record<string, unknown>
}

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: "all",        label: "All" },
  { value: "auth",       label: "Auth" },
  { value: "ftue",       label: "FTUE" },
  { value: "content",    label: "Content" },
  { value: "invite",     label: "Invite" },
  { value: "moderation", label: "Moderation" },
  { value: "error",      label: "Errors" },
  { value: "redirect",   label: "Redirects" },
]

const CATEGORY_STYLE: Record<string, string> = {
  auth:       "bg-blue-500/10 text-blue-400 border-blue-700/40",
  ftue:       "bg-violet-500/10 text-violet-300 border-violet-700/40",
  content:    "bg-emerald-500/10 text-emerald-300 border-emerald-700/40",
  invite:     "bg-cyan-500/10 text-cyan-300 border-cyan-700/40",
  moderation: "bg-amber-500/10 text-amber-300 border-amber-700/40",
  error:      "bg-red-500/10 text-red-300 border-red-700/40",
  redirect:   "bg-zinc-500/10 text-zinc-300 border-zinc-600/40",
}

const COUNT_ORDER: FilterValue[] = [
  "auth", "ftue", "content", "invite", "moderation", "error", "redirect",
]

function fmtTs(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  })
}

function propsSummary(props: Record<string, unknown>): string {
  const entries = Object.entries(props ?? {}).filter(
    ([, v]) => v !== null && v !== undefined && v !== "",
  )
  if (entries.length === 0) return "—"
  return entries
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join("  ·  ")
}

export function ActivityClient() {
  const addToast = useLineageStore((s) => s.addToast)
  const [filter, setFilter] = useState<FilterValue>("all")
  const [rows, setRows] = useState<ActivityRow[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [total24h, setTotal24h] = useState(0)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const qs = filter === "all" ? "" : `?category=${filter}`
      const r = await fetch(`/api/admin/activity${qs}`)
      if (!r.ok) throw new Error("activity fetch failed")
      const j = await r.json() as {
        rows: ActivityRow[]; counts: Record<string, number>; total_24h: number
      }
      setRows(j.rows ?? [])
      setCounts(j.counts ?? {})
      setTotal24h(j.total_24h ?? 0)
    } catch {
      addToast("Could not load the activity feed.", "error")
    } finally {
      setLoading(false)
    }
  }, [filter, addToast])

  useEffect(() => { refresh() }, [refresh])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-xs font-semibold text-muted uppercase tracking-widest">Diagnostics</span>
              <span className="text-xs px-2 py-0.5 bg-amber-900/30 border border-amber-700/40 text-amber-400 rounded-full">Editors only</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground">Activity</h1>
            <p className="text-sm text-muted mt-1">
              Recent product and error events captured across the app. Reload to refresh.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="shrink-0 px-3 py-2 rounded-lg bg-surface border border-border-default text-xs text-foreground hover:bg-surface-hover transition-colors"
            >
              ← Admin
            </Link>
            <button
              onClick={refresh}
              className="shrink-0 px-3 py-2 rounded-lg bg-surface border border-border-default text-xs text-foreground hover:bg-surface-hover transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* 24h count strip */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-[11px] font-semibold text-muted uppercase tracking-widest mr-1">Last 24h</span>
          <span className="text-xs px-2 py-1 rounded-lg bg-surface border border-border-default text-foreground tabular-nums">
            {total24h} total
          </span>
          {COUNT_ORDER.map((c) => (
            <span
              key={c}
              className={cn(
                "text-xs px-2 py-1 rounded-lg border tabular-nums",
                (counts[c] ?? 0) > 0 ? CATEGORY_STYLE[c] : "bg-surface border-border-default text-muted/60",
              )}
            >
              {FILTERS.find((f) => f.value === c)?.label}: {counts[c] ?? 0}
            </span>
          ))}
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-1.5 mb-4 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "text-xs px-3 py-1.5 rounded-full border transition-colors",
                filter === f.value
                  ? "bg-[#1C1917]/15 border-[#1C1917]/30 text-foreground"
                  : "border-border-default text-muted hover:text-foreground hover:border-blue-500/40",
              )}
            >
              {f.label}
            </button>
          ))}
          <span className="text-xs text-muted tabular-nums ml-1">{rows.length} rows</span>
        </div>

        {/* Feed table */}
        <div className="border border-border-default rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-surface border-b border-border-default">
                <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted uppercase tracking-widest w-[16%]">When</th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted uppercase tracking-widest w-[11%]">Category</th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted uppercase tracking-widest w-[20%]">Event</th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted uppercase tracking-widest w-[16%]">Actor</th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted uppercase tracking-widest w-[37%]">Details</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-sm text-muted">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-sm text-muted">No events yet.</td></tr>
              ) : (
                rows.map((row, i) => {
                  const isError = row.category === "error"
                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        "border-b border-border-default last:border-0 align-top",
                        isError ? "border-l-2 border-l-red-600/60 bg-red-950/10" : i % 2 === 0 ? "bg-background" : "bg-surface/40",
                      )}
                    >
                      <td className="px-3 py-2 text-xs text-muted tabular-nums whitespace-nowrap">{fmtTs(row.created_at)}</td>
                      <td className="px-3 py-2">
                        <span className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded border uppercase tracking-wide",
                          CATEGORY_STYLE[row.category] ?? "bg-surface border-border-default text-muted",
                        )}>
                          {row.category}
                        </span>
                      </td>
                      <td className={cn("px-3 py-2 text-sm font-medium", isError ? "text-red-300" : "text-foreground")}>
                        {row.event}
                        {row.severity === "warning" && (
                          <span className="ml-1.5 text-[10px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-700/40 uppercase">warn</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {row.actor_id ? (
                          <Link href={`/people/${row.actor_id}`} className="text-blue-400 hover:underline" title={row.actor_id}>
                            {row.actor_name ?? `${row.actor_id.slice(0, 8)}…`}
                          </Link>
                        ) : (
                          <span className="text-muted/60">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted break-words">{propsSummary(row.props)}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
