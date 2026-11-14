import Link from "next/link"
import { notFound } from "next/navigation"
import { getServiceClient, requireModeratorPage } from "@/lib/auth"
import { TYPE_LABEL, approveBlocker } from "@/lib/podcast-staging"
import { getNode } from "@/lib/podcast-staging-queries"
import { BASE, Empty, FlagList, ResolutionBadge, StagingShell, StoryCard } from "../../staging-ui"
import { NodeDecisionBar, NodeEditPanel, NodeMatchPanel } from "../../staging-actions"
import type { NodeActionsProps } from "../../staging-actions"

// One node across the whole archive: its decision, its catalog match, edits
// (rename, details, merge, also-known-as), and every story that names it from
// every episode, oldest first, each with its timestamped video link.

export const dynamic = "force-dynamic"

export default async function StagingNodePage({ params }: { params: Promise<{ id: string }> }) {
  await requireModeratorPage()
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const node = await getNode(getServiceClient(), id)
  if (!node) notFound()

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

      <section>
        <h3 className="text-xs font-semibold text-muted uppercase tracking-widest mb-2">Stories</h3>
        {node.stories.length === 0 ? (
          <Empty>No stories name this node.</Empty>
        ) : (
          <div className="space-y-3">
            {node.stories.map((s) => <StoryCard key={s.id} story={s} showEpisode currentNodeId={node.id} />)}
          </div>
        )}
      </section>
    </StagingShell>
  )
}
