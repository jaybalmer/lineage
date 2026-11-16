import Link from "next/link"
import { getServiceClient, requireModeratorPage } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { RESOLUTION_LABEL, STAGING_SUBJECT_TYPES, TYPE_LABEL } from "@/lib/podcast-staging"
import type { NodeResolution } from "@/lib/podcast-staging"
import {
  listEpisodes,
  listNodes,
  listStories,
  nodeFacetCounts,
  parseNodeFilters,
  parseStoryFilters,
} from "@/lib/podcast-staging-queries"
import type { NodeFilters } from "@/lib/podcast-staging-queries"
import {
  BASE,
  Empty,
  FlagList,
  NodeDecisionLabel,
  Pager,
  ResolutionBadge,
  StagingShell,
  StoryCard,
  TypeLabel,
  FilterChip,
} from "./staging-ui"
import { NodesToolbar } from "./staging-actions"

// Podcast archive staging: the review surface (Phase 1 views, Phase 2 decisions).
//
// /admin/podcast/staging                 Nodes (default)
// /admin/podcast/staging?tab=episodes    Episodes
// /admin/podcast/staging?tab=stories     All stories
//
// Strict gate (brief D5): requireModeratorPage() wants is_editor = true. The
// /admin layout already lets founding members in; this page sends them back to
// /admin. Every list is filtered and paginated in SQL.

export const dynamic = "force-dynamic"

type SP = Record<string, string | string[] | undefined>

const RESOLUTION_ORDER: NodeResolution[] = ["matched", "ambiguous", "review", "new", "needs_detail"]

// Story status columns on the Nodes and Episodes tabs, in review order.
const STATUS_COLS: {
  key: "pending_count" | "approved_count" | "ready_count" | "published_story_count" | "held_count" | "trimmed_count"
  label: string
  title: string
  tone: string
  mobile?: boolean
}[] = [
  { key: "pending_count", label: "Pending", title: "Stories not decided yet", tone: "text-foreground", mobile: true },
  { key: "approved_count", label: "Approved", title: "Stories approved", tone: "text-foreground" },
  { key: "ready_count", label: "Ready", title: "Approved stories with at least one approved node, not yet published (per node: this node is approved)", tone: "text-emerald-600 dark:text-emerald-400 font-semibold", mobile: true },
  { key: "published_story_count", label: "Published", title: "Stories with at least one published mention", tone: "text-[var(--accent-strong)]" },
  { key: "held_count", label: "Held", title: "Stories held as sensitive", tone: "text-amber-600 dark:text-amber-400" },
  { key: "trimmed_count", label: "Trimmed", title: "Stories trimmed", tone: "text-muted" },
]

const DECISION_CHIP = { pending: "Pending", approved: "Approved", hold: "On hold", rejected: "Rejected" } as const

export default async function PodcastStagingPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireModeratorPage()
  const sp = await searchParams
  const tab = sp.tab === "episodes" ? "episodes" : sp.tab === "stories" ? "stories" : "nodes"
  const db = getServiceClient()

  return (
    <StagingShell tab={tab}>
      {tab === "nodes" && <NodesTab db={db} filters={parseNodeFilters(sp)} />}
      {tab === "episodes" && <EpisodesTab db={db} page={Math.max(1, Number(sp.page) || 1)} />}
      {tab === "stories" && <StoriesTab db={db} sp={sp} />}
    </StagingShell>
  )
}

// ── nodes ───────────────────────────────────────────────────────────────────

function nodesHref(f: NodeFilters, patch: Partial<NodeFilters>): string {
  const next = { ...f, page: 1, ...patch }
  const p = new URLSearchParams()
  if (next.type) p.set("type", next.type)
  if (next.resolution) p.set("resolution", next.resolution)
  if (next.flagged) p.set("flagged", "1")
  if (next.decision) p.set("decision", next.decision)
  if (next.q) p.set("q", next.q)
  if (next.page && next.page > 1) p.set("page", String(next.page))
  const s = p.toString()
  return s ? `${BASE}?${s}` : BASE
}


