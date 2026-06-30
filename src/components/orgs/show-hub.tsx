"use client"

// FNRad Featured Timelines Phase 3: the in-app show / hub page for a media org
// (org_type='media'). Rendered by brands/[slug]/page.tsx in place of the standard
// brand layout. Header (logo, name, description) + a curated canon (the same
// store-free StackView, in a dark showcase panel) + the episode list + a member
// contribution CTA. Editors get a curate modal, a publish toggle, and a copy-link.

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Nav } from "@/components/ui/nav"
import { CommunityLink } from "@/components/ui/community-link"
import { useLineageStore, isAuthUser } from "@/store/lineage-store"
import { StackView } from "@/components/public-timeline/stack-view"
import { StackCurateModal } from "@/components/ui/stack-curate-modal"
import { EpisodeCreateModal } from "@/components/events/episode-create-modal"
import type { Org } from "@/types"
import type { PublicShowPayload } from "@/lib/public-timeline-read"

export function ShowHubView({ org }: { org: Org }) {
  const params = useParams<{ community: string }>()
  const community = params?.community ?? "snowboarding"
  const { activePersonId, membership } = useLineageStore()
  const isEditor = membership.is_editor || membership.tier === "founding"
  const isAuth = isAuthUser(activePersonId)

  const [payload, setPayload] = useState<PublicShowPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [curating, setCurating] = useState(false)
  const [addingEpisode, setAddingEpisode] = useState(false)
  const [link, setLink] = useState<{ enabled: boolean; slug: string | null }>({ enabled: false, slug: null })
  const [copied, setCopied] = useState(false)
  const [origin, setOrigin] = useState("")

  useEffect(() => { if (typeof window !== "undefined") setOrigin(window.location.origin) }, [])

  function loadStack() {
    fetch(`/api/orgs/${org.id}/stack`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { setPayload(data); setLoading(false) })
      .catch(() => setLoading(false))
  }
  useEffect(() => {
    loadStack()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org.id])

  useEffect(() => {
    if (!isEditor) return
    fetch(`/api/orgs/${org.id}/public-link`).then((r) => r.json()).then((d) => setLink({ enabled: Boolean(d?.enabled), slug: d?.slug ?? null })).catch(() => {})
  }, [org.id, isEditor])

  const episodes = payload?.episodes ?? []
  const publicUrl = link.slug ? `${origin}/t/${link.slug}` : ""

  async function togglePublish() {
    const res = await fetch(`/api/orgs/${org.id}/public-link`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !link.enabled }),
    })
    const d = await res.json().catch(() => ({}))
    if (res.ok) setLink({ enabled: Boolean(d.enabled), slug: d.slug ?? link.slug })
  }
  async function copy() {
    if (!publicUrl) return
    try { await navigator.clipboard.writeText(publicUrl); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch {}
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />

      {curating && payload && (
        <StackCurateModal
          title="Curate the canon"
          stackUrl={`/api/orgs/${org.id}/stack`}
          initialEntries={payload.entries}
          onClose={() => setCurating(false)}
          onSaved={loadStack}
        />
      )}

      {addingEpisode && (
        <EpisodeCreateModal
          showOrgId={org.id}
          communitySlug={community}
          onClose={() => setAddingEpisode(false)}
          // Full nav so the freshly bootstrapped catalog resolves the new episode
          // page (events/[id] -> EpisodeView), landing the editor on it to curate.
          onCreated={(id) => { window.location.href = `/${community}/events/${id}` }}
        />
      )}

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="text-xs text-muted mb-6">
          <CommunityLink href="/brands" className="hover:text-foreground">Brands</CommunityLink>
          <span className="mx-2">/</span>
          <span className="text-muted">{org.name}</span>
        </div>

        {/* Header */}
        <div className="bg-surface border border-border-default rounded-xl p-6 mb-6">
          <div className="flex items-start gap-4">
            {org.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={org.logo_url} alt={org.name} className="w-16 h-16 rounded-2xl object-cover border border-border-default shrink-0" />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-cyan-600 flex items-center justify-center text-2xl font-bold text-white shrink-0">{org.name[0]?.toUpperCase() ?? "?"}</div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-xs text-muted uppercase tracking-widest mb-1">🎙 Show</div>
              <h1 className="text-2xl font-bold text-foreground">{org.name}</h1>
              {org.description && <p className="text-muted text-sm mt-2 leading-relaxed">{org.description}</p>}
            </div>
          </div>

          {/* Editor controls */}
          {isEditor && (
            <div className="mt-5 pt-4 border-t border-border-default flex flex-wrap items-center gap-3">
              <button onClick={() => setCurating(true)} disabled={!payload}
                className="text-xs px-3 py-1.5 bg-[#1C1917] text-white rounded-lg hover:bg-[#292524] disabled:opacity-50 transition-colors font-medium">
                Curate the canon
              </button>
              <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
                <input type="checkbox" checked={link.enabled} onChange={togglePublish} className="accent-blue-600" />
                Public link
              </label>
              {link.enabled && link.slug && (
                <div className="flex items-center gap-2">
                  <a href={`/t/${link.slug}`} target="_blank" rel="noopener noreferrer" className="text-xs text-accent-strong hover:underline">Preview ↗</a>
                  <button onClick={copy} className="text-xs px-2 py-1 rounded-lg border border-border-default text-muted hover:text-foreground transition-colors">
                    {copied ? "Copied" : "Copy link"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Canon */}
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">Canon</h2>
          {loading ? (
            <div className="text-sm text-muted py-8 text-center border border-dashed border-border-default rounded-xl">Loading…</div>
          ) : payload && payload.entries.length > 0 ? (
            <div className="rounded-2xl p-4 sm:p-5" style={{ background: "#1C1917" }}>
              <StackView entries={payload.entries} owner={payload.owner} stories={payload.stories} entities={payload.entities} />
            </div>
          ) : (
            <div className="text-sm text-muted py-8 text-center border border-dashed border-border-default rounded-xl">
              {isEditor ? (
                <>No canon yet. <button onClick={() => setCurating(true)} disabled={!payload} className="text-blue-400 hover:text-blue-300 disabled:opacity-50">Curate it →</button></>
              ) : (
                <>The canon for this show is coming soon.</>
              )}
            </div>
          )}
        </section>

        {/* Episodes */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-muted uppercase tracking-widest">Episodes</h2>
            {isEditor && (
              <button onClick={() => setAddingEpisode(true)} className="text-xs text-accent-strong hover:underline">+ Add episode</button>
            )}
          </div>
          {episodes.length === 0 ? (
            <div className="text-sm text-muted py-6 text-center border border-dashed border-border-default rounded-xl">
              No episodes yet.
              {isEditor && <> <button onClick={() => setAddingEpisode(true)} className="text-blue-400 hover:text-blue-300">Add the first one →</button></>}
            </div>
          ) : (
            <div className="space-y-2">
              {episodes.map((e) => (
                <CommunityLink key={e.id} href={`/events/${e.slug ?? e.id}`}>
                  <div className="flex items-center justify-between gap-3 px-4 py-3 bg-background border border-border-default rounded-xl hover:border-blue-500/40 transition-all">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{e.title}</div>
                      {(e.episode_number != null || e.year) && (
                        <div className="text-xs text-muted">
                          {[e.episode_number != null ? `Episode ${e.episode_number}` : null, e.year ? String(e.year) : null].filter(Boolean).join(" · ")}
                        </div>
                      )}
                    </div>
                    <span className="text-muted text-sm shrink-0">→</span>
                  </div>
                </CommunityLink>
              ))}
            </div>
          )}
        </section>

        {/* Contribution CTA (hub affordance) */}
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-5 text-center">
          <p className="text-sm text-foreground font-medium">Know this show?</p>
          <p className="text-xs text-muted mt-1">
            {isAuth
              ? "Open an episode to add the riders, boards, and places it covered."
              : "Join Linestry to help fill in the people and gear behind every episode."}
          </p>
          {!isAuth && (
            <CommunityLink href="/" className="inline-block mt-3 text-xs text-accent-strong hover:underline">Join Linestry →</CommunityLink>
          )}
        </div>
      </div>
    </div>
  )
}
