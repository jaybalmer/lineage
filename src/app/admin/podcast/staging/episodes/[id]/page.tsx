import Link from "next/link"
import { notFound } from "next/navigation"
import { getServiceClient, requireModeratorPage } from "@/lib/auth"
import { getEpisode } from "@/lib/podcast-staging-queries"
import { BASE, Empty, StagingShell, StoryCard } from "../../staging-ui"
import { EpisodeBulkApprove } from "../../staging-actions"

// One staged episode: its stories in order, each with decision controls, plus
// the bulk approve (pending stories only; trimmed and sensitive never swept up).

export const dynamic = "force-dynamic"

export default async function StagingEpisodePage({ params }: { params: Promise<{ id: string }> }) {
  await requireModeratorPage()
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const ep = await getEpisode(getServiceClient(), id)
  if (!ep) notFound()

  const approved = ep.stories.filter((s) => s.decision === "approved").length
  const held = ep.stories.filter((s) => s.decision === "hold_sensitive").length
  const pending = ep.stories.filter((s) => s.decision === "pending").length

  const meta = [
    ep.archive_label,
    ep.proposed_episode_number !== null ? `proposed #${ep.proposed_episode_number}` : "no episode number",
    ep.air_date,
    ep.series_note,
  ].filter(Boolean)

  return (
    <StagingShell tab="episodes">
      <Link href={`${BASE}?tab=episodes`} className="text-xs text-muted hover:text-foreground">&larr; All episodes</Link>
      <header className="mt-2 mb-5">
        <h2 className="text-xl font-bold text-foreground">{ep.episode_name}</h2>
        <p className="text-sm text-muted mt-1">{meta.join(" · ")}</p>
        <p className="text-sm text-muted mt-1">
          {ep.story_count} stories, {ep.trimmed_count} trimmed, {ep.mention_count} mentions
          {ep.inferred_count > 0 && ` (${ep.inferred_count} with an inferred name)`}
        </p>
        <p className="text-xs text-muted mt-1">
          <a href={`https://www.youtube.com/watch?v=${ep.video_id}`} target="_blank" rel="noreferrer" className="text-[var(--accent-strong)] hover:underline">
            Watch on YouTube
          </a>
          {ep.episode_event_id ? " · Already live as an episode page" : " · Not live yet"}
        </p>
        {ep.notes && <p className="text-xs text-muted mt-1">{ep.notes}</p>}
        <p className="text-xs text-muted mt-1">
          Status: <span className="text-foreground capitalize">{ep.status.replace("_", " ")}</span>
          {" · "}{approved} approved, {held} held as sensitive, {pending} pending
        </p>
        <div className="mt-3"><EpisodeBulkApprove episodeId={ep.id} /></div>
      </header>
      {ep.stories.length === 0 ? (
        <Empty>No stories staged for this episode.</Empty>
      ) : (
        <div className="space-y-3">
          {ep.stories.map((s) => <StoryCard key={s.id} story={s} />)}
        </div>
      )}
    </StagingShell>
  )
}
