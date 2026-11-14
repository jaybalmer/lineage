import Link from "next/link"
import { notFound } from "next/navigation"
import { getServiceClient, requireModeratorPage } from "@/lib/auth"
import { TYPE_LABEL } from "@/lib/podcast-staging"
import type { CandidateKind } from "@/lib/podcast-staging"
import { getNode } from "@/lib/podcast-staging-queries"
import { BASE, Empty, FlagList, ResolutionBadge, StagingShell, StoryCard } from "../../staging-ui"

// One node across the whole archive: every story that names it, from every
// episode, oldest first, each with its timestamped video link. Read-only in
// Phase 1; Phase 2 adds approve / match / merge here.

export const dynamic = "force-dynamic"

const KIND_LABEL: Record<CandidateKind, string> = {
  exact: "Exact match",
  near: "Close name",
  spelling: "Close spelling",
  weak: "One-word name, weak",
  series: "Same event, pick the year",
  model: "Same board, pick the year",
}

export default async function StagingNodePage({ params }: { params: Promise<{ id: string }> }) {
  await requireModeratorPage()
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const node = await getNode(getServiceClient(), id)
  if (!node) notFound()

  const ghostEntries = Object.entries(node.ghost ?? {}).filter(([, v]) => v !== null && v !== "")

  return (
    <StagingShell tab="nodes">
      <Link href={BASE} className="text-xs text-muted hover:text-foreground">&larr; All nodes</Link>
      <header className="mt-2 mb-5">
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
        {ghostEntries.length > 0 && (
          <p className="text-xs text-muted mt-1">
            Seed details: {ghostEntries.map(([k, v]) => `${k.replace(/_/g, " ")} ${String(v)}`).join(" · ")}
          </p>
        )}
      </header>

      <section className="mb-6">
        <h3 className="text-xs font-semibold text-muted uppercase tracking-widest mb-2">Catalog</h3>
        {node.candidates.length === 0 ? (
          <p className="text-sm text-muted">Nothing in the catalog looks like this name.</p>
        ) : (
          <ul className="rounded-xl border border-border-default divide-y divide-border-default overflow-hidden">
            {node.candidates.map((c) => (
              <li key={c.id} className="bg-surface px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-foreground">{c.label}</span>
                <span className="text-[11px] text-muted">{KIND_LABEL[c.kind] ?? c.kind}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

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
