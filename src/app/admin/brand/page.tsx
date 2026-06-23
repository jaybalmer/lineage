"use client"

import { useState } from "react"
import Link from "next/link"
import { Nav } from "@/components/ui/nav"
import { useLineageStore } from "@/store/lineage-store"
import { orgSlug } from "@/lib/mock-data"

// /admin/brand - brand-page picker (Brand Page Redesign Phase 2 follow-up).
// Lists every brand so an editor can jump to its /admin/brand/[id] manage
// surface. Inherits the /admin requireEditorPage gate. The manage page resolves
// by id or slug, so linking by id here is safe.

const TIER_BADGE: Record<string, { label: string; cls: string }> = {
  curated: { label: "Curated", cls: "bg-blue-500/10 text-blue-500 border-blue-500/30" },
  founding: { label: "Founding", cls: "bg-violet-500/10 text-violet-600 border-violet-500/30" },
}

export default function AdminBrandIndexPage() {
  const catalog = useLineageStore((s) => s.catalog)
  const catalogLoaded = useLineageStore((s) => s.catalogLoaded)
  const [q, setQ] = useState("")

  const query = q.trim().toLowerCase()
  const orgs = [...catalog.orgs]
    .filter((o) => !query || o.name.toLowerCase().includes(query))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-xs font-semibold text-muted uppercase tracking-widest">Brand Pages</span>
            <span className="text-xs px-2 py-0.5 bg-amber-900/30 border border-amber-700/40 text-amber-400 rounded-full">Editors only</span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Manage a brand page</h1>
              <p className="text-sm text-muted mt-1">Pick a brand to curate its page: tier, identity, heritage, timeline, team, media, and links.</p>
            </div>
            <Link href="/admin" className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface border border-border-default text-xs text-foreground hover:bg-surface-hover transition-colors">
              ← Dataset Editor
            </Link>
          </div>
        </div>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search brands…"
          className="w-full bg-background border border-border-default rounded-lg px-3 py-2.5 text-sm text-foreground placeholder-zinc-500 focus:outline-none focus:border-blue-500 mb-4"
        />

        {!catalogLoaded ? (
          <div className="text-center text-muted py-16 text-sm">Loading…</div>
        ) : orgs.length === 0 ? (
          <div className="text-center text-muted py-16 text-sm">No brands match.</div>
        ) : (
          <div className="space-y-1.5">
            {orgs.map((o) => {
              const tier = o.curation_tier && o.curation_tier !== "standard" ? TIER_BADGE[o.curation_tier] : null
              return (
                <Link
                  key={o.id}
                  href={`/admin/brand/${o.id}`}
                  className="flex items-center gap-3 px-4 py-3 bg-surface border border-border-default rounded-xl hover:border-foreground/20 transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg shrink-0 overflow-hidden flex items-center justify-center bg-background border border-border-default">
                    {o.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={o.logo_url} alt="" className="w-full h-full object-contain p-0.5" />
                    ) : (
                      <span className="text-[11px] font-semibold text-muted">{o.name.slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{o.name}</div>
                    <div className="text-[11px] text-muted">/{orgSlug(o)}</div>
                  </div>
                  {tier && (
                    <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 border ${tier.cls}`}>{tier.label}</span>
                  )}
                  <span className="text-muted text-xs shrink-0">Manage →</span>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
