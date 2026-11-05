// Story-style card for a published podcast episode (see src/lib/episode-cards.ts).
// Store-free and hook-free so the same card renders on the in-app timelines
// (brand page, guest profile) and the chromeless public /t/ pages. Uses the
// .postcard light surface like StoryCard, so it reads the same in both themes.

import Link from "next/link"
import { cn, formatSmartDate } from "@/lib/utils"
import { ENTITY_CHIP_CLASS, ENTITY_FRAME_CLASS } from "@/lib/entity-colors"
import { episodeThumbnailUrl, type EpisodeCardData } from "@/lib/episode-cards"

export function EpisodeCard({ episode, className }: { episode: EpisodeCardData; className?: string }) {
  const thumb = episodeThumbnailUrl(episode.media_url)
  const episodeHref = `/t/${episode.slug}`
  const dateLabel = episode.date ? formatSmartDate(episode.date) : episode.year ? String(episode.year) : null
  const isYouTube = Boolean(thumb)

  return (
    <div className={cn("postcard bg-surface border-2 rounded-xl p-5 mb-4", ENTITY_FRAME_CLASS.story, className)}>
      {/* Header: show + Episode badge + date, mirroring StoryCard's author row */}
      <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          {episode.show.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={episode.show.logo_url} alt={episode.show.name} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-indigo-700">
              {episode.show.name[0]?.toUpperCase() ?? "?"}
            </div>
          )}
          <span className="text-xs font-medium text-muted truncate">{episode.show.name}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] uppercase tracking-widest font-semibold text-fuchsia-700 bg-fuchsia-500/10 border border-fuchsia-500/20 rounded px-1.5 py-0.5">
            Episode
          </span>
          {dateLabel && <span className="text-xs text-muted">{dateLabel}</span>}
        </div>
      </div>

      <h3 className="font-bold text-foreground text-base leading-snug mb-3 break-words">
        <Link href={episodeHref} className="hover:underline">{episode.title}</Link>
      </h3>

      {thumb && (
        <Link
          href={episodeHref}
          className="group/thumb relative block mb-3 rounded-xl overflow-hidden aspect-video bg-black"
          aria-label={`Open ${episode.title}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumb} alt="" loading="lazy" className="w-full h-full object-cover transition-transform duration-300 group-hover/thumb:scale-[1.02]" />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="w-14 h-14 rounded-full bg-black/60 group-hover/thumb:bg-black/75 transition-colors flex items-center justify-center">
              <span className="ml-1 w-0 h-0 border-y-[10px] border-y-transparent border-l-[16px] border-l-white" />
            </span>
          </span>
        </Link>
      )}

      {episode.guests.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <span className="text-[10px] uppercase tracking-widest font-semibold text-muted mr-0.5">
            {episode.guests.length === 1 ? "Guest" : "Guests"}
          </span>
          {episode.guests.map((g) => (
            <Link
              key={g.id}
              href={`/people/${g.id}`}
              className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", ENTITY_CHIP_CLASS.rider)}
            >
              {g.display_name}
            </Link>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <Link href={episodeHref} className="font-medium text-accent-strong hover:underline">
          See the episode <span aria-hidden="true">&rarr;</span>
        </Link>
        {episode.media_url && (
          <a href={episode.media_url} target="_blank" rel="noopener noreferrer" className="text-muted hover:text-foreground transition-colors">
            {isYouTube ? "Watch on YouTube" : "Listen"} <span aria-hidden="true">&#8599;</span>
          </a>
        )}
      </div>
    </div>
  )
}
