// Podcast archive staging: shared presentational pieces (server components).
//
// Read-only in Phase 1: no handlers, no client state. Filters and paging are
// plain links and a GET form, so every view is a URL the server renders from
// SQL. Phase 2 adds the decision controls to these same cards.

import Link from "next/link"
import type { ReactNode } from "react"
import { Nav } from "@/components/ui/nav"
import { cn } from "@/lib/utils"
import { formatTimestamp } from "@/lib/mentions"
import { ENTITY_CHIP_CLASS, kindForObjectType } from "@/lib/entity-colors"
import {
  FLAG_LABEL,
  RESOLUTION_LABEL,
  TYPE_LABEL,
  videoLink,
} from "@/lib/podcast-staging"
import type { NodeFlag, NodeResolution, StagingSubjectType, StoryDecision } from "@/lib/podcast-staging"
import type { CastChip, StoryCardData } from "@/lib/podcast-staging-queries"

export const BASE = "/admin/podcast/staging"

export type StagingTab = "nodes" | "episodes" | "stories"

const TABS: { id: StagingTab; label: string; href: string }[] = [
  { id: "nodes", label: "By person or node", href: BASE },
  { id: "episodes", label: "By episode", href: `${BASE}?tab=episodes` },
  { id: "stories", label: "All stories", href: `${BASE}?tab=stories` },
]

export function StagingShell({ tab, children }: { tab: StagingTab; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <div className="max-w-5xl mx-auto px-4 py-8 pb-32">
        <div className="mb-6">
          <Link href="/admin" className="text-xs text-muted hover:text-foreground transition-colors">
            &larr; Dataset Editor
          </Link>
          <h1 className="text-2xl font-bold text-foreground mt-2">Podcast archive staging</h1>
          <p className="text-sm text-muted mt-1 max-w-2xl">
            Nothing on this page is public. Approve stories and nodes here, then publish by episode.
          </p>
        </div>
        <nav className="flex items-center gap-1 mb-6 border-b border-border-default overflow-x-auto" aria-label="Staging views">
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={t.href}
              aria-current={t.id === tab ? "page" : undefined}
              className={cn(
                "shrink-0 px-4 py-2.5 text-sm font-medium transition-colors -mb-px border-b-2",
                t.id === tab
                  ? "border-[var(--accent)] text-foreground"
                  : "border-transparent text-muted hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        {children}
      </div>
    </div>
  )
}

// ── badges and chips ────────────────────────────────────────────────────────

const RESOLUTION_TONE: Record<NodeResolution, string> = {
  matched: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/40",
  ambiguous: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/40",
  review: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/40",
  new: "bg-surface-2 text-foreground border-border-default",
  needs_detail: "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/40",
  unresolved: "bg-surface-2 text-muted border-border-default",
}

export function ResolutionBadge({ resolution }: { resolution: NodeResolution }) {
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium whitespace-nowrap", RESOLUTION_TONE[resolution])}>
      {RESOLUTION_LABEL[resolution]}
    </span>
  )
}

export function FlagList({ flags }: { flags: NodeFlag[] }) {
  if (!flags?.length) return null
  return (
    <span className="flex flex-wrap gap-1">
      {flags.map((f) => (
        <span key={f} className="inline-flex px-1.5 py-0.5 rounded border border-border-default bg-surface-2 text-[10px] text-muted whitespace-nowrap">
          {FLAG_LABEL[f] ?? f}
        </span>
      ))}
    </span>
  )
}

export function TypeLabel({ type }: { type: StagingSubjectType }) {
  return <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">{TYPE_LABEL[type]}</span>
}

/** Entity chip. Dashed border marks a name inferred from captions (copy, section 7). */
export function NodeChip({ chip, current }: { chip: CastChip; current?: boolean }) {
  const kind = kindForObjectType(chip.subject_type)
  const tone = kind ? ENTITY_CHIP_CLASS[kind] : "bg-surface-2 border-border-default text-foreground"
  const title = chip.inferred
    ? `Name inferred. Captions read: ${chip.heard_as ?? "(nothing recorded)"}`
    : chip.heard_as
      ? `Captions read: ${chip.heard_as}`
      : undefined
  return (
    <Link
      href={`${BASE}/nodes/${chip.node_id}`}
      title={title}
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs",
        tone,
        chip.inferred && "border-dashed",
        current && "ring-2 ring-offset-1 ring-[var(--accent)]",
      )}
    >
      {chip.name}
      {chip.inferred && <span aria-label="name inferred">?</span>}
    </Link>
  )
}

const DECISION_LABEL: Record<StoryDecision, string> = {
  pending: "Pending",
  approved: "Approved",
  trimmed: "Trimmed",
  hold_sensitive: "Held as sensitive",
}

/** One story: timestamped video link, excerpt, full cast. */
export function StoryCard({ story, showEpisode, currentNodeId }: { story: StoryCardData; showEpisode?: boolean; currentNodeId?: string }) {
  const trimmed = story.decision === "trimmed"
  return (
    <article className={cn("rounded-xl border border-border-default bg-surface p-4", trimmed && "opacity-60")}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {story.episode ? (
          <a
            href={videoLink(story.episode.video_id, story.timestamp_seconds)}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-xs text-[var(--accent-strong)] hover:underline"
          >
            {formatTimestamp(story.timestamp_seconds)}
          </a>
        ) : (
          <span className="font-mono text-xs text-muted">{formatTimestamp(story.timestamp_seconds)}</span>
        )}
        <h3 className="text-sm font-semibold text-foreground">{story.title}</h3>
        {story.decision !== "pending" && (
          <span className="text-[11px] text-muted">{DECISION_LABEL[story.decision]}</span>
        )}
      </div>
      {showEpisode && story.episode && (
        <Link href={`${BASE}/episodes/${story.episode.id}`} className="block mt-1 text-xs text-muted hover:text-foreground">
          {story.episode.archive_label ? `${story.episode.archive_label} · ` : ""}
          {story.episode.guest ?? story.episode.episode_name}
          {story.episode.air_date ? ` · ${story.episode.air_date.slice(0, 4)}` : ""}
        </Link>
      )}
      <p className="mt-2 text-sm text-foreground/90 leading-relaxed">{story.excerpt}</p>
      {trimmed && (story.activity || story.skip_reason) && (
        <p className="mt-1 text-xs text-muted">
          Trimmed{story.activity ? ` (${story.activity})` : ""}{story.skip_reason ? `: ${story.skip_reason}` : ""}
        </p>
      )}
      {story.cast.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {story.cast.map((c) => (
            <NodeChip key={c.mention_id} chip={c} current={c.node_id === currentNodeId} />
          ))}
        </div>
      )}
    </article>
  )
}

/** Previous / next links that keep the current filters. */
export function Pager({
  page, pageSize, total, hrefFor,
}: { page: number; pageSize: number; total: number; hrefFor: (page: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (pages <= 1) return null
  const linkCls = "px-3 py-1.5 rounded-lg border border-border-default bg-surface text-xs text-foreground hover:bg-surface-hover"
  return (
    <div className="flex items-center justify-between gap-3 mt-4 text-xs text-muted">
      <span>Page {page} of {pages}</span>
      <span className="flex gap-2">
        {page > 1 && <Link href={hrefFor(page - 1)} className={linkCls}>Previous</Link>}
        {page < pages && <Link href={hrefFor(page + 1)} className={linkCls}>Next</Link>}
      </span>
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-border-default p-8 text-center text-sm text-muted">{children}</div>
}
