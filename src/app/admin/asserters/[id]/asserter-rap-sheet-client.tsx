"use client"

// PB-009 Phase 3 — asserter rap sheet (read-only, except Restrict / Unrestrict).
//
// Sections (matches §8.4 of the brief):
//   1. Header — avatar + name, restriction banner if active
//   2. Aggregates — stat tiles
//   3. Recent actions timeline (last 50)
//   4. Reports filed BY this asserter (counter-signal)

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { Nav } from "@/components/ui/nav"
import { useLineageStore } from "@/store/lineage-store"
import { formatSmartDate } from "@/lib/utils"
import { RestrictAsserterModal } from "@/components/ui/restrict-asserter-modal"

interface RapSheet {
  asserter: {
    id: string; display_name: string | null; avatar_url: string | null;
    current_restriction: {
      created_at: string; reason: string | null;
      created_by: string | null; created_by_name: string | null;
    } | null
  }
  aggregates: {
    total_tags: number
    by_status: { pending: number; approved: number; declined: number; disabled: number }
    distinct_owners_who_blocked: number
    decline_by_editor: { total: number; distinct_editors: number }
    report_count_against: number
  }
  recent_actions: {
    log_id: string; tag_event_id: string | null;
    tag_event_summary: { id: string; subject_id: string; predicate: string } | null;
    actor_id: string | null; actor_role: string; actor_name: string | null;
    action: string; prior_status: string | null; new_status: string | null;
    reason_category: string | null; created_at: string;
  }[]
  reports_filed_by_asserter: {
    id: string; tag_event_id: string; status: string;
    reason_category: string; created_at: string;
  }[]
}

