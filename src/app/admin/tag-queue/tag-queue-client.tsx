"use client"

// PB-009 Phase 3 — editor moderation queue client.
//
// One card per tag_event with open reports. Three weighted actions per card:
// dismiss reports (no modal), decline tag (DeclineModal), restrict asserter
// (RestrictAsserterModal). Filter chips for status + sort dropdown above
// the cards. Bulk-dismiss only — no bulk-decline (Q6).

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Nav } from "@/components/ui/nav"
import { useLineageStore } from "@/store/lineage-store"
import { cn, formatSmartDate } from "@/lib/utils"
import { tagPredicateLabel } from "@/lib/tag-events"
import { labelForDeclineCategory } from "@/lib/decline-categories"
import { DeclineModal } from "@/components/ui/decline-modal"
import { RestrictAsserterModal } from "@/components/ui/restrict-asserter-modal"
import type { TagEventDeclineCategory } from "@/types"

type QueueSort = "report_count_desc" | "recent" | "oldest_open"
type QueueStatus = "open" | "reviewed" | "dismissed" | "all"

interface QueueRow {
  tag_event: {
    id: string; source: string; subject_id: string; asserter_id: string | null;
    predicate: string; status: string; moment_ref: Record<string, unknown>; created_at: string
  }
  asserter: { id: string; display_name: string | null; avatar_url: string | null } | null
  owner:    { id: string; display_name: string | null; avatar_url: string | null } | null
  asserter_context: {
    total_tags: number; declined_count: number; distinct_decline_editors: number;
    is_first_time: boolean;
    current_restriction: { created_at: string; reason: string | null } | null;
  }
  reports: {
    id: string; reported_by: string; reported_by_name: string | null;
    reason_category: string; reason_note: string | null; status: string; created_at: string;
  }[]
}

const STATUS_CHIPS: { value: QueueStatus; label: string }[] = [
  { value: "open",      label: "Open reports" },
  { value: "reviewed",  label: "Reviewed"     },
  { value: "dismissed", label: "Dismissed"    },
  { value: "all",       label: "All"          },
]

const SORT_OPTIONS: { value: QueueSort; label: string }[] = [
  { value: "report_count_desc", label: "Most reports" },
  { value: "recent",            label: "Most recent"  },
  { value: "oldest_open",       label: "Oldest open"  },
]

