// FNRad Listener Landing (features/fnrad-listener-landing-brief.md), T6.
//
// The public listener hub at /fnrad. A cold listener who just heard the callout
// lands here and, in one screen, learns what Linestry is, why they should care,
// and what to do next. Server-rendered, minimal chrome (no Nav), force-dark like
// the /t/ family so a listener arriving from an episode page sees one continuous
// surface (D2). Degrades gracefully: if the show slug does not resolve, the
// explainer, the CTA, the challenge and the equity block still render (D3, A10).

import type { Metadata } from "next"
import Link from "next/link"
import { BrandMark } from "@/components/ui/brand-mark"
import { ChallengeCard } from "@/components/fnrad/challenge-card"
import { readShowHub, readChallengeGuest } from "@/lib/public-timeline-read"
import type { ShowHubEpisode } from "@/lib/public-timeline-read"
import { FNRAD_SHOW_SLUG, FNRAD_HUB_REF, FNRAD_CHALLENGE } from "@/lib/fnrad"
import {
  EQUITY_POOL_SHARES,
  EQUITY_SNAPSHOT_LABEL,
  EQUITY_SNAPSHOT_TIME_LABEL,
} from "@/lib/equity-offer"

const META_DESCRIPTION =
  "Every rider, hill, contest and board named on the FNRad snowboarding podcast, written down on a shared timeline of snowboarding. Linestry is the Season 12 presenting sponsor."

export const metadata: Metadata = {
  title: "FNRad on Linestry",
  description: META_DESCRIPTION,
  alternates: { canonical: "/fnrad" },
  openGraph: {
    type: "website",
    url: "/fnrad",
    siteName: "Linestry",
    title: "FNRad on Linestry",
    description: META_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "FNRad on Linestry",
    description: META_DESCRIPTION,
  },
}

const displayFont = { fontFamily: "var(--font-display)" }
const ONBOARDING_HREF = `/onboarding?ref=${FNRAD_HUB_REF}`

function EpisodeNames({ episode }: { episode: ShowHubEpisode }) {
  if (episode.mentionNames.length === 0) {
    return <p className="mt-1.5 text-xs text-white/40">Not indexed yet.</p>
  }
  const more = episode.mentionTotal - episode.mentionNames.length
  return (
    <p className="mt-1.5 text-xs leading-relaxed text-white/60">
      <span className="text-white/40">Named in this one: </span>
      {episode.mentionNames.map((n, i) => (
        <span key={`${n.id}-${i}`}>
          {i > 0 && <span className="text-white/30">, </span>}
          {n.href ? (
            <Link href={n.href} className="text-white/80 hover:text-white transition-colors">
              {n.name}
            </Link>
          ) : (
            <span className="text-white/80">{n.name}</span>
          )}
        </span>
      ))}
      {more > 0 && <span className="text-white/40">, and {more} more</span>}
    </p>
  )
}