export function AsserterRapSheetClient({ asserterId }: { asserterId: string }) {
  const addToast = useLineageStore((s) => s.addToast)
  const [data, setData] = useState<RapSheet | null>(null)
  const [loading, setLoading] = useState(true)

  const [restrictOpen, setRestrictOpen] = useState(false)
  const [unrestrictOpen, setUnrestrictOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/admin/asserters/${asserterId}`)
      if (!r.ok) throw new Error("rap sheet fetch failed")
      const j = await r.json() as RapSheet
      setData(j)
    } catch {
      addToast("Could not load rap sheet.", "error")
    } finally {
      setLoading(false)
    }
  }, [asserterId, addToast])

  useEffect(() => { refresh() }, [refresh])

  async function restrict(reason: string) {
    setSubmitting(true)
    try {
      const r = await fetch(`/api/admin/asserters/${asserterId}/restrict`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ reason }),
      })
      if (!r.ok) {
        const { error, reason: errReason } = await r.json().catch(() => ({}))
        if (errReason === "already_restricted") addToast("Already restricted.")
        else addToast(error ?? "Restrict failed", "error")
        return
      }
      addToast(`${data?.asserter.display_name ?? "Asserter"} restricted.`)
      setRestrictOpen(false)
      refresh()
    } finally {
      setSubmitting(false)
    }
  }

  async function unrestrict() {
    setSubmitting(true)
    try {
      const r = await fetch(`/api/admin/asserters/${asserterId}/restrict`, { method: "DELETE" })
      if (!r.ok) {
        addToast("Unrestrict failed", "error")
        return
      }
      addToast(`${data?.asserter.display_name ?? "Asserter"} unrestricted.`)
      setUnrestrictOpen(false)
      refresh()
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || !data) {
    return (
      <>
        <Nav />
        <main className="max-w-4xl mx-auto px-4 py-6">
          <div className="text-muted text-sm">Loading…</div>
        </main>
      </>
    )
  }

  const r = data.asserter.current_restriction
  const a = data.aggregates

  return (
    <>
      <Nav />
      <main className="max-w-4xl mx-auto px-4 py-6 pb-32">
        <Link href="/admin/tag-queue" className="text-xs text-muted hover:text-foreground">← back to queue</Link>

        {/* Header */}
        <div className="flex items-center justify-between mt-2 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-surface-active flex items-center justify-center text-foreground text-sm font-semibold">
              {(data.asserter.display_name ?? "?").slice(0, 1)}
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">
                {data.asserter.display_name ?? "Unknown asserter"}
              </h1>
              <Link
                href={`/people/${data.asserter.id}`}
                className="text-xs text-muted hover:text-foreground"
              >
                public profile →
              </Link>
            </div>
          </div>

          {r ? (
            <button
              onClick={() => setUnrestrictOpen(true)}
              className="px-3 py-1.5 rounded-lg text-xs bg-surface-active text-foreground border border-border-default hover:bg-surface-hover"
            >
              Unrestrict
            </button>
          ) : (
            <button
              onClick={() => setRestrictOpen(true)}
              className="px-3 py-1.5 rounded-lg text-xs bg-amber-600 text-white hover:bg-amber-700"
            >
              Restrict asserter
            </button>
          )}
        </div>

        {r && (
          <div className="border border-red-600/30 bg-red-600/10 text-foreground rounded-xl p-3 mb-4 text-sm">
            <strong>Currently restricted</strong> on {formatSmartDate(r.created_at)} by {r.created_by_name ?? "an editor"}.
            {r.reason && <div className="mt-1 text-muted">{r.reason}</div>}
          </div>
        )}

        {/* Aggregates */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Stat label="Total tags"      value={a.total_tags} />
          <Stat label="Pending"         value={a.by_status.pending} />
          <Stat label="Approved"        value={a.by_status.approved} />
          <Stat label="Declined"        value={a.by_status.declined} />
          <Stat label="Disabled"        value={a.by_status.disabled} />
          <Stat label="Owners blocked by" value={a.distinct_owners_who_blocked} />
          <Stat
            label="Editor declines"
            value={`${a.decline_by_editor.total}`}
            sublabel={`from ${a.decline_by_editor.distinct_editors} editor${a.decline_by_editor.distinct_editors === 1 ? "" : "s"}`}
          />
          <Stat label="Reports against" value={a.report_count_against} />
        </section>

        {/* Recent actions */}
        <section className="mb-6">
          <h2 className="text-sm font-medium text-foreground mb-2">Recent actions (last 50)</h2>
          {data.recent_actions.length === 0 ? (
            <div className="text-xs text-muted">No activity yet.</div>
          ) : (
            <ul className="border border-border-default rounded-xl bg-surface divide-y divide-border-default">
              {data.recent_actions.map((row) => (
                <li key={row.log_id} className="p-3 text-xs flex items-center gap-3">
                  <div className="text-muted w-28 flex-shrink-0">{formatSmartDate(row.created_at)}</div>
                  <div className="flex-1 min-w-0">
                    <span className="text-foreground">{row.action.replace(/_/g, " ")}</span>
                    {row.actor_name && <span className="text-muted"> · {row.actor_name}</span>}
                    {row.actor_role && <span className="text-muted"> ({row.actor_role})</span>}
                    {row.reason_category && <span className="text-muted"> · {row.reason_category}</span>}
                    {row.prior_status && row.new_status && (
                      <span className="text-muted"> · {row.prior_status} → {row.new_status}</span>
                    )}
                  </div>
                  {row.tag_event_summary && (
                    <Link
                      href={`/people/${row.tag_event_summary.subject_id}`}
                      className="text-muted hover:text-foreground"
                    >
                      tag →
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Reports filed by this asserter */}
        <section>
          <h2 className="text-sm font-medium text-foreground mb-2">Reports filed by this asserter</h2>
          {data.reports_filed_by_asserter.length === 0 ? (
            <div className="text-xs text-muted">No reports filed.</div>
          ) : (
            <ul className="border border-border-default rounded-xl bg-surface divide-y divide-border-default">
              {data.reports_filed_by_asserter.map((rep) => (
                <li key={rep.id} className="p-3 text-xs flex items-center gap-3">
                  <div className="text-muted w-28 flex-shrink-0">{formatSmartDate(rep.created_at)}</div>
                  <div className="flex-1 text-foreground">
                    {rep.reason_category}
                    <span className="text-muted"> · {rep.status}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <RestrictAsserterModal
        open={restrictOpen}
        asserterName={data.asserter.display_name}
        cascadePreview={{
          pending_declined:  a.by_status.pending,
          approved_disabled: a.by_status.approved,
        }}
        onCancel={() => setRestrictOpen(false)}
        onConfirm={async (reason) => restrict(reason)}
        submitting={submitting}
      />

      {unrestrictOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface border border-border-default rounded-xl max-w-md w-full p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-foreground mb-1">Unrestrict asserter?</h2>
            <p className="text-sm text-muted mb-4">
              This will allow {data.asserter.display_name ?? "this asserter"} to create new tags going forward.
              Previously restricted tags will NOT be reversed.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setUnrestrictOpen(false)}
                disabled={submitting}
                className="px-3 py-1.5 rounded-lg text-sm text-muted hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={() => unrestrict()}
                disabled={submitting}
                className="px-3 py-1.5 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700"
              >
                {submitting ? "Working…" : "Unrestrict"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Stat({ label, value, sublabel }: { label: string; value: number | string; sublabel?: string }) {
  return (
    <div className="border border-border-default rounded-xl bg-surface p-3">
      <div className="text-2xl font-semibold text-foreground">{value}</div>
      <div className="text-xs text-muted">{label}</div>
      {sublabel && <div className="text-[11px] text-muted mt-0.5">{sublabel}</div>}
    </div>
  )
}
