"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Nav } from "@/components/ui/nav"
import { MeSubNav } from "@/components/ui/me-subnav"
import { useLineageStore, isAuthUser } from "@/store/lineage-store"
import { cn, formatSmartDate } from "@/lib/utils"
import { getInitials } from "@/components/ui/rider-avatar"
import { tagPredicateLabel } from "@/lib/tag-events"
import { labelForDeclineCategory } from "@/lib/decline-categories"
import { DeclineModal } from "@/components/ui/decline-modal"
import { ReportTagModal } from "@/components/ui/report-tag-modal"
import type {
  TagEvent,
  TagEventStatus,
  TagEventSource,
  TagEventDeclineCategory,
} from "@/types"

// ── Types matching /api/me/tags response ────────────────────────────────────

interface AsserterSummary { id: string; display_name: string | null; avatar_url: string | null }
interface MomentSummary {
  type: "story" | "claim"
  title?: string
  snippet?: string
  start_date?: string | null
  end_date?: string | null
  story_id?: string
  claim_id?: string
}
interface ListResponse {
  tags: TagEvent[]
  asserters: Record<string, AsserterSummary>
  moments: Record<string, MomentSummary>
  pendingCount: number
}

// ── Filter chip configs ─────────────────────────────────────────────────────

const STATUS_CHIPS: { value: TagEventStatus; label: string }[] = [
  { value: "pending",  label: "Pending"  },
  { value: "approved", label: "Approved" },
  { value: "declined", label: "Declined" },
  { value: "disabled", label: "Disabled" },
]
const SOURCE_CHIPS: { value: TagEventSource | "all"; label: string }[] = [
  { value: "all",                   label: "All sources" },
  { value: "member",                label: "Member"      },
  { value: "public_timeline_embed", label: "Embed"       },
  { value: "editor",                label: "Editor"      },
  { value: "system",                label: "System"      },
]

// ── Page ────────────────────────────────────────────────────────────────────

