"use client"

// Podcast archive staging, Phase 2: the decision controls.
//
// Small client islands dropped into the server-rendered staging pages. Each one
// calls a /api/admin/podcast-staging route and then router.refresh(), so the
// server re-renders from SQL and there is no client copy of staging state to go
// stale. Confirmations are built into the page (brief T10): no browser dialogs.

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { ENTITY_CHIP_CLASS, kindForObjectType } from "@/lib/entity-colors"
import { GHOST_FIELDS, TYPE_LABEL } from "@/lib/podcast-staging"
import type { NodeCandidate, NodeDecision, NodeResolution, StagingSubjectType, StoryDecision } from "@/lib/podcast-staging"
import type { CastChip, StoryCardData } from "@/lib/podcast-staging-queries"

const API = "/api/admin/podcast-staging"
const BASE = "/admin/podcast/staging"

// ── plumbing ────────────────────────────────────────────────────────────────

type ApiResult = Record<string, unknown> & { error?: string }

function useAction() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [extra, setExtra] = useState<ApiResult | null>(null)

  const run = useCallback(
    async (url: string, method: "PATCH" | "POST", body: unknown, opts: { refresh?: boolean } = {}): Promise<ApiResult | null> => {
      setBusy(true)
      setError(null)
      setExtra(null)
      try {
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body ?? {}),
        })
        const json = (await res.json().catch(() => ({}))) as ApiResult
        if (!res.ok) {
          setError(json.error ?? `Request failed (${res.status})`)
          setExtra(json)
          return null
        }
        if (opts.refresh !== false) router.refresh()
        return json
      } catch (e) {
        setError((e as Error).message)
        return null
      } finally {
        setBusy(false)
      }
    },
    [router],
  )
  return { run, busy, error, extra, setError }
}

const btn = "px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
const btnNeutral = cn(btn, "bg-surface border-border-default text-foreground hover:bg-surface-hover")
const btnPrimary = cn(btn, "bg-[var(--accent)] border-transparent text-white hover:opacity-90")
const btnDanger = cn(btn, "bg-surface border-red-500/40 text-red-700 dark:text-red-300 hover:bg-red-500/10")
const input = "px-2.5 py-1.5 rounded-lg border border-border-default bg-surface text-sm text-foreground placeholder:text-muted min-w-0"

function ErrorLine({ error }: { error: string | null }) {
  if (!error) return null
  return <p role="alert" className="text-xs text-red-700 dark:text-red-300 mt-1">{error}</p>
}

// ── pickers ─────────────────────────────────────────────────────────────────

type NodeHit = { id: string; name: string; subject_type: StagingSubjectType; resolution: NodeResolution; story_count: number }

