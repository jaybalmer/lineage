// Every FNRad episode (briefs/fnrad-archive-front-doors-brief-v1.md, B2).
//
// Chromeless and force-dark like /fnrad/archive, reading the same cached index.
// Rows link to the public /t/{slug} episode page; no "Public" labels anywhere.

import type { Metadata } from "next"
import Link from "next/link"
import { BrandMark } from "@/components/ui/brand-mark"
import { EpisodeBrowser } from "@/components/fnrad/episode-browser"
import { FNRAD_ARCHIVE_HREF, FNRAD_ARCHIVE_MARK, FNRAD_BRAND_HREF, FNRAD_HUB_HREF } from "@/lib/fnrad"
import { REPORT_HREF, readArchiveIndex } from "@/lib/fnrad-archive"

const displayFont = { fontFamily: "var(--font-display)" }
const TITLE = "Every FNRad episode on Linestry"
const DESCRIPTION = "Every FNRad episode, each one mapped to the riders, places and brands in the stories told on it."

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/fnrad/episodes" }, // FNRAD_EPISODES_HREF
  openGraph: { type: "website", url: "/fnrad/episodes", siteName: "Linestry", title: TITLE, description: DESCRIPTION },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
}

export default async function FnradEpisodesPage() {
  const index = await readArchiveIndex()
  const n = index.episodes.length

  return (
    <div className="dark min-h-screen w-full" style={{ background: "#1C1917" }}>
      <main className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
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
          <Link href={FNRAD_ARCHIVE_HREF} className="text-sm font-medium text-white/65 hover:text-white transition-colors">
            <span aria-hidden="true">&larr;</span> The archive
          </Link>
        </header>

        <Link href={FNRAD_ARCHIVE_HREF} aria-label="The FNRad Archive" className="inline-block mb-5 opacity-90 hover:opacity-100 transition-opacity">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={FNRAD_ARCHIVE_MARK.src} width={FNRAD_ARCHIVE_MARK.width} height={FNRAD_ARCHIVE_MARK.height} alt="" className="h-14 w-auto" />
        </Link>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">FNRad Podcast · Presented by Linestry</p>
        <h1 className="mt-3 text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight" style={displayFont}>
          Every FNRad episode
        </h1>
        {n > 0 && (
          <p className="mt-4 text-base font-light leading-relaxed text-white/80">
            {n.toLocaleString("en-US")} episodes, each one mapped to the stories told in it.
          </p>
        )}

        <div className="mt-8">
          {n > 0 ? (
            <EpisodeBrowser episodes={index.episodes} />
          ) : (
            <p className="text-sm text-white/70">
              The episode list is not available right now.{" "}
              <Link href={FNRAD_ARCHIVE_HREF} className="font-semibold text-white hover:underline">
                Go to the archive
              </Link>
            </p>
          )}
        </div>

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
          <Link href={FNRAD_ARCHIVE_HREF} className="text-xs text-white/60 hover:text-white transition-colors">
            The FNRad Archive
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
