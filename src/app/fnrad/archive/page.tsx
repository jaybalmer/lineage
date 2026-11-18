// The FNRad Archive (briefs/fnrad-archive-surface-brief-v1.md, Part A).
//
// One public address for the whole archive: a front door and a map over pages
// that already exist. Every star in the constellation and every list item
// resolves to the plain entity page or the /t/{slug} episode page; this page
// never renders a second copy of either (the brief's one design rule).
//
// Server-rendered, chromeless and force-dark like /fnrad. The heading, scale
// line, type lists and episode list are plain HTML, so the archive is crawlable
// and usable with no script; the constellation, search and panel layer on top.
// Data is the shared cached index (src/lib/fnrad-archive.ts): published mentions
// on LIVE FNRad episodes only.

import type { Metadata } from "next"
import Link from "next/link"
import { BrandMark } from "@/components/ui/brand-mark"
import { ArchiveExplorer, ArchiveListMore } from "@/components/fnrad/archive-explorer"
import { archivePathHref } from "@/lib/fnrad-archive-shared"
import { TrackedLink } from "@/components/fnrad/tracked-link"
import { FNRAD_ARCHIVE_HREF, FNRAD_ARCHIVE_MARK, FNRAD_BRAND_HREF, FNRAD_CHALLENGE, FNRAD_EPISODES_HREF, FNRAD_HUB_HREF, FNRAD_HUB_REF, hasChallengeGuest } from "@/lib/fnrad"
import { ARCHIVE_TYPES, REPORT_HREF, TYPE_LABELS, archiveScaleLine, findFocus, readArchiveIndex } from "@/lib/fnrad-archive"
import type { ArchiveIndex } from "@/lib/fnrad-archive"
import { ENTITY_COLORS } from "@/lib/entity-colors"

const displayFont = { fontFamily: "var(--font-display)" }
const ONBOARDING_HREF = `/onboarding?ref=${FNRAD_HUB_REF}`
const LIST_TOP = 24
const KIND = ["rider", "place", "brand", "event", "board"] as const

const DEFAULT_TITLE = "The FNRad Archive on Linestry"
const DEFAULT_DESCRIPTION =
  "Every FNRad episode mapped: the riders, places, boards and brands, and the stories that connect them."

type SearchParams = Promise<{ focus?: string | string[]; view?: string | string[] }>

function fmt(n: number) {
  return n.toLocaleString("en-US")
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const { focus } = await searchParams
  const index = await readArchiveIndex()
  const i = findFocus(index, focus)
  const node = i != null ? index.nodes[i] : null
  const title = node ? `${node[2]} in the FNRad Archive` : DEFAULT_TITLE
  const description = node
    ? `${fmt(node[5])} ${node[5] === 1 ? "story" : "stories"} across ${fmt(node[4])} FNRad ${
        node[4] === 1 ? "episode mentions" : "episodes mention"
      } ${node[2]}. See who and what they connect to.`
    : DEFAULT_DESCRIPTION
  const url = node ? `${FNRAD_ARCHIVE_HREF}?focus=${ARCHIVE_TYPES[node[0]]}:${encodeURIComponent(node[1])}` : FNRAD_ARCHIVE_HREF
  // Share card per node (D6): the route handler reads the same ?focus=.
  const image = {
    url: node ? `/fnrad/archive/og?focus=${ARCHIVE_TYPES[node[0]]}:${encodeURIComponent(node[1])}` : "/fnrad/archive/og",
    width: 2400, // rendered at 2x, like the /t/ cards
    height: 1260,
    alt: title,
  }
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", url, siteName: "Linestry", title, description, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image.url] },
  }
}

function TypeList({ index, type }: { index: ArchiveIndex; type: number }) {
  // Every row opens that node's Path in the archive (its entity page is one click on from there).
  const items = index.nodes.filter((n) => n[0] === type)
  if (!items.length) return null
  const row = (n: ArchiveIndex["nodes"][number], k: number) => (
    <li key={`${n[1]}-${k}`}>
      <Link href={archivePathHref(n[0], n[1])} className="group flex items-baseline justify-between gap-3 py-1.5 text-sm">
        <span className="min-w-0 truncate text-white/85 group-hover:text-white">{n[2]}</span>
        <span className="shrink-0 text-xs text-white/40">
          {fmt(n[4])} ep · {fmt(n[5])} {n[5] === 1 ? "story" : "stories"}
        </span>
      </Link>
    </li>
  )
  return (
    <section className="min-w-0 rounded-2xl border border-white/10 bg-white/5 p-5" aria-labelledby={`list-${type}`}>
      <h3 id={`list-${type}`} className="flex items-center gap-2 text-sm font-bold text-white">
        <span className="h-2 w-2 rounded-full" style={{ background: ENTITY_COLORS[KIND[type]].glow }} />
        {TYPE_LABELS[type]}
        <span className="font-normal text-white/40">{fmt(items.length)}</span>
      </h3>
      <ul className="mt-2 divide-y divide-white/5">{items.slice(0, LIST_TOP).map(row)}</ul>
      {items.length > LIST_TOP && <ArchiveListMore index={index} type={type} skip={LIST_TOP} />}
    </section>
  )
}

