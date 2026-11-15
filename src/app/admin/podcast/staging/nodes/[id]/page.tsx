import Link from "next/link"
import { notFound } from "next/navigation"
import { getServiceClient, requireModeratorPage } from "@/lib/auth"
import { TYPE_LABEL, approveBlocker } from "@/lib/podcast-staging"
import { getNode, parseNodeStoryFilters } from "@/lib/podcast-staging-queries"
import { BASE, Empty, FilterChip, FlagList, Pager, ResolutionBadge, StagingShell, StoryCard } from "../../staging-ui"
import { NodeDecisionBar, NodeEditPanel, NodeMatchPanel } from "../../staging-actions"
import type { NodeActionsProps } from "../../staging-actions"

// One node across the whole archive: its decision, its catalog match, edits
// (rename, details, merge, also-known-as), and every story that names it from
// every episode, oldest first, each with its timestamped video link. Stories
// are paged (25 at a time) and filterable by decision: a busy node has 1,000+.

export const dynamic = "force-dynamic"

export default async function StagingNodePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireModeratorPage()
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const f = parseNodeStoryFilters(await searchParams)
  const node = await getNode(getServiceClient(), id, f)
  if (!node) notFound()

  const storyHref = (patch: { decision?: string | null; page?: number }) => {
    const p = new URLSearchParams()
    const decision = "decision" in patch ? patch.decision : f.decision
    if (decision) p.set("decision", decision)
    if (patch.page && patch.page > 1) p.set("page", String(patch.page))
    const qs = p.toString()
    return `${BASE}/nodes/${node.id}${qs ? `?${qs}` : ""}#stories`
  }
  const chips: { decision: string | null; label: string; count: number }[] = [
    { decision: null, label: "All", count: node.story_count },
    { decision: "pending", label: "Pending", count: node.pending_count },
    { decision: "approved", label: "Approved", count: node.approved_count },
    { decision: "hold_sensitive", label: "Held", count: node.held_count },
    { decision: "trimmed", label: "Trimmed", count: node.trimmed_count },
  ]
  const firstShown = node.storyTotal === 0 ? 0 : (node.storyPage - 1) * node.storyPageSize + 1
  const lastShown = Math.min(node.storyPage * node.storyPageSize, node.storyTotal)

  const props: NodeActionsProps = {
    id: node.id,
    name: node.name,
    subject_type: node.subject_type,
    resolution: node.resolution,
    decision: node.decision,
    subject_id: node.subject_id,
    candidates: node.candidates ?? [],
    ghost: node.ghost ?? {},
    story_count: node.story_count,
    decided: node.decision !== "pending" || !!node.decided_at,
    blocker: approveBlocker({ subject_type: node.subject_type, resolution: node.resolution, subject_id: node.subject_id, ghost: node.ghost ?? {} }),
    also_known_as: node.also_known_as,
  }

  return (
    <StagingShell tab="nodes">
      <Link href={BASE} className="text-xs text-muted hover:text-foreground">&larr; All nodes</Link>
      <header className="mt-2 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-bold text-foreground">{node.name}</h2>
          <span className="text-xs text-muted">{TYPE_LABEL[node.subject_type]}</span>
          <ResolutionBadge resolution={node.resolution} />
        </div>
        <p className="text-sm text-muted mt-1">
          {node.story_count} {node.story_count === 1 ? "story" : "stories"} across {node.episode_count}{" "}
          {node.episode_count === 1 ? "episode" : "episodes"}
          {node.kept_episode_count !== node.episode_count && ` (${node.kept_episode_count} with kept stories)`}
          {node.inferred_count > 0 && ` · name inferred in ${node.inferred_count} of ${node.mention_count}`}
        </p>
        <div className="mt-2"><FlagList flags={node.flags} /></div>
        {node.heard_as.length > 0 && (
          <p className="text-xs text-muted mt-2">Captions read: {node.heard_as.join(", ")}</p>
        )}
      </header>

      <NodeDecisionBar node={props} />

      <section className="mb-6">
        <h3 className="text-xs font-semibold text-muted uppercase tracking-widest">Catalog</h3>
        {node.candidates.length === 0 && node.resolution !== "matched" && (
          <p className="text-sm text-muted mt-1">Nothing in the catalog looks like this name. Search below if you know it is there.</p>
        )}
        <NodeMatchPanel node={props} />
      </section>

      <NodeEditPanel node={props} />

      <section id="stories" className="scroll-mt-4">
        <h3 className="text-xs font-semibold text-muted uppercase tracking-widest mb-2">Stories</h3>
        <div className="flex gap-1.5 overflow-x-auto pb-3">
          {chips.map((c) => (
            <FilterChip key={c.label} href={storyHref({ decision: c.decision })} active={f.decision === c.decision}>
              {c.label} {c.count}
            </FilterChip>
          ))}
        </div>
        {node.stories.length === 0 ? (
          <Empty>{f.decision ? "No stories with this decision." : "No stories name this node."}</Empty>
        ) : (
          <>
            <p className="text-xs text-muted mb-2">
              Showing {firstShown} to {lastShown} of {node.storyTotal}, oldest first
            </p>
            <div className="space-y-3">
              {node.stories.map((s) => <StoryCard key={s.id} story={s} showEpisode currentNodeId={node.id} />)}
            </div>
          </>
        )}
        <Pager page={node.storyPage} pageSize={node.storyPageSize} total={node.storyTotal} hrefFor={(p) => storyHref({ page: p })} />
      </section>
    </StagingShell>
  )
}