async function NodesTab({ db, filters }: { db: ReturnType<typeof getServiceClient>; filters: NodeFilters }) {
  const [list, facets] = await Promise.all([listNodes(db, filters), nodeFacetCounts(db)])

  return (
    <section>
      <form action={BASE} method="get" className="flex gap-2 mb-3">
        {filters.type && <input type="hidden" name="type" value={filters.type} />}
        {filters.resolution && <input type="hidden" name="resolution" value={filters.resolution} />}
        {filters.flagged && <input type="hidden" name="flagged" value="1" />}
        {filters.decision && <input type="hidden" name="decision" value={filters.decision} />}
        <label htmlFor="node-search" className="sr-only">Search nodes</label>
        <input
          id="node-search"
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder="Search a name"
          className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-border-default bg-surface text-sm text-foreground placeholder:text-muted"
        />
        <button type="submit" className="px-3 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium">Search</button>
      </form>

      <div className="flex gap-1.5 overflow-x-auto pb-2">
        <FilterChip href={nodesHref(filters, { type: null })} active={!filters.type}>All types {facets.total}</FilterChip>
        {STAGING_SUBJECT_TYPES.map((t) => (
          <FilterChip key={t} href={nodesHref(filters, { type: t })} active={filters.type === t}>
            {TYPE_LABEL[t]} {facets.byType[t] ?? 0}
          </FilterChip>
        ))}
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-3">
        <FilterChip href={nodesHref(filters, { resolution: null })} active={!filters.resolution}>Any status</FilterChip>
        {RESOLUTION_ORDER.map((r) => (
          <FilterChip key={r} href={nodesHref(filters, { resolution: r })} active={filters.resolution === r}>
            {RESOLUTION_LABEL[r]} {facets.byResolution[r] ?? 0}
          </FilterChip>
        ))}
        <FilterChip href={nodesHref(filters, { flagged: !filters.flagged })} active={!!filters.flagged}>
          Flagged {facets.flagged}
        </FilterChip>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-3">
        <FilterChip href={nodesHref(filters, { decision: null })} active={!filters.decision}>Any decision</FilterChip>
        {(["pending", "approved", "hold", "rejected"] as const).map((d) => (
          <FilterChip key={d} href={nodesHref(filters, { decision: d })} active={filters.decision === d}>
            {DECISION_CHIP[d]} {facets.byDecision[d] ?? 0}
          </FilterChip>
        ))}
      </div>

      <NodesToolbar type={filters.type ?? null} />

      <p className="text-xs text-muted mb-2">{list.total} {list.total === 1 ? "node" : "nodes"}</p>

      {list.rows.length === 0 ? (
        <Empty>No nodes match these filters.</Empty>
      ) : (
        <div className="rounded-xl border border-border-default overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-[11px] uppercase tracking-wide text-muted">
              <tr>
                <th className="text-left font-semibold px-3 py-2">Name</th>
                <th className="text-right font-semibold px-2 py-2 hidden sm:table-cell" title="Every episode this node is mentioned in">Eps</th>
                <th className="text-right font-semibold px-2 py-2 hidden sm:table-cell" title="Episodes with at least one story that is not trimmed. The list is sorted by this">Kept eps &darr;</th>
                <th className="text-right font-semibold px-2 py-2" title="Stories">Stories</th>
                {STATUS_COLS.map((c) => (
                  <th key={c.key} title={c.title} className={cn("text-right font-semibold px-2 py-2", !c.mobile && "hidden sm:table-cell")}>
                    {c.label}
                  </th>
                ))}
                <th className="text-left font-semibold px-3 py-2">Catalog</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {list.rows.map((n) => (
                <tr key={n.id} className="bg-surface hover:bg-surface-hover align-top">
                  <td className="px-3 py-2">
                    <Link href={`${BASE}/nodes/${n.id}`} className="font-medium text-foreground hover:underline">
                      {n.name}
                    </Link>
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                      <TypeLabel type={n.subject_type} />
                      {n.decision !== "pending" && <NodeDecisionLabel decision={n.decision} />}
                      <FlagList flags={n.flags} />
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-muted hidden sm:table-cell">{n.episode_count}</td>
                  <td className={cn("px-2 py-2 text-right tabular-nums hidden sm:table-cell", n.kept_episode_count === 0 ? "text-muted/50" : "text-foreground")}>
                    {n.kept_episode_count}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-foreground">
                    {n.story_count}
                    {n.inferred_count > 0 && (
                      <div className="text-[10px]" title="Mentions whose name was inferred">{n.inferred_count} inferred</div>
                    )}
                  </td>
                  {STATUS_COLS.map((c) => {
                    const v = n[c.key]
                    return (
                      <td
                        key={c.key}
                        className={cn("px-2 py-2 text-right tabular-nums", v ? c.tone : "text-muted/50", !c.mobile && "hidden sm:table-cell")}
                      >
                        {v}
                      </td>
                    )
                  })}
                  <td className="px-3 py-2">
                    <ResolutionBadge resolution={n.resolution} />
                    {n.resolution === "matched" && n.candidates[0] && (
                      <div className="text-[11px] text-muted mt-0.5 truncate max-w-[14rem]">{n.candidates[0].label}</div>
                    )}
                    {n.resolution !== "matched" && n.candidates.length > 0 && (
                      <div className="text-[11px] text-muted mt-0.5">
                        {n.candidates.length} {n.candidates.length === 1 ? "candidate" : "candidates"}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={list.page} pageSize={list.pageSize} total={list.total} hrefFor={(p) => nodesHref(filters, { page: p })} />
    </section>
  )
}

// ── episodes ────────────────────────────────────────────────────────────────


async function EpisodesTab({ db, page }: { db: ReturnType<typeof getServiceClient>; page: number }) {
  const list = await listEpisodes(db, page)
  if (list.rows.length === 0) return <Empty>No episodes are staged yet. Run scripts/load-podcast-staging.mjs.</Empty>
  return (
    <section>
      <p className="text-xs text-muted mb-2">{list.total} staged {list.total === 1 ? "episode" : "episodes"}, oldest first</p>
      <div className="rounded-xl border border-border-default overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-[11px] uppercase tracking-wide text-muted">
            <tr>
              <th className="text-left font-semibold px-3 py-2">Episode</th>
              <th className="text-right font-semibold px-2 py-2">Stories</th>
              {STATUS_COLS.map((c) => (
                <th key={c.key} title={c.title} className={cn("text-right font-semibold px-2 py-2", !c.mobile && "hidden sm:table-cell")}>
                  {c.label}
                </th>
              ))}
              <th className="text-right font-semibold px-2 py-2 hidden md:table-cell">Mentions</th>
              <th className="text-left font-semibold px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default">
            {list.rows.map((e) => (
              <tr key={e.id} className="bg-surface hover:bg-surface-hover align-top">
                <td className="px-3 py-2">
                  <Link href={`${BASE}/episodes/${e.id}`} className="font-medium text-foreground hover:underline">
                    {e.guest ?? e.episode_name}
                  </Link>
                  <div className="text-[11px] text-muted mt-0.5">
                    {[e.archive_label, e.proposed_episode_number !== null ? `#${e.proposed_episode_number}` : "no number", e.air_date].filter(Boolean).join(" · ")}
                    {e.series_note ? ` · ${e.series_note}` : ""}
                  </div>
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-foreground">{e.story_count}</td>
                {STATUS_COLS.map((c) => {
                  const v = e[c.key]
                  return (
                    <td
                      key={c.key}
                      className={cn("px-2 py-2 text-right tabular-nums", v ? c.tone : "text-muted/50", !c.mobile && "hidden sm:table-cell")}
                    >
                      {v}
                    </td>
                  )
                })}
                <td className="px-2 py-2 text-right tabular-nums text-muted hidden md:table-cell">{e.mention_count}</td>
                <td className="px-3 py-2 text-xs">
                  <span className="capitalize text-foreground">{e.status.replace("_", " ")}</span>
                  {e.episode_event_id && <div className="text-[11px] text-muted">Already live</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={list.page} pageSize={list.pageSize} total={list.total} hrefFor={(p) => `${BASE}?tab=episodes&page=${p}`} />
    </section>
  )
}

// ── stories ─────────────────────────────────────────────────────────────────

async function StoriesTab({ db, sp }: { db: ReturnType<typeof getServiceClient>; sp: SP }) {
  const f = parseStoryFilters(sp)
  const list = await listStories(db, f)
  const href = (patch: { decision?: string | null; page?: number }) => {
    const p = new URLSearchParams({ tab: "stories" })
    if (f.q) p.set("q", f.q)
    const decision = "decision" in patch ? patch.decision : f.decision
    if (decision) p.set("decision", decision)
    if (patch.page && patch.page > 1) p.set("page", String(patch.page))
    return `${BASE}?${p.toString()}`
  }
  return (
    <section>
      <form action={BASE} method="get" className="flex gap-2 mb-3">
        <input type="hidden" name="tab" value="stories" />
        {f.decision && <input type="hidden" name="decision" value={f.decision} />}
        <label htmlFor="story-search" className="sr-only">Search stories</label>
        <input
          id="story-search"
          name="q"
          defaultValue={f.q ?? ""}
          placeholder="Search titles and excerpts"
          className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-border-default bg-surface text-sm text-foreground placeholder:text-muted"
        />
        <button type="submit" className="px-3 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium">Search</button>
      </form>
      <div className="flex gap-1.5 overflow-x-auto pb-3">
        <FilterChip href={href({ decision: null })} active={!f.decision}>All</FilterChip>
        <FilterChip href={href({ decision: "pending" })} active={f.decision === "pending"}>Pending</FilterChip>
        <FilterChip href={href({ decision: "trimmed" })} active={f.decision === "trimmed"}>Trimmed</FilterChip>
        <FilterChip href={href({ decision: "hold_sensitive" })} active={f.decision === "hold_sensitive"}>Held as sensitive</FilterChip>
      </div>
      <p className="text-xs text-muted mb-2">{list.total} {list.total === 1 ? "story" : "stories"}</p>
      {list.rows.length === 0 ? (
        <Empty>No stories match.</Empty>
      ) : (
        <div className="space-y-3">
          {list.rows.map((s) => <StoryCard key={s.id} story={s} showEpisode />)}
        </div>
      )}
      <Pager page={list.page} pageSize={list.pageSize} total={list.total} hrefFor={(p) => href({ page: p })} />
    </section>
  )
}