/** Search staged nodes, optionally of one type, excluding one id. */
export function NodePicker({
  type, excludeId, placeholder, onPick, excludeType,
}: {
  type?: StagingSubjectType
  excludeType?: StagingSubjectType
  excludeId?: string
  placeholder: string
  onPick: (hit: NodeHit) => void
}) {
  const [q, setQ] = useState("")
  const [hits, setHits] = useState<NodeHit[]>([])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (q.trim().length < 2) {
      setHits([])
      return
    }
    timer.current = setTimeout(async () => {
      const p = new URLSearchParams({ q: q.trim() })
      if (type) p.set("type", type)
      const res = await fetch(`${API}/nodes?${p.toString()}`)
      const json = (await res.json().catch(() => ({ rows: [] }))) as { rows?: NodeHit[] }
      setHits((json.rows ?? []).filter((h) => h.id !== excludeId && h.subject_type !== excludeType).slice(0, 8))
    }, 250)
  }, [q, type, excludeId, excludeType])

  return (
    <div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label={placeholder} className={cn(input, "w-full")} />
      {hits.length > 0 && (
        <ul className="mt-1 rounded-lg border border-border-default divide-y divide-border-default overflow-hidden">
          {hits.map((h) => (
            <li key={h.id}>
              <button type="button" onClick={() => { onPick(h); setQ(""); setHits([]) }} className="w-full text-left px-2.5 py-1.5 text-sm bg-surface hover:bg-surface-hover">
                <span className="text-foreground">{h.name}</span>
                <span className="text-[11px] text-muted"> · {TYPE_LABEL[h.subject_type]} · {h.story_count} {h.story_count === 1 ? "story" : "stories"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function CatalogPicker({ type, onPick }: { type: StagingSubjectType; onPick: (hit: { id: string; label: string }) => void }) {
  const [q, setQ] = useState("")
  const [hits, setHits] = useState<{ id: string; label: string }[]>([])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (q.trim().length < 2) {
      setHits([])
      return
    }
    timer.current = setTimeout(async () => {
      const res = await fetch(`${API}/catalog-search?type=${type}&q=${encodeURIComponent(q.trim())}`)
      const json = (await res.json().catch(() => ({ rows: [] }))) as { rows?: { id: string; label: string }[] }
      setHits(json.rows ?? [])
    }, 250)
  }, [q, type])
  return (
    <div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the catalog" aria-label="Search the catalog" className={cn(input, "w-full")} />
      {hits.length > 0 && (
        <ul className="mt-1 rounded-lg border border-border-default divide-y divide-border-default overflow-hidden max-h-64 overflow-y-auto">
          {hits.map((h) => (
            <li key={h.id}>
              <button type="button" onClick={() => { onPick(h); setQ(""); setHits([]) }} className="w-full text-left px-2.5 py-1.5 text-sm bg-surface hover:bg-surface-hover text-foreground">
                {h.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── story (T7) ──────────────────────────────────────────────────────────────

export function StoryActions({ story }: { story: Pick<StoryCardData, "id" | "decision" | "revision_pending" | "excerpt"> }) {
  const { run, busy, error } = useAction()
  const [trimming, setTrimming] = useState(false)
  const [activity, setActivity] = useState("")
  const [reason, setReason] = useState("")
  const url = `${API}/stories/${story.id}`
  const act = (action: string, extra: Record<string, unknown> = {}) => run(url, "PATCH", { action, ...extra })
  const d: StoryDecision = story.decision

  return (
    <div className="mt-3">
      {story.revision_pending && (
        <div className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">A newer seed changed this story after it was decided.</p>
          {story.revision_pending.excerpt && story.revision_pending.excerpt !== story.excerpt && (
            <p className="text-sm text-foreground mt-1">{story.revision_pending.excerpt}</p>
          )}
          <div className="flex gap-2 mt-2">
            <button type="button" disabled={busy} onClick={() => act("accept_revision")} className={btnNeutral}>Use the new text</button>
            <button type="button" disabled={busy} onClick={() => act("dismiss_revision")} className={btnNeutral}>Keep the current text</button>
          </div>
        </div>
      )}

      {trimming ? (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={async (e) => {
            e.preventDefault()
            if (await act("trim", { activity, reason })) setTrimming(false)
          }}
        >
          <input value={activity} onChange={(e) => setActivity(e.target.value)} placeholder="Activity (optional)" aria-label="Activity" className={cn(input, "w-36")} />
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why it is trimmed" aria-label="Why it is trimmed" required className={cn(input, "flex-1 min-w-[10rem]")} />
          <button type="submit" disabled={busy || !reason.trim()} className={btnPrimary}>Trim</button>
          <button type="button" onClick={() => setTrimming(false)} className={btnNeutral}>Cancel</button>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          {d !== "approved" && (
            <button type="button" disabled={busy} onClick={() => act("approve")} className={btnPrimary}>Approve</button>
          )}
          {d !== "trimmed" && (
            <button type="button" disabled={busy} onClick={() => setTrimming(true)} className={btnNeutral}>Trim</button>
          )}
          {d !== "hold_sensitive" && (
            <button type="button" disabled={busy} onClick={() => act("hold_sensitive")} className={btnNeutral}>Hold as sensitive</button>
          )}
          {d !== "pending" && (
            <button type="button" disabled={busy} onClick={() => act("restore")} className={btnNeutral}>Restore</button>
          )}
        </div>
      )}
      <ErrorLine error={error} />
    </div>
  )
}

// ── one subject in a story (T9) ─────────────────────────────────────────────

export function CastChipControl({ chip, current }: { chip: CastChip; current?: boolean }) {
  const { run, busy, error } = useAction()
  const [open, setOpen] = useState(false)
  const kind = kindForObjectType(chip.subject_type)
  const tone = kind ? ENTITY_CHIP_CLASS[kind] : "bg-surface-2 border-border-default text-foreground"
  const rejected = chip.decision === "rejected"
  const title = chip.inferred
    ? `Name inferred. Captions read: ${chip.heard_as ?? "(nothing recorded)"}`
    : chip.heard_as
      ? `Captions read: ${chip.heard_as}`
      : undefined
  const url = `${API}/mentions/${chip.mention_id}`

  return (
    <span className="inline-flex flex-col">
      <span className="inline-flex items-center">
        <Link
          href={`${BASE}/nodes/${chip.node_id}`}
          title={title}
          className={cn(
            "inline-flex items-center gap-1 pl-2 pr-1.5 py-0.5 rounded-l-full border text-xs",
            tone,
            chip.inferred && "border-dashed",
            rejected && "line-through opacity-60",
            current && "ring-2 ring-offset-1 ring-[var(--accent)]",
          )}
        >
          {chip.name}
          {chip.inferred && <span aria-label="name inferred">?</span>}
        </Link>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={`Options for ${chip.name} in this story`}
          className={cn("px-1.5 py-0.5 rounded-r-full border border-l-0 text-xs", tone, chip.inferred && "border-dashed")}
        >
          &#8942;
        </button>
      </span>
      {open && (
        <span className="mt-1 w-64 rounded-lg border border-border-default bg-surface p-2 shadow-sm block">
          {rejected ? (
            <button type="button" disabled={busy} onClick={() => run(url, "PATCH", { action: "restore" })} className={btnNeutral}>
              Put back in this story
            </button>
          ) : (
            <button type="button" disabled={busy} onClick={() => run(url, "PATCH", { action: "reject" })} className={btnDanger}>
              Drop from this story only
            </button>
          )}
          <span className="block text-[11px] text-muted mt-2 mb-1">Wrong person or thing here? Move just this mention:</span>
          <NodePicker
            excludeId={chip.node_id}
            placeholder="Repoint to another node"
            onPick={(h) => run(url, "PATCH", { action: "repoint", node_id: h.id })}
          />
          <ErrorLine error={error} />
        </span>
      )}
    </span>
  )
}

// ── node (T8) ───────────────────────────────────────────────────────────────

export type NodeActionsProps = {
  id: string
  name: string
  subject_type: StagingSubjectType
  resolution: NodeResolution
  decision: NodeDecision
  subject_id: string | null
  candidates: NodeCandidate[]
  ghost: Record<string, unknown>
  story_count: number
  decided: boolean
  blocker: string | null
  also_known_as: { id: string; name: string; subject_type: StagingSubjectType } | null
}

const GHOST_LABEL: Record<string, string> = {
  place_type: "Place type", region: "Region", country: "Country",
  org_type: "Brand type", brand_category: "Category",
  brand: "Brand", model: "Model", model_year: "Model year", shape: "Shape",
  start_date: "Year or date", event_type: "Event type",
}

export function NodeDecisionBar({ node }: { node: NodeActionsProps }) {
  const { run, busy, error } = useAction()
  const url = `${API}/nodes/${node.id}`
  const act = (action: string) => run(url, "PATCH", { action })
  return (
    <section className="mb-6 rounded-xl border border-border-default bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted mr-1">
          Decision: <span className="font-semibold text-foreground capitalize">{node.decision}</span>
        </span>
        {node.decision !== "approved" && (
          <button type="button" disabled={busy || !!node.blocker} onClick={() => act("approve")} className={btnPrimary} title={node.blocker ?? undefined}>
            Approve node
          </button>
        )}
        {node.decision !== "hold" && <button type="button" disabled={busy} onClick={() => act("hold")} className={btnNeutral}>Hold</button>}
        {node.decision !== "rejected" && <button type="button" disabled={busy} onClick={() => act("reject")} className={btnDanger}>Reject</button>}
        {node.decided && (
          <button type="button" disabled={busy} onClick={() => act("reset")} className={btnNeutral} title="Back to pending, and re-check against the catalog">
            Reset
          </button>
        )}
      </div>
      {node.blocker && node.decision !== "approved" && <p className="text-xs text-muted mt-2">{node.blocker}</p>}
      <ErrorLine error={error} />
    </section>
  )
}

export function NodeMatchPanel({ node }: { node: NodeActionsProps }) {
  const { run, busy, error } = useAction()
  const url = `${API}/nodes/${node.id}`
  const canConfirmNew = ["review", "ambiguous", "matched"].includes(node.resolution)
  return (
    <div className="mt-3 space-y-2">
      {node.candidates.length > 0 && (
        <ul className="rounded-xl border border-border-default divide-y divide-border-default overflow-hidden">
          {node.candidates.map((c) => (
            <li key={c.id} className="bg-surface px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-foreground">
                {c.label}
                <span className="text-[11px] text-muted"> · {CANDIDATE_KIND[c.kind] ?? c.kind}</span>
              </span>
              {node.subject_id === c.id ? (
                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">Matched</span>
              ) : (
                <button type="button" disabled={busy} onClick={() => run(url, "PATCH", { action: "set_match", subject_id: c.id })} className={btnNeutral}>
                  This one
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-2 sm:grid-cols-[1fr_auto] items-start">
        <CatalogPicker type={node.subject_type} onPick={(h) => run(url, "PATCH", { action: "set_match", subject_id: h.id })} />
        {canConfirmNew && (
          <button type="button" disabled={busy} onClick={() => run(url, "PATCH", { action: "confirm_new" })} className={btnNeutral}>
            None of these, it is new
          </button>
        )}
      </div>
      <ErrorLine error={error} />
    </div>
  )
}

const CANDIDATE_KIND: Record<string, string> = {
  exact: "exact match",
  near: "close name",
  spelling: "close spelling",
  weak: "one-word name, weak",
  series: "same event, pick the year",
  model: "same board, pick the year",
}

export function NodeEditPanel({ node }: { node: NodeActionsProps }) {
  const router = useRouter()
  const { run, busy, error, extra } = useAction()
  const [name, setName] = useState(node.name)
  const fields = GHOST_FIELDS[node.subject_type]
  const [ghost, setGhost] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f, node.ghost[f] === undefined || node.ghost[f] === null ? "" : String(node.ghost[f])])),
  )
  const [mergeTarget, setMergeTarget] = useState<NodeHit | null>(null)
  const url = `${API}/nodes/${node.id}`
  const conflictId = typeof extra?.conflict_node_id === "string" ? extra.conflict_node_id : null

  return (
    <section className="mb-6 grid gap-4 sm:grid-cols-2">
      <div className="rounded-xl border border-border-default bg-surface p-4">
        <h3 className="text-xs font-semibold text-muted uppercase tracking-widest mb-2">Name</h3>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (name.trim() && name.trim() !== node.name) run(url, "PATCH", { action: "rename", name })
          }}
        >
          <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Node name" className={cn(input, "flex-1")} />
          <button type="submit" disabled={busy || !name.trim() || name.trim() === node.name} className={btnNeutral}>Rename</button>
        </form>
        {conflictId && (
          <p className="text-xs mt-1">
            <Link href={`${BASE}/nodes/${conflictId}`} className="text-[var(--accent-strong)] hover:underline">Open that node</Link>
            {" or "}
            <button type="button" className="text-[var(--accent-strong)] hover:underline" disabled={busy}
              onClick={async () => { if (await run(`${url}/merge`, "POST", { target_id: conflictId }, { refresh: false })) router.push(`${BASE}/nodes/${conflictId}`) }}>
              merge this one into it
            </button>
          </p>
        )}

        {fields.length > 0 && (
          <form
            className="mt-4"
            onSubmit={(e) => {
              e.preventDefault()
              const payload: Record<string, unknown> = {}
              for (const f of fields) payload[f] = ghost[f].trim() === "" ? null : f === "model_year" ? Number(ghost[f]) : ghost[f].trim()
              run(url, "PATCH", { action: "ghost", ghost: payload })
            }}
          >
            <h3 className="text-xs font-semibold text-muted uppercase tracking-widest mb-2">Details for a new node</h3>
            <div className="grid grid-cols-2 gap-2">
              {fields.map((f) => (
                <label key={f} className="text-[11px] text-muted">
                  {GHOST_LABEL[f] ?? f}
                  <input
                    value={ghost[f]}
                    onChange={(e) => setGhost((g) => ({ ...g, [f]: e.target.value }))}
                    inputMode={f === "model_year" ? "numeric" : undefined}
                    placeholder={f === "start_date" ? "1987 or 1987-02-14" : undefined}
                    className={cn(input, "w-full mt-0.5")}
                  />
                </label>
              ))}
            </div>
            <button type="submit" disabled={busy} className={cn(btnNeutral, "mt-2")}>Save details</button>
          </form>
        )}
      </div>

      <div className="rounded-xl border border-border-default bg-surface p-4">
        <h3 className="text-xs font-semibold text-muted uppercase tracking-widest mb-2">Merge into another node</h3>
        {mergeTarget ? (
          <div className="text-sm">
            <p className="text-foreground">
              Merge &ldquo;{node.name}&rdquo; into &ldquo;{mergeTarget.name}&rdquo;? Its {node.story_count}{" "}
              {node.story_count === 1 ? "story moves" : "stories move"} to {mergeTarget.name}, and this node is retired.
            </p>
            <div className="flex gap-2 mt-2">
              <button type="button" disabled={busy} className={btnPrimary}
                onClick={async () => { if (await run(`${url}/merge`, "POST", { target_id: mergeTarget.id }, { refresh: false })) router.push(`${BASE}/nodes/${mergeTarget.id}`) }}>
                Merge
              </button>
              <button type="button" onClick={() => setMergeTarget(null)} className={btnNeutral}>Cancel</button>
            </div>
          </div>
        ) : (
          <NodePicker type={node.subject_type} excludeId={node.id} placeholder={`Find the ${TYPE_LABEL[node.subject_type].toLowerCase()} to keep`} onPick={setMergeTarget} />
        )}

        <h3 className="text-xs font-semibold text-muted uppercase tracking-widest mt-5 mb-2">Also known as</h3>
        {node.also_known_as ? (
          <p className="text-sm">
            <Link href={`${BASE}/nodes/${node.also_known_as.id}`} className="text-[var(--accent-strong)] hover:underline">{node.also_known_as.name}</Link>
            <span className="text-[11px] text-muted"> · {TYPE_LABEL[node.also_known_as.subject_type]} </span>
            <button type="button" disabled={busy} onClick={() => run(url, "PATCH", { action: "unlink_aka" })} className={cn(btnNeutral, "ml-2")}>Unlink</button>
          </p>
        ) : (
          <>
            <p className="text-[11px] text-muted mb-1">The same real-world entity as a different type, such as a person who is also a company.</p>
            <NodePicker excludeId={node.id} excludeType={node.subject_type} placeholder="Find the other node" onPick={(h) => run(url, "PATCH", { action: "link_aka", other_id: h.id })} />
          </>
        )}
        <ErrorLine error={error} />
      </div>
    </section>
  )
}

// ── bulk (T10, T11) ─────────────────────────────────────────────────────────

type Preview = { count: number; left_out: number; reasons: string; already_approved?: number }

function BulkApprove({
  label, body, sentence, doneLabel,
}: {
  label: string
  body: Record<string, unknown>
  sentence: (p: Preview) => string
  doneLabel: (n: number) => string
}) {
  const { run, busy, error } = useAction()
  const [preview, setPreview] = useState<Preview | null>(null)
  const [done, setDone] = useState<string | null>(null)
  return (
    <div>
      {preview ? (
        <div className="rounded-lg border border-border-default bg-surface p-3 text-sm">
          <p className="text-foreground">{sentence(preview)}</p>
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              disabled={busy || preview.count === 0}
              onClick={async () => {
                const r = await run(`${API}/bulk`, "POST", { ...body, dryRun: false })
                if (r) {
                  setDone(doneLabel(Number(r.count ?? 0)))
                  setPreview(null)
                }
              }}
              className={btnPrimary}
            >
              Approve {preview.count}
            </button>
            <button type="button" onClick={() => setPreview(null)} className={btnNeutral}>Cancel</button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setDone(null)
            const r = await run(`${API}/bulk`, "POST", { ...body, dryRun: true }, { refresh: false })
            if (r) setPreview(r as unknown as Preview)
          }}
          className={btnNeutral}
        >
          {label}
        </button>
      )}
      {done && <p className="text-xs text-muted mt-1">{done}</p>}
      <ErrorLine error={error} />
    </div>
  )
}

export function EpisodeBulkApprove({ episodeId }: { episodeId: string }) {
  return (
    <BulkApprove
      label="Approve stories in this episode"
      body={{ kind: "episode_stories", episode_id: episodeId }}
      sentence={(p) =>
        p.count === 0
          ? `Nothing to approve: no pending stories.${p.left_out ? ` ${p.left_out} left out: ${p.reasons}.` : ""}`
          : `Approve ${p.count} ${p.count === 1 ? "story" : "stories"} in this episode? ${p.left_out} ${p.left_out === 1 ? "is" : "are"} left out${p.left_out ? `: ${p.reasons}` : ""}.`
      }
      doneLabel={(n) => `Approved ${n} ${n === 1 ? "story" : "stories"}.`}
    />
  )
}

export function NodesToolbar({ type }: { type: StagingSubjectType | null }) {
  const { run, busy, error } = useAction()
  const [recheck, setRecheck] = useState<string | null>(null)
  const scope = type ? `${TYPE_LABEL[type].toLowerCase()} ` : ""
  return (
    <div className="flex flex-wrap items-start gap-3 mb-4">
      <BulkApprove
        label={`Approve exact ${scope}matches`}
        body={{ kind: "exact_nodes", type }}
        sentence={(p) =>
          p.count === 0
            ? `No pending exact ${scope}matches to approve.${p.left_out ? ` ${p.left_out} left out: ${p.reasons}.` : ""}`
            : `Approve ${p.count} exact ${scope}catalog ${p.count === 1 ? "match" : "matches"}? ${p.left_out} pending ${p.left_out === 1 ? "node is" : "nodes are"} left out${p.left_out ? `: ${p.reasons}` : ""}.`
        }
        doneLabel={(n) => `Approved ${n} ${n === 1 ? "node" : "nodes"}.`}
      />
      <div>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            const r = await run(`${API}/resolve`, "POST", {})
            if (r) setRecheck(`Checked ${r.checked}, ${r.changed} changed. ${r.skipped_decided} already decided by a person were left alone.`)
          }}
          className={btnNeutral}
        >
          {busy ? "Checking..." : "Re-check against catalog"}
        </button>
        {recheck && <p className="text-xs text-muted mt-1">{recheck}</p>}
        <ErrorLine error={error} />
      </div>
    </div>
  )
}

// ── publish (Phase 3, T14 / T17) ────────────────────────────────────────────

type PublishPlan = {
  episodes_to_create: number
  nodes_to_create: Record<StagingSubjectType, number>
  nodes_to_create_total: number
  mentions_to_insert: number
  already_published: number
  excluded: { episode: string; story: string; timestamp_seconds: number; node: string; reason: string }[]
  excluded_by_reason: Record<string, number>
  result?: {
    episodes_created: number
    episodes_attached: number
    nodes_created: number
    nodes_matched_at_publish: number
    mentions_inserted: number
    mentions_skipped_existing: number
    refusals: string[]
  }
}

type UnpublishPlan = {
  mentions_to_delete: number
  created_nodes: { id: string; name: string; subject_type: StagingSubjectType; subject_id: string }[]
  created_episode_event_id: string | null
  deleted?: number
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/**
 * Dry run first, always (T14). The sentence and the reasons come from the same
 * code path that writes, so what is shown is what will happen.
 */
export function PublishPanel({
  episodeId, episodeEventId, publishedMentions,
}: {
  episodeId: string
  episodeEventId: string | null
  publishedMentions: number
}) {
  const { run, busy, error } = useAction()
  const [plan, setPlan] = useState<PublishPlan | null>(null)
  const [done, setDone] = useState<PublishPlan["result"] | null>(null)
  const [unplan, setUnplan] = useState<UnpublishPlan | null>(null)
  const [unDone, setUnDone] = useState<number | null>(null)
  const [showRows, setShowRows] = useState(false)

  const dry = async () => {
    setDone(null)
    setUnDone(null)
    const r = await run(`${API}/publish`, "POST", { episodeIds: [episodeId], dryRun: true }, { refresh: false })
    if (r) setPlan(r as unknown as PublishPlan)
  }

  const typeLine = plan
    ? (Object.entries(plan.nodes_to_create) as [StagingSubjectType, number][])
        .filter(([, n]) => n > 0)
        .map(([t, n]) => `${n} ${TYPE_LABEL[t].toLowerCase()}${n === 1 ? "" : "s"}`)
        .join(", ")
    : ""

  return (
    <section className="rounded-xl border border-border-default bg-surface p-4">
      <h3 className="text-xs font-semibold text-muted uppercase tracking-widest mb-2">Publish</h3>
      <p className="text-xs text-muted mb-3">
        Publishing creates the episode hidden, any new nodes, and the mentions. Nothing shows on a timeline until the
        episode is made public from its episode page.
      </p>

      {!plan && (
        <button type="button" disabled={busy} onClick={dry} className={btnNeutral}>
          {busy ? "Checking..." : "Check what would publish"}
        </button>
      )}

      {plan && (
        <div className="text-sm">
          <p className="text-foreground">
            This will create {plural(plan.episodes_to_create, "episode", "episodes")} and{" "}
            {plural(plan.nodes_to_create_total, "new node", "new nodes")}
            {typeLine ? ` (${typeLine})` : ""}, and publish {plural(plan.mentions_to_insert, "mention", "mentions")}.{" "}
            {plural(plan.excluded.length, "row is", "rows are")} left out.
            {plan.already_published > 0 && ` ${plan.already_published} already published.`}
          </p>
          {Object.keys(plan.excluded_by_reason).length > 0 && (
            <ul className="mt-2 text-xs text-muted space-y-0.5">
              {Object.entries(plan.excluded_by_reason)
                .sort((a, b) => b[1] - a[1])
                .map(([reason, n]) => <li key={reason}>{n} &middot; {reason}</li>)}
            </ul>
          )}
          {plan.excluded.length > 0 && (
            <button type="button" onClick={() => setShowRows((v) => !v)} className="text-xs text-[var(--accent-strong)] hover:underline mt-1">
              {showRows ? "Hide" : "Show"} the left-out rows
            </button>
          )}
          {showRows && (
            <ul className="mt-1 max-h-64 overflow-y-auto text-xs text-muted border border-border-default rounded-lg divide-y divide-border-default">
              {plan.excluded.slice(0, 200).map((r, i) => (
                <li key={i} className="px-2 py-1">
                  <span className="text-foreground">{r.node}</span> in &ldquo;{r.story}&rdquo;: {r.reason}
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              disabled={busy || plan.mentions_to_insert === 0}
              onClick={async () => {
                const r = await run(`${API}/publish`, "POST", { episodeIds: [episodeId], dryRun: false })
                if (r) {
                  setDone((r as unknown as PublishPlan).result ?? null)
                  setPlan(null)
                }
              }}
              className={btnPrimary}
            >
              Publish {plural(plan.mentions_to_insert, "mention", "mentions")}
            </button>
            <button type="button" onClick={() => setPlan(null)} className={btnNeutral}>Cancel</button>
          </div>
        </div>
      )}

      {done && (
        <div className="mt-3 text-sm">
          <p className="text-foreground">
            Published {plural(done.mentions_inserted, "mention", "mentions")}.{" "}
            {done.episodes_created > 0 && `Created the episode (hidden). `}
            {done.episodes_attached > 0 && `Attached to an existing episode. `}
            {done.nodes_created > 0 && `Created ${plural(done.nodes_created, "node", "nodes")}. `}
            {done.nodes_matched_at_publish > 0 && `${plural(done.nodes_matched_at_publish, "node", "nodes")} matched the catalog at publish. `}
            {done.mentions_skipped_existing > 0 && `${done.mentions_skipped_existing} already existed.`}
          </p>
          {done.refusals.length > 0 && (
            <ul className="mt-1 text-xs text-red-700 dark:text-red-300">
              {done.refusals.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          )}
        </div>
      )}

      {episodeEventId && (
        <p className="text-xs mt-3">
          <a href={`/snowboarding/events/${episodeEventId}`} target="_blank" rel="noreferrer" className="text-[var(--accent-strong)] hover:underline">
            Open the episode page
          </a>
          <span className="text-muted"> to make it public when you are ready.</span>
        </p>
      )}

      {publishedMentions > 0 && (
        <div className="mt-4 pt-3 border-t border-border-default">
          {unplan ? (
            <div className="text-sm">
              <p className="text-foreground">
                Unpublish removes the {plural(unplan.mentions_to_delete, "mention", "mentions")} this episode published.
                {unplan.created_nodes.length > 0 && ` The ${plural(unplan.created_nodes.length, "node", "nodes")} it created stay in the catalog: `}
                {unplan.created_nodes.map((n) => n.name).join(", ")}
                {unplan.created_episode_event_id && ". The episode event it created stays too"}.
              </p>
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    const r = await run(`${API}/unpublish`, "POST", { episode_id: episodeId, dryRun: false })
                    if (r) {
                      setUnDone(Number(r.deleted ?? 0))
                      setUnplan(null)
                    }
                  }}
                  className={btnDanger}
                >
                  Unpublish
                </button>
                <button type="button" onClick={() => setUnplan(null)} className={btnNeutral}>Cancel</button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                const r = await run(`${API}/unpublish`, "POST", { episode_id: episodeId, dryRun: true }, { refresh: false })
                if (r) setUnplan(r as unknown as UnpublishPlan)
              }}
              className={btnDanger}
            >
              Unpublish this episode
            </button>
          )}
          {unDone !== null && <p className="text-xs text-muted mt-1">Removed {plural(unDone, "mention", "mentions")}.</p>}
        </div>
      )}
      <ErrorLine error={error} />
    </section>
  )
}
