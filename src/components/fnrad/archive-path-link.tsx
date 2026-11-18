"use client"

// "See {name}'s path in the FNRad Archive", for entity pages (the rider page
// first). Asks GET /api/fnrad/archive/summary whether the node is in the
// archive and renders nothing at all when it is not, while loading, or on any
// failure, so a page reads exactly as before for everyone else.

import Link from "next/link"
import { useEffect, useState } from "react"
import { trackEvent } from "@/lib/analytics"
import { FNRAD_ARCHIVE_MARK } from "@/lib/fnrad"
import { archivePathHref } from "@/lib/fnrad-archive-shared"
import type { ArchiveType } from "@/lib/fnrad-archive-shared"

type Summary = { inArchive: true; episodes: number; stories: number } | { inArchive: false }

export function ArchivePathLink({ type, id, name, className }: { type: ArchiveType; id: string; name: string; className?: string }) {
  const [summary, setSummary] = useState<Summary | null>(null)
  useEffect(() => {
    let live = true
    fetch(`/api/fnrad/archive/summary?focus=${type}:${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? (r.json() as Promise<Summary>) : null))
      .catch(() => null)
      .then((d) => {
        if (live) setSummary(d)
      })
    return () => {
      live = false
    }
  }, [type, id])

  if (!summary?.inArchive) return null
  const first = type === "person" ? name.split(/\s+/)[0] || name : name
  const f = (n: number) => n.toLocaleString("en-US")
  return (
    <div className={className}>
      <Link
        href={archivePathHref(type, id)}
        onClick={() => trackEvent("content", "fnrad_archive_entity_link_clicked", { type })}
        className="dark group flex items-center gap-4 rounded-2xl border border-white/10 px-4 py-3.5 transition-colors hover:border-white/25"
        style={{ background: "#1C1917" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={FNRAD_ARCHIVE_MARK.src}
          width={FNRAD_ARCHIVE_MARK.width}
          height={FNRAD_ARCHIVE_MARK.height}
          alt="The FNRad Archive"
          className="h-9 w-auto shrink-0"
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-white">See {first}&apos;s path in the FNRad Archive</span>
          <span className="block text-xs text-white/55">
            {f(summary.stories)} {summary.stories === 1 ? "story" : "stories"} across {f(summary.episodes)}{" "}
            {summary.episodes === 1 ? "episode" : "episodes"}, year by year
          </span>
        </span>
        <span aria-hidden="true" className="text-white/60 transition-transform group-hover:translate-x-0.5">
          &rarr;
        </span>
      </Link>
    </div>
  )
}