export default async function FnradHubPage() {
  const [hub, challengeGuest] = await Promise.all([
    readShowHub(FNRAD_SHOW_SLUG),
    readChallengeGuest(),
  ])
  const episodes = hub?.episodes ?? []

  return (
    <div className="dark min-h-screen w-full" style={{ background: "#1C1917" }}>
      <main className="mx-auto max-w-xl px-4 py-6 sm:py-8">
        {/* Header */}
        <header className="mb-8">
          <Link
            href="/"
            aria-label="Linestry home"
            className="inline-flex items-center gap-2 text-white/80 hover:text-white transition-colors"
          >
            <BrandMark size={22} color="#ffffff" />
            <span className="text-sm font-bold" style={displayFont}>
              Linestry
            </span>
          </Link>
        </header>

        {/* Kicker + H1 + lead */}
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
          FNRad Season 12 · Presented by Linestry
        </p>
        <h1
          className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight"
          style={displayFont}
        >
          You were there too. Connect your stories.
        </h1>
        <p className="mt-4 text-base font-light leading-relaxed text-white/80">
          Guests of FNRad have been sharing their stories with us, calling out the riders, hills,
          brands, events and sessions they were part of. Linestry connects those stories together,
          and it is where you connect yours to a shared timeline of snowboarding.
        </p>

        {/* Primary CTA row */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href={ONBOARDING_HREF}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 font-semibold text-white transition-colors hover:bg-accent-strong"
          >
            Start your timeline
            <span aria-hidden="true">&rarr;</span>
          </Link>
          <Link
            href="/snowboarding"
            className="text-sm font-medium text-white/70 hover:text-white transition-colors"
          >
            Look around first
          </Link>
        </div>

        {/* What is in it for you */}
        <div className="mt-8 space-y-2.5 text-sm font-light leading-relaxed text-white/80">
          <p>Find the rider, the hill or the board you just heard about.</p>
          <p>See who else was there, and when your lines crossed theirs.</p>
          <p>Add your half of the day. Most of this history is still in people&apos;s heads.</p>
        </div>

        {/* This week's challenge (D5). Absent entirely when no guest is configured. */}
        {challengeGuest && (
          <div className="mt-10">
            <ChallengeCard
              guest={challengeGuest}
              mode="hub"
              episodeSlug={FNRAD_CHALLENGE.episodeSlug}
              episodeLabel={FNRAD_CHALLENGE.episodeLabel}
            />
          </div>
        )}

        {/* Episodes. Absent entirely when the list is empty (degraded read or no
            live episodes); a listener does not need to be told the list is empty. */}
        {episodes.length > 0 && (
          <section className="mt-10">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-3">
              Episodes
            </div>
            <div className="flex flex-col gap-3">
              {episodes.map((ep) => {
                const epLine = [
                  ep.episode_number != null ? `Episode ${ep.episode_number}` : null,
                  ep.year ? String(ep.year) : null,
                ]
                  .filter(Boolean)
                  .join("  ·  ")
                return (
                  <div key={ep.id} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                    <Link
                      href={`/t/${ep.slug}`}
                      className="text-sm font-semibold text-white hover:text-white/80 transition-colors"
                    >
                      {ep.title}
                    </Link>
                    {epLine && <p className="mt-0.5 text-xs text-white/45">{epLine}</p>}
                    <EpisodeNames episode={ep} />
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Equity block (D10). Reads the constants; never a literal date or count. */}
        <section className="mt-12 rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6">
          <h2 className="text-base font-bold text-white" style={displayFont}>
            There is a share pool, and it closes at the end of the season.
          </h2>
          <p className="mt-3 text-sm font-light leading-relaxed text-white/75">
            Lineage Community Technologies has set aside {EQUITY_POOL_SHARES.toLocaleString("en-US")}{" "}
            common shares for the people who build this thing out. Adding history earns tokens, and
            tokens are how the pool gets split. It is open to everyone, including the free tier, and
            nothing is bought.
          </p>
          <p className="mt-3 text-sm font-light leading-relaxed text-white/75">
            Balances are recorded at {EQUITY_SNAPSHOT_LABEL}, {EQUITY_SNAPSHOT_TIME_LABEL}, which is
            the end of FNRad Season 12.
          </p>
          <Link
            href="/equity"
            className="mt-4 inline-block text-sm font-semibold text-white/80 hover:text-white transition-colors"
          >
            How the share pool works &rarr;
          </Link>
        </section>

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-white/10 flex flex-col items-center gap-3 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-white/55 hover:text-white transition-colors"
            aria-label="Linestry home"
          >
            <BrandMark size={18} color="#ffffff" />
            <span className="text-xs font-medium">Powered by Linestry</span>
          </Link>
          <Link href="/word" className="text-xs text-white/60 hover:text-white transition-colors">
            linestry, noun. Read the definition.
          </Link>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-white/40">
            <Link href="/privacy" className="hover:text-white/70 transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-white/70 transition-colors">
              Terms
            </Link>
            <Link href="/data-deletion" className="hover:text-white/70 transition-colors">
              Data deletion
            </Link>
          </div>
          <p className="text-[11px] text-white/35">Lineage Community Technologies Inc.</p>
        </footer>
      </main>
    </div>
  )
}
