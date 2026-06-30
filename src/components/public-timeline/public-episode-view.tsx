"use client"

// FNRad Featured Timelines Phase 2: the chromeless public episode page at
// /t/[slug] for an episode (Event) owner. Same dark ground + store-free StackView
// as the profile Stack View, with an episode-shaped header (show link, episode
// number + date, guests, media embed) instead of a rider hero. Read-only in v1.

import Link from "next/link"
import { BrandMark } from "@/components/ui/brand-mark"
import { StackView } from "@/components/public-timeline/stack-view"
import { parseYouTubeId } from "@/lib/utils"
import type { PublicEpisodePayload } from "@/lib/public-timeline-read"

function BrandHome() {
  return (
    <Link
      href="/"
      aria-label="Linestry home"
      className="inline-flex items-center gap-2 text-white/80 hover:text-white transition-colors"
    >
      <BrandMark size={22} color="#ffffff" />
      <span className="text-sm font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Linestry
      </span>
    </Link>
  )
}

function GuestAvatar({ name, url }: { name: string; url: string | null }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={name} className="w-9 h-9 rounded-full object-cover border border-white/15" title={name} />
  ) : (
    <div
      className="w-9 h-9 rounded-full bg-violet-600 flex items-center justify-center text-xs font-bold text-white border border-white/15"
      title={name}
    >
      {name[0]?.toUpperCase() ?? "?"}
    </div>
  )
}

export function PublicEpisodeView({ payload }: { payload: PublicEpisodePayload }) {
  const { owner, meta, entries, stories, entities } = payload
  const ytId = meta.media_url ? parseYouTubeId(meta.media_url) : null
  const year = owner.era_start
  const epLine = [
    meta.episode_number != null ? `Episode ${meta.episode_number}` : null,
    year ? String(year) : null,
  ].filter(Boolean).join("  ·  ")

  return (
    <div className="min-h-screen w-full" style={{ background: "#1C1917" }}>
      <main className="mx-auto max-w-xl px-4 py-6 sm:py-8">
        <div className="flex items-center justify-between gap-3 mb-6">
          <BrandHome />
        </div>

        {/* Episode header */}
        <header className="mb-6">
          {meta.show && (
            <div className="text-xs font-semibold uppercase tracking-widest text-white/45 mb-2">
              {meta.show.slug ? (
                <Link href={`/t/${meta.show.slug}`} className="hover:text-white/80 transition-colors">
                  {meta.show.name}
                </Link>
              ) : (
                meta.show.name
              )}
            </div>
          )}
          <h1
            className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {owner.display_name}
          </h1>
          {epLine && <p className="mt-1.5 text-sm text-white/55">{epLine}</p>}
          {owner.bio && (
            <p className="mt-3 text-sm font-light leading-relaxed text-white/80 whitespace-pre-wrap">
              {owner.bio}
            </p>
          )}

          {meta.guests.length > 0 && (
            <div className="mt-4">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-2">
                {meta.guests.length === 1 ? "Guest" : "Guests"}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {meta.guests.map((g) => (
                  <div key={g.id} className="flex items-center gap-2 pr-3 rounded-full bg-white/5 border border-white/10">
                    <GuestAvatar name={g.display_name} url={g.avatar_url} />
                    <span className="text-xs text-white/85">{g.display_name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Media */}
          {ytId ? (
            <div className="mt-5 aspect-video rounded-xl overflow-hidden border border-white/10">
              <iframe
                src={`https://www.youtube.com/embed/${ytId}`}
                title={owner.display_name}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
          ) : meta.media_url ? (
            <a
              href={meta.media_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm font-medium text-white transition-colors"
            >
              ▶ Listen to the episode
            </a>
          ) : null}
        </header>

        {/* Featured set */}
        {entries.length > 0 && (
          <div className="text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-3">
            Featured in this episode
          </div>
        )}
        <StackView entries={entries} owner={owner} stories={stories} entities={entities} />

        <footer className="mt-12 pt-6 border-t border-white/10 flex flex-col items-center gap-3 text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-white/55 hover:text-white transition-colors" aria-label="Linestry home">
            <BrandMark size={18} color="#ffffff" />
            <span className="text-xs font-medium">Powered by Linestry</span>
          </Link>
          <Link href="/" className="text-xs font-semibold text-white/80 hover:text-white">
            Explore the snowboarding graph →
          </Link>
        </footer>
      </main>
    </div>
  )
}
