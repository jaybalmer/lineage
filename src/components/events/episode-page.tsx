"use client"

// FNRad Featured Timelines Phase 2: the in-app episode page (event_type='episode').
//
// Rendered by events/[id]/page.tsx in place of the standard event instance view.
// Header (show link, episode number + date, guests, media embed) + the curated
// featured set (the same store-free StackView the public /t/[slug] page uses,
// shown here inside a dark showcase panel). Editors get a curate modal, a publish
// toggle, and a copy-link control; everyone else sees the read-only page.

import { useEffect, useState } from "react"
import { Nav } from "@/components/ui/nav"
import { CommunityLink } from "@/components/ui/community-link"
import { useLineageStore, isAuthUser } from "@/store/lineage-store"
import { entityHref } from "@/lib/entity-links"
import { parseYouTubeId, formatEventDateRange } from "@/lib/utils"
import { StackView } from "@/components/public-timeline/stack-view"
import { StackCurateModal } from "@/components/ui/stack-curate-modal"
import { EpisodeConnections } from "@/components/events/episode-connections"
import type { Event } from "@/types"
import type { PublicEpisodePayload } from "@/lib/public-timeline-read"

export function EpisodeView({ instance }: { instance: Event }) {
  const { catalog, activePersonId, membership } = useLineageStore()
  const isEditor = membership.is_editor
  const isAuth = isAuthUser(activePersonId)

  const [payload, setPayload] = useState<PublicEpisodePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [guestIds, setGuestIds] = useState<string[]>([])
  const [curating, setCurating] = useState(false)
  const [link, setLink] = useState<{ enabled: boolean; slug: string | null }>({ enabled: false, slug: null })
  const [copied, setCopied] = useState(false)
  const [origin, setOrigin] = useState("")

  useEffect(() => { if (typeof window !== "undefined") setOrigin(window.location.origin) }, [])

  function loadStack() {
    fetch(`/api/events/${instance.id}/stack`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { setPayload(data); setLoading(false) })
      .catch(() => setLoading(false))
  }
  useEffect(() => {
    loadStack()
    fetch(`/api/events/${instance.id}/guests`).then((r) => r.json()).then((d) => setGuestIds(d?.person_ids ?? [])).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance.id])

  useEffect(() => {
    if (!isEditor) return
    fetch(`/api/events/${instance.id}/public-link`).then((r) => r.json()).then((d) => setLink({ enabled: Boolean(d?.enabled), slug: d?.slug ?? null })).catch(() => {})
  }, [instance.id, isEditor])

  const meta = payload?.meta
  const show = meta?.show ?? null
  const guests = meta?.guests ?? []
  const ytId = instance.media_url ? parseYouTubeId(instance.media_url) : null
  const publicUrl = link.slug ? `${origin}/t/${link.slug}` : ""

  async function togglePublish() {
    const next = !link.enabled
    const res = await fetch(`/api/events/${instance.id}/public-link`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: next }),
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

      {curating && (
        <StackCurateModal
          title="Curate featured set"
          stackUrl={`/api/events/${instance.id}/stack`}
          guestsUrl={`/api/events/${instance.id}/guests`}
          connectionsUrl={`/api/events/${instance.id}/connections`}
          initialEntries={payload?.entries ?? []}
          initialGuestIds={guestIds}
          onClose={() => setCurating(false)}
          onSaved={() => {
            loadStack()
            fetch(`/api/events/${instance.id}/guests`).then((r) => r.json()).then((d) => setGuestIds(d?.person_ids ?? [])).catch(() => {})
          }}
        />
      )}

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="text-xs text-muted mb-6">
          <CommunityLink href="/events" className="hover:text-foreground">Events</CommunityLink>
          <span className="mx-2">/</span>
          {show ? (
            <>
              <CommunityLink href={entityHref(show.id, "org", catalog)} className="hover:text-foreground">{show.name}</CommunityLink>
              <span className="mx-2">/</span>
            </>
          ) : null}
          <span className="text-muted">{instance.name}</span>
        </div>

        {/* Header */}
        <div className="bg-surface border border-border-default rounded-xl p-6 mb-6">
          <div className="text-xs text-muted uppercase tracking-widest mb-1 flex items-center gap-2">
            <span className="text-fuchsia-500">Episode</span>
            {instance.episode_number != null && <span>· #{instance.episode_number}</span>}
            {instance.year && <span>· {instance.year}</span>}
          </div>
          <h1 className="text-2xl font-bold text-foreground">{instance.name}</h1>
          {show && (
            <CommunityLink href={entityHref(show.id, "org", catalog)}>
              <p className="text-sm text-accent-strong hover:underline mt-1">🎙 {show.name}</p>
            </CommunityLink>
          )}
          {instance.description && <p className="text-muted text-sm mt-2 leading-relaxed">{instance.description}</p>}
          <p className="text-muted text-sm mt-1">{formatEventDateRange(instance.start_date, instance.end_date)}</p>

          {/* Guests */}
          {guests.length > 0 && (
            <div className="mt-4">
              <div className="text-[10px] font-semibold text-muted uppercase tracking-widest mb-2">
                {guests.length === 1 ? "Guest" : "Guests"}
              </div>
              <div className="flex flex-wrap gap-2">
                {guests.map((g) => (
                  <span key={g.id} className="inline-flex items-center gap-2 rounded-full bg-surface-hover border border-border-default pr-3">
                    {g.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={g.avatar_url} alt={g.display_name} className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <span className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-xs font-bold text-white">{g.display_name[0]?.toUpperCase() ?? "?"}</span>
                    )}
                    <span className="text-xs text-foreground">{g.display_name}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Editor controls */}
          {isEditor && (
            <div className="mt-5 pt-4 border-t border-border-default flex flex-wrap items-center gap-3">
              <button onClick={() => setCurating(true)} disabled={loading}
                className="text-xs px-3 py-1.5 bg-[#1C1917] text-white rounded-lg hover:bg-[#292524] disabled:opacity-50 transition-colors font-medium">
                Curate featured set
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

        {/* Media */}
        {ytId && (
          <section className="mb-6">
            <div className="aspect-video rounded-xl overflow-hidden border border-border-default">
              <iframe
                src={`https://www.youtube.com/embed/${ytId}`}
                title={instance.name}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
          </section>
        )}
        {!ytId && instance.media_url && (
          <a href={instance.media_url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-lg bg-surface border border-border-default text-sm font-medium text-foreground hover:border-blue-500/40 transition-colors">
            ▶ Listen to the episode
          </a>
        )}

        {/* Featured set */}
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">Featured in this episode</h2>
          {loading ? (
            <div className="text-sm text-muted py-8 text-center border border-dashed border-border-default rounded-xl">Loading…</div>
          ) : payload && payload.entries.length > 0 ? (
            <div className="rounded-2xl p-4 sm:p-5" style={{ background: "#1C1917" }}>
              <StackView entries={payload.entries} owner={payload.owner} stories={payload.stories} entities={payload.entities} />
            </div>
          ) : (
            <div className="text-sm text-muted py-8 text-center border border-dashed border-border-default rounded-xl">
              {isEditor ? (
                <>Nothing featured yet. <button onClick={() => setCurating(true)} disabled={loading} className="text-blue-400 hover:text-blue-300 disabled:opacity-50">Curate the featured set →</button></>
              ) : (
                <>The featured set for this episode is coming soon.</>
              )}
            </div>
          )}
        </section>

        {/* Community connections (member-added) */}
        <EpisodeConnections eventId={instance.id} />

        {!isAuth && (
          <p className="text-xs text-muted text-center">
            <CommunityLink href="/" className="text-accent-strong hover:underline">Join Linestry</CommunityLink> to add what you know about this episode.
          </p>
        )}
      </div>
    </div>
  )
}