export function TagQueueClient() {
  const addToast = useLineageStore((s) => s.addToast)
  const refreshEditorQueuePendingCount = useLineageStore((s) => s.refreshEditorQueuePendingCount)
  const [status, setStatus] = useState<QueueStatus>("open")
  const [sort,   setSort]   = useState<QueueSort>("report_count_desc")
  const [rows,   setRows]   = useState<QueueRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const [declineTarget, setDeclineTarget] = useState<QueueRow | null>(null)
  const [restrictTarget, setRestrictTarget] = useState<QueueRow | null>(null)
  const [restrictCascade, setRestrictCascade] = useState<{ pending_declined: number; approved_disabled: number } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/admin/tag-queue?status=${status}&sort=${sort}`)
      if (!r.ok) throw new Error("queue fetch failed")
      const j = await r.json() as { rows: QueueRow[] }
      setRows(j.rows ?? [])
      setSelected(new Set())
    } catch {
      addToast("Could not load the queue.", "error")
    } finally {
      setLoading(false)
    }
  }, [status, sort, addToast])

  useEffect(() => { refresh() }, [refresh])

  const totalSelectedReports = useMemo(() => selected.size, [selected])

  // ── Actions ────────────────────────────────────────────────────────────
  async function dismissReports(reportIds: string[]) {
    if (reportIds.length === 0) return
    const r = await fetch("/api/admin/tag-events/bulk-dismiss-reports", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ report_ids: reportIds }),
    })
    if (!r.ok) { addToast("Dismiss failed.", "error"); return }
    const j = await r.json() as { dismissed: number }
    addToast(`${j.dismissed} report${j.dismissed === 1 ? "" : "s"} dismissed.`)
    refresh()
    refreshEditorQueuePendingCount?.()
  }

  async function declineTag(category: TagEventDeclineCategory, note?: string) {
    if (!declineTarget) return
    setSubmitting(true)
    try {
      const r = await fetch(`/api/admin/tag-events/${declineTarget.tag_event.id}/decide`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "decline", category, note }),
      })
      if (!r.ok) {
        const { error } = await r.json().catch(() => ({ error: "Decline failed" }))
        addToast(error ?? "Decline failed", "error")
        return
      }
      addToast("Tag removed; owner notified.")
      setDeclineTarget(null)
      refresh()
      refreshEditorQueuePendingCount()
    } finally {
      setSubmitting(false)
    }
  }

  async function openRestrictModal(row: QueueRow) {
    setRestrictTarget(row)
    setRestrictCascade(null)
    if (!row.tag_event.asserter_id) return
    // Cascade preview: count pending + approved tags for this asserter
    try {
      const r = await fetch(`/api/admin/asserters/${row.tag_event.asserter_id}`)
      if (!r.ok) return
      const j = await r.json() as { aggregates: { by_status: { pending: number; approved: number } } }
      setRestrictCascade({
        pending_declined:  j.aggregates.by_status.pending,
        approved_disabled: j.aggregates.by_status.approved,
      })
    } catch {
      // Surface as zero on failure rather than blocking restriction
      setRestrictCascade({ pending_declined: 0, approved_disabled: 0 })
    }
  }

  async function restrictAsserter(reason: string) {
    if (!restrictTarget?.tag_event.asserter_id) return
    setSubmitting(true)
    try {
      const r = await fetch(`/api/admin/asserters/${restrictTarget.tag_event.asserter_id}/restrict`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ reason }),
      })
      if (!r.ok) {
        const { error, reason: errReason } = await r.json().catch(() => ({ error: "Restrict failed", reason: null }))
        if (errReason === "already_restricted") {
          addToast("This asserter is already restricted.")
        } else {
          addToast(error ?? "Restrict failed", "error")
        }
        return
      }
      const name = restrictTarget.asserter?.display_name ?? "Asserter"
      addToast(`${name} restricted.`)
      setRestrictTarget(null)
      refresh()
      refreshEditorQueuePendingCount()
    } finally {
      setSubmitting(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <>
      <Nav />
      <main className="max-w-6xl mx-auto px-4 py-6 pb-32">
        <div className="flex items-end justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Editor queue</h1>
            <p className="text-sm text-muted mt-1">Member reports awaiting review.</p>
          </div>
          <Link href="/admin" className="text-xs text-muted hover:text-foreground">← back to admin</Link>
        </div>

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {STATUS_CHIPS.map((c) => (
            <button
              key={c.value}
              onClick={() => setStatus(c.value)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors",
                status === c.value
                  ? "bg-blue-600 text-white"
                  : "bg-surface text-muted hover:text-foreground hover:bg-surface-hover border border-border-default",
              )}
            >
              {c.label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <label className="text-xs text-muted">Sort</label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as QueueSort)}
              className="text-xs border border-border-default rounded-lg bg-surface text-foreground px-2 py-1"
            >
              {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {loading && <div className="text-muted text-sm">Loading…</div>}

        {!loading && rows.length === 0 && (
          <div className="border border-border-default rounded-xl p-8 text-center text-muted text-sm bg-surface">
            No reports in this view.
          </div>
        )}

        <ul className="flex flex-col gap-3">
          {rows.map((row) => {
            const ev = row.tag_event
            const ref = ev.moment_ref as { story_id?: string; claim_id?: string }
            const anyOpen = row.reports.some((r) => r.status === "open")
            const isRestricted = !!row.asserter_context.current_restriction

            return (
              <li key={ev.id} className="border border-border-default rounded-xl p-4 bg-surface">
                <div className="flex items-start gap-3">
                  {/* Bulk-dismiss checkbox — only open reports are dismissible */}
                  <input
                    type="checkbox"
                    disabled={!anyOpen}
                    checked={row.reports.filter((r) => r.status === "open").every((r) => selected.has(r.id)) && anyOpen}
                    onChange={() => {
                      const openIds = row.reports.filter((r) => r.status === "open").map((r) => r.id)
                      const next = new Set(selected)
                      const allSelected = openIds.every((id) => next.has(id))
                      if (allSelected) openIds.forEach((id) => next.delete(id))
                      else openIds.forEach((id) => next.add(id))
                      setSelected(next)
                    }}
                    className="h-4 w-4 mt-1"
                  />

                  <div className="flex-1 min-w-0">
                    {/* Tag content line — third-party voice with owner name embedded */}
                    <div className="text-sm">
                      <span className="font-medium text-foreground">{row.asserter?.display_name ?? "Unknown asserter"}</span>
                      <span className="text-muted"> {tagPredicateLabel(ev.predicate, row.owner?.display_name ?? undefined)}</span>
                    </div>

                    {/* Status + Moment ref subtext */}
                    <div className="text-xs text-muted mt-0.5 flex items-center gap-2">
                      <span className={cn(
                        "inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider",
                        ev.status === "pending"  && "bg-amber-500/10 text-amber-400 border border-amber-500/20",
                        ev.status === "approved" && "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
                        ev.status === "declined" && "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20",
                        ev.status === "disabled" && "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20",
                      )}>
                        {ev.status}
                      </span>
                      {(ref.story_id || ref.claim_id) && (
                        <>
                          {ref.story_id ? <Link href={`/stories/${ref.story_id}`} className="hover:underline">story</Link> : <span>claim</span>}
                          <span>·</span>
                          <span>{formatSmartDate(ev.created_at)}</span>
                        </>
                      )}
                      {row.owner && (
                        <>
                          <span>·</span>
                          <Link href={`/people/${row.owner.id}`} className="hover:underline text-foreground/70">
                            {row.owner.display_name ?? "Unknown owner"}
                          </Link>
                        </>
                      )}
                    </div>

                    {/* Asserter context */}
                    <div className="text-xs text-muted mt-2">
                      {row.asserter_context.is_first_time
                        ? "First-time asserter"
                        : `${row.asserter_context.total_tags} prior tags · ${row.asserter_context.declined_count} declined`}
                      {row.asserter_context.distinct_decline_editors > 0 && (
                        <> · declined by {row.asserter_context.distinct_decline_editors} editor{row.asserter_context.distinct_decline_editors === 1 ? "" : "s"}</>
                      )}
                      {isRestricted && <span className="ml-2 text-red-600">⚠ currently restricted</span>}
                      {row.tag_event.asserter_id && (
                        <Link
                          href={`/admin/asserters/${row.tag_event.asserter_id}`}
                          className="ml-2 underline hover:text-foreground"
                        >
                          rap sheet
                        </Link>
                      )}
                    </div>

                    {/* Reports block */}
                    <div className="mt-3 border-t border-border-default pt-3">
                      <div className="text-xs font-medium text-foreground mb-1">
                        Reported by {row.reports.length} member{row.reports.length === 1 ? "" : "s"}
                      </div>
                      <ul className="text-xs text-muted space-y-1">
                        {row.reports.map((r) => (
                          <li key={r.id} className="flex items-baseline gap-2">
                            <span className="font-medium text-foreground">{r.reported_by_name ?? "Unknown"}</span>
                            <span>· {labelForDeclineCategory(r.reason_category as TagEventDeclineCategory)}</span>
                            <span>· {formatSmartDate(r.created_at)}</span>
                            {r.status !== "open" && <span className="ml-1 italic">[{r.status}]</span>}
                            {r.reason_note && <span className="block w-full ml-0 mt-0.5 text-foreground/70">&ldquo;{r.reason_note}&rdquo;</span>}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Action row */}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {anyOpen && (
                        <button
                          onClick={() => dismissReports(row.reports.filter((r) => r.status === "open").map((r) => r.id))}
                          className="px-3 py-1.5 rounded-lg text-xs bg-surface-active text-foreground border border-border-default hover:bg-surface-hover"
                        >
                          Dismiss reports
                        </button>
                      )}
                      {ev.status === "pending" ? (
                        <button
                          onClick={() => setDeclineTarget(row)}
                          className="px-3 py-1.5 rounded-lg text-xs bg-red-600 text-white hover:bg-red-700"
                        >
                          Remove tag
                        </button>
                      ) : ev.status === "approved" ? (
                        <span
                          className="px-3 py-1.5 rounded-lg text-xs bg-surface-active text-muted border border-border-default cursor-not-allowed"
                          title="Override removal of approved tags lands in Phase 4. Phase 3 ships preemptive removal of pending tags only."
                        >
                          Remove tag (Phase 4)
                        </span>
                      ) : null}
                      {ev.asserter_id && !isRestricted && (
                        <button
                          onClick={() => openRestrictModal(row)}
                          className="px-3 py-1.5 rounded-lg text-xs bg-amber-600 text-white hover:bg-amber-700"
                        >
                          Restrict asserter
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </main>

      {/* Sticky bulk-dismiss bar */}
      {totalSelectedReports > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-border-default shadow-lg">
          <div className="max-w-6xl mx-auto flex items-center gap-3 px-4 py-3">
            <span className="text-sm text-foreground">{totalSelectedReports} report{totalSelectedReports === 1 ? "" : "s"} selected</span>
            <div className="flex-1" />
            <button
              onClick={() => dismissReports(Array.from(selected))}
              className="px-3 py-1.5 rounded-lg bg-surface-active text-foreground text-xs border border-border-default hover:bg-surface-hover"
            >
              Dismiss selected
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="px-2 py-1 text-xs text-muted hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <DeclineModal
        open={declineTarget !== null}
        onCancel={() => setDeclineTarget(null)}
        onConfirm={async (cat, note) => declineTag(cat, note)}
        title="Remove tag"
        description="Owner will be notified by category. Note is editor-only."
        confirmLabel="Remove tag"
        destructive
        submitting={submitting}
      />

      <RestrictAsserterModal
        open={restrictTarget !== null}
        asserterName={restrictTarget?.asserter?.display_name ?? null}
        cascadePreview={restrictCascade}
        onCancel={() => setRestrictTarget(null)}
        onConfirm={async (reason) => restrictAsserter(reason)}
        submitting={submitting}
      />
    </>
  )
}