export default async function FnradArchivePage({ searchParams }: { searchParams: SearchParams }) {
  const { focus, view } = await searchParams
  const index = await readArchiveIndex()
  const initialFocus = findFocus(index, focus)
  const initialView = view === "path" && initialFocus != null ? "path" : "sky"
  const t = index.totals

  return (
    <div className="dark min-h-screen w-full" style={{ background: "#1C1917" }}>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between gap-4">
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
          <Link href={FNRAD_HUB_HREF} className="text-sm font-medium text-white/65 hover:text-white transition-colors">
            <span aria-hidden="true">&larr;</span> FNRad
          </Link>
        </header>

        {/* Kicker + H1 + intro + scale line */}
        {/* Same scale and presentation as the archive card (one voice for the
            archive everywhere): the small mark as the kicker, then the card's
            headline, body and scale line. */}
        <div className="max-w-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={FNRAD_ARCHIVE_MARK.src}
            width={FNRAD_ARCHIVE_MARK.width}
            height={FNRAD_ARCHIVE_MARK.height}
            alt="The FNRad Archive"
            className="h-11 w-auto"
          />
          <h1
            className="mt-3 text-2xl sm:text-[1.7rem] font-extrabold tracking-tight text-white leading-tight"
            style={displayFont}
          >
            Twelve seasons of snowboarding stories, connected.
          </h1>
          <p className="mt-3 text-sm font-light leading-relaxed text-white/80">
            We mapped every story told on FNRad to the riders, hills, brands and boards in it, so you can follow any
            name through fifty years of snowboarding.
          </p>
          {t.episodes > 0 && <p className="mt-3 text-xs font-medium text-white/55">{archiveScaleLine(t)}</p>}
        </div>

        {/* Search, views, panel, and under them either the focused node's
            stories or the browse lists. Keyed on the URL so a browse-list link
            (a soft navigation to ?focus=...&view=path) starts fresh on that node. */}
        <section className="mt-8" aria-label="Explore the archive">
          <ArchiveExplorer
            key={`${initialFocus ?? "none"}:${initialView}`}
            index={index}
            initialFocus={initialFocus}
            initialView={initialView}
            challengeGuestId={hasChallengeGuest(FNRAD_CHALLENGE.guestId) ? FNRAD_CHALLENGE.guestId : null}
            browse={
              index.nodes.length > 0 ? (
                <section className="mt-14" aria-labelledby="browse">
                  <h2 id="browse" className="text-xl font-extrabold text-white" style={displayFont}>
                    Browse the archive
                  </h2>
                  <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {ARCHIVE_TYPES.map((_, type) => (
                      <TypeList key={type} index={index} type={type} />
                    ))}
                  </div>
                </section>
              ) : null
            }
          />
        </section>

        {/* Episodes: the full, searchable list lives at /fnrad/episodes (front-doors
            brief B3). id="episodes" stays so old #episodes links still land here. */}
        {index.episodes.length > 0 && (
          <section id="episodes" className="mt-14 scroll-mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6" aria-labelledby="episodes-h">
            <h2 id="episodes-h" className="text-xl font-extrabold text-white" style={displayFont}>
              Every episode
            </h2>
            <p className="mt-2 text-sm font-light leading-relaxed text-white/75">
              All {fmt(index.episodes.length)} episodes, searchable by guest, season and year.
            </p>
            <Link
              href={FNRAD_EPISODES_HREF}
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Browse all episodes <span aria-hidden="true">&rarr;</span>
            </Link>
          </section>
        )}

        {/* Offer strip */}
        <section className="mt-14 rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8">
          <h2 className="text-2xl font-extrabold text-white" style={displayFont}>
            You were there too.
          </h2>
          <p className="mt-3 max-w-2xl text-base font-light leading-relaxed text-white/80">
            This archive is not finished. It is the stories that have been told so far. Add yours, and correct what we
            got wrong.
          </p>
          <TrackedLink
            href={ONBOARDING_HREF}
            event="fnrad_archive_offer_clicked"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 font-semibold text-white transition-colors hover:bg-accent-strong"
          >
            Start your timeline
            <span aria-hidden="true">&rarr;</span>
          </TrackedLink>
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
          <Link href={FNRAD_HUB_HREF} className="text-xs text-white/60 hover:text-white transition-colors">
            FNRad on Linestry
          </Link>
          <Link href={FNRAD_BRAND_HREF} className="text-xs text-white/60 hover:text-white transition-colors">
            FNRad brand page
          </Link>
          <a href={REPORT_HREF()} className="text-xs text-white/60 hover:text-white transition-colors">
            Report a problem with a story
          </a>
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
