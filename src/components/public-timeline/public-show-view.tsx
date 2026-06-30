"use client"

// FNRad Featured Timelines Phase 3: the chromeless public show page at /t/[slug]
// for a media show (org with org_type='media'). Same dark ground + store-free
// StackView as the profile/episode views, with a show-shaped header (logo, name,
// description) plus a published-episode list. Read-only in v1.

import Link from "next/link"
import { BrandMark } from "@/components/ui/brand-mark"
import { StackView } from "@/components/public-timeline/stack-view"
import type { PublicShowPayload } from "@/lib/public-timeline-read"

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

export function PublicShowView({ payload }: { payload: PublicShowPayload }) {
  const { owner, entries, episodes, stories, entities } = payload
  // The public show page links only to episodes that published their own page.
  const publicEpisodes = episodes.filter((e) => e.public_enabled && e.slug)

  return (
    <div className="min-h-screen w-full" style={{ background: "#1C1917" }}>
      <main className="mx-auto max-w-xl px-4 py-6 sm:py-8">
        <div className="flex items-center justify-between gap-3 mb-6">
          <BrandHome />
        </div>

        {/* Show header */}
        <header className="mb-8 flex items-start gap-4">
          {owner.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={owner.avatar_url} alt={owner.display_name} className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover flex-shrink-0 border border-white/15" />
          ) : (
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-cyan-600 flex items-center justify-center flex-shrink-0 text-2xl font-bold text-white">
              {owner.display_name[0]?.toUpperCase() ?? "?"}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold uppercase tracking-widest text-white/45 mb-1">Show</div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight" style={{ fontFamily: "var(--font-display)" }}>
              {owner.display_name}
            </h1>
            {owner.bio && (
              <p className="mt-3 text-sm font-light leading-relaxed text-white/80 whitespace-pre-wrap">{owner.bio}</p>
            )}
          </div>
        </header>

        {/* Canon */}
        {entries.length > 0 && (
          <>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-3">Canon</div>
            <StackView entries={entries} owner={owner} stories={stories} entities={entities} />
          </>
        )}

        {/* Episodes */}
        {publicEpisodes.length > 0 && (
          <section className="mt-10">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-3">Episodes</div>
            <div className="flex flex-col gap-2">
              {publicEpisodes.map((e) => (
                <Link
                  key={e.id}
                  href={`/t/${e.slug}`}
                  className="flex items-center justify-between gap-3 rounded-xl bg-white/5 border border-white/10 px-4 py-3 hover:bg-white/10 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white truncate">{e.title}</div>
                    {(e.episode_number != null || e.year) && (
                      <div className="text-xs text-white/50">
                        {[e.episode_number != null ? `Episode ${e.episode_number}` : null, e.year ? String(e.year) : null].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </div>
                  <span className="text-white/40 text-sm shrink-0">→</span>
                </Link>
              ))}
            </div>
          </section>
        )}

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