export default function MeTagsPage() {
  const { activePersonId, authReady, addToast } = useLineageStore()
  const [status,   setStatus]   = useState<TagEventStatus>("pending")
  const [source,   setSource]   = useState<TagEventSource | "all">("all")
  const [data,     setData]     = useState<ListResponse | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [requireApproval, setRequireApproval] = useState<boolean>(false)

  // Decline picker (single or bulk)
  const [declineTarget, setDeclineTarget] = useState<{ ids: string[]; mode: "single" | "bulk" } | null>(null)
  // PB-009 Phase 3 — report picker (single)
  const [reportTarget, setReportTarget] = useState<{ id: string } | null>(null)
  const [reportSubmitting, setReportSubmitting] = useState(false)

  const refresh = useCallback(() => {
    if (!isAuthUser(activePersonId)) return
    setLoading(true)
    fetch(`/api/me/tags?status=${status}&source=${source}`)
      .then((r) => r.json())
      .then((r: ListResponse) => { setData(r); setSelected(new Set()) })
      .catch(() => addToast("Could not load your tags. Try again.", "error"))
      .finally(() => setLoading(false))
  }, [activePersonId, status, source, addToast])

  useEffect(() => {
    if (!authReady) return
    if (!isAuthUser(activePersonId)) { setLoading(false); return }
    refresh()
    // Read the visibility-gate preference so the header copy reflects which
    // mode the user is in. Failure is non-fatal — default to permissive.
    fetch("/api/me/tag-privacy")
      .then((r) => r.ok ? r.json() : { require_tag_approval: false })
      .then((r: { require_tag_approval: boolean }) => setRequireApproval(Boolean(r.require_tag_approval)))
      .catch(() => setRequireApproval(false))
  }, [authReady, activePersonId, refresh])

  // ── Selection ─────────────────────────────────────────────────────────────
  const toggle = (id: string) => {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  const selectAll = () => {
    if (!data) return
    if (selected.size === data.tags.length && data.tags.length > 0) setSelected(new Set())
    else setSelected(new Set(data.tags.map((t) => t.id)))
  }

  // ── Decide actions (skeleton — wired in step 5) ──────────────────────────
  const decide = async (ids: string[], action: "approve" | "decline", category?: TagEventDeclineCategory, note?: string) => {
    // Phase 2 step 4 wires the actual API call; the skeleton wires UI only.
    const isBulk = ids.length > 1
    const url = isBulk ? "/api/me/tags/bulk-decide" : `/api/me/tags/${ids[0]}/decide`
    const body = isBulk
      ? { ids, action, decline_category: category, decline_note: note }
      : { action, decline_category: category, decline_note: note }
    const res = await fetch(url, {
      method: isBulk ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Action failed" }))
      addToast(error ?? "Action failed", "error")
      return
    }
    addToast(action === "approve" ? "Approved." : "Declined.", "info")
    setDeclineTarget(null)
    refresh()
  }

  // ── Render guards ────────────────────────────────────────────────────────
  if (!authReady || loading) {
    return (
      <>
        <Nav />
        <MeSubNav pendingTagCount={data?.pendingCount} />
        <main className="max-w-5xl mx-auto px-4 py-8">
          <div className="text-muted text-sm">Loading…</div>
        </main>
      </>
    )
  }
  if (!isAuthUser(activePersonId)) {
    return (
      <>
        <Nav />
        <MeSubNav />
        <main className="max-w-5xl mx-auto px-4 py-8">
          <div className="text-muted text-sm">Sign in to review your tags.</div>
        </main>
      </>
    )
  }

  const tags = data?.tags ?? []
  const asserters = data?.asserters ?? {}
  const moments = data?.moments ?? {}
  const pendingCount = data?.pendingCount ?? 0

  return (
    <>
      <Nav />
      <MeSubNav pendingTagCount={pendingCount} />

      <main className="max-w-5xl mx-auto px-4 py-6 pb-32">
        {/* Header */}
        <div className="flex items-end justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Your tags</h1>
            <p className="text-sm text-muted mt-1">
              {status === "pending"
                ? requireApproval
                  ? "Tags waiting for your approval before they appear publicly."
                  : "Recent tags from other riders. Decline to remove; approve to confirm."
                : "Tags from other riders that you've already decided on."}
            </p>
          </div>
          {pendingCount > 0 && (
            <div className="text-xs text-muted">{pendingCount} pending</div>
          )}
        </div>

        {/* Permissive-default reminder + link to gate setting */}
        {!requireApproval && status === "pending" && (
          <div className="mb-3 text-[11px] text-muted">
            Tags appear immediately by default.{" "}
            <Link href="/me/settings/tag-privacy" className="underline hover:text-foreground">
              Require approval first
            </Link>
            {" "}to gate them.
          </div>
        )}

        {/* Filter chip row — status group then source group */}
        <div className="flex items-center gap-1 overflow-x-auto py-2 mb-2 scrollbar-none">
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
          <span className="text-muted px-2 select-none">/</span>
          {SOURCE_CHIPS.map((c) => (
            <button
              key={c.value}
              onClick={() => setSource(c.value)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors",
                source === c.value
                  ? "bg-surface-active text-foreground border border-border-default"
                  : "bg-surface text-muted hover:text-foreground hover:bg-surface-hover border border-border-default",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Select-all (only when there are rows) */}
        {tags.length > 0 && (
          <div className="flex items-center gap-2 mb-3 text-xs text-muted">
            <input
              type="checkbox"
              checked={selected.size === tags.length}
              onChange={selectAll}
              className="h-4 w-4 rounded border-border-default"
            />
            <span>Select all visible ({tags.length})</span>
          </div>
        )}

        {/* Empty state */}
        {tags.length === 0 && (
          <div className="border border-border-default rounded-xl p-8 text-center text-muted text-sm bg-surface">
            {status === "pending"
              ? "No pending tags. You're all caught up."
              : `No ${status} tags${source !== "all" ? ` from ${source}` : ""}.`}
          </div>
        )}

        {/* Cards */}
        <ul className="flex flex-col gap-3">
          {tags.map((t) => {
            const asserter = t.asserter_id ? asserters[t.asserter_id] ?? null : null
            const asserterName = asserter?.display_name
              ?? (t.source === "system" ? "Lineage" : "Unknown rider")
            const ref = (t.moment_ref ?? {}) as { story_id?: string; claim_id?: string }
            const moment: MomentSummary | null = ref.story_id
              ? moments[ref.story_id] ?? null
              : ref.claim_id
                ? moments[ref.claim_id] ?? null
                : null
            const isSelected = selected.has(t.id)
            const decided = t.status !== "pending"

            return (
              <li
                key={t.id}
                className={cn(
                  "border rounded-xl p-4 bg-surface flex gap-3 transition-colors",
                  isSelected ? "border-blue-600" : "border-border-default",
                  decided && "opacity-70",
                )}
              >
                {/* Checkbox (only useful on pending; harmless elsewhere) */}
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(t.id)}
                  className="h-4 w-4 mt-1 rounded border-border-default flex-shrink-0"
                />

                {/* Asserter avatar */}
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-surface-active flex items-center justify-center text-foreground text-xs font-semibold">
                    {t.source === "system" || !asserter
                      ? "✦"
                      : getInitials(asserterName)}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-sm text-foreground">
                    <span className="font-medium">{asserterName}</span>{" "}
                    <span className="text-muted">{tagPredicateLabel(t.predicate)}</span>
                  </div>

                  {/* Preview */}
                  {moment?.type === "story" && (
                    <Link
                      href={`/stories/${moment.story_id}`}
                      className="block mt-2 text-xs text-muted hover:text-foreground"
                    >
                      <div className="font-medium text-foreground">{moment.title}</div>
                      {moment.snippet && <div className="line-clamp-2">{moment.snippet}</div>}
                      {moment.start_date && (
                        <div className="text-[11px] mt-0.5">{formatSmartDate(moment.start_date)}</div>
                      )}
                    </Link>
                  )}
                  {moment?.type === "claim" && (
                    <div className="mt-2 text-xs text-muted">
                      {moment.start_date ? formatSmartDate(moment.start_date) : ""}
                      {moment.end_date ? ` – ${formatSmartDate(moment.end_date)}` : ""}
                      {!moment.start_date && !moment.end_date && "Date unknown"}
                    </div>
                  )}

                  {/* Decline reason (when shown in declined filter) */}
                  {t.status === "declined" && t.decision_reason_category && (
                    <div className="mt-2 text-[11px] text-muted">
                      Declined: {labelForDeclineCategory(t.decision_reason_category)}
                    </div>
                  )}

                  {/* Per-card action row (pending only) */}
                  {!decided && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => decide([t.id], "approve")}
                        className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs hover:bg-green-700 transition-colors"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => setDeclineTarget({ ids: [t.id], mode: "single" })}
                        className="px-3 py-1.5 rounded-lg bg-surface-active text-foreground text-xs hover:bg-surface-hover transition-colors border border-border-default"
                      >
                        Decline
                      </button>
                      {t.asserter_id && (
                        <>
                          <button
                            onClick={() => trust(t.asserter_id!)}
                            className="px-3 py-1.5 rounded-lg text-xs text-muted hover:text-foreground transition-colors"
                          >
                            Trust asserter
                          </button>
                          <button
                            onClick={() => block(t.asserter_id!)}
                            className="px-3 py-1.5 rounded-lg text-xs text-muted hover:text-foreground transition-colors"
                          >
                            Block asserter
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => report(t.id)}
                        className="ml-auto px-2 py-1 text-[11px] text-muted hover:text-foreground transition-colors"
                      >
                        Report as abuse
                      </button>
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </main>

      {/* Sticky bulk action bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-border-default shadow-lg">
          <div className="max-w-5xl mx-auto flex items-center gap-3 px-4 py-3">
            <span className="text-sm text-foreground">{selected.size} selected</span>
            <div className="flex-1" />
            <button
              onClick={() => decide(Array.from(selected), "approve")}
              className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs hover:bg-green-700"
            >
              Approve selected
            </button>
            <button
              onClick={() => setDeclineTarget({ ids: Array.from(selected), mode: "bulk" })}
              className="px-3 py-1.5 rounded-lg bg-surface-active text-foreground text-xs border border-border-default hover:bg-surface-hover"
            >
              Decline selected
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

      {/* Decline category picker modal */}
      <DeclineModal
        open={declineTarget !== null}
        count={declineTarget?.ids.length ?? 1}
        onCancel={() => setDeclineTarget(null)}
        onConfirm={async (category, note) => {
          if (declineTarget) await decide(declineTarget.ids, "decline", category, note)
        }}
      />

      {/* PB-009 Phase 3 — report tag modal */}
      <ReportTagModal
        open={reportTarget !== null}
        onCancel={() => setReportTarget(null)}
        onConfirm={async (category, note) => submitReport(category, note)}
        submitting={reportSubmitting}
      />
    </>
  )

  // ── Trust / Block / Report stubs (wired in step 6) ───────────────────────
  function trust(asserterId: string) {
    fetch("/api/me/trust", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trusted_asserter_id: asserterId }),
    }).then((r) => {
      if (!r.ok) return addToast("Could not trust this asserter.", "error")
      addToast("Trusted. Future tags from this rider auto-approve.")
      refresh()
    }).catch(() => addToast("Could not trust this asserter.", "error"))
  }
  function block(asserterId: string) {
    fetch("/api/me/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocked_party: asserterId, block_kind: "user" }),
    }).then((r) => {
      if (!r.ok) return addToast("Could not block this asserter.", "error")
      addToast("Blocked. Pending tags from this rider are now declined.")
      refresh()
    }).catch(() => addToast("Could not block this asserter.", "error"))
  }
  function report(tagId: string) {
    setReportTarget({ id: tagId })
  }

  async function submitReport(category: TagEventDeclineCategory, note?: string) {
    if (!reportTarget) return
    setReportSubmitting(true)
    try {
      const r = await fetch(`/api/me/tags/${reportTarget.id}/report`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ category, note }),
      })
      if (!r.ok) {
        const { error } = await r.json().catch(() => ({ error: "Report failed" }))
        addToast(error ?? "Report failed", "error")
        return
      }
      const j = await r.json() as { already_reported?: boolean }
      if (j.already_reported) {
        addToast("You've already reported this tag.")
      } else {
        addToast("Thanks — your report is in the editor queue.")
      }
      setReportTarget(null)
    } finally {
      setReportSubmitting(false)
    }
  }
}

