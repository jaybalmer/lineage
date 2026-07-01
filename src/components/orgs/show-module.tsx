"use client"

// FNRad: the "Show" block rendered at the top of a media org's page. The media
// org keeps the FULL brand page (stories feed + people/boards/events/places
// connections + contribute); this module adds the show-specific surface on top:
// the episode list, the curated canon, and the editor controls (curate, publish,
// copy public link, add episode). Chrome-less by design (no Nav / header /
// breadcrumb), since the brand page already provides those. Replaces the old
// full-page ShowHubView, which hid all the brand content.

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { CommunityLink } from "@/components/ui/community-link"
import { useLineageStore } from "@/store/lineage-store"
import { StackView } from "@/components/public-timeline/stack-view"
import { StackCurateModal } from "@/components/ui/stack-curate-modal"
import { EpisodeCreateModal } from "@/components/events/episode-create-modal"
import type { Org } from "@/types"
import type { PublicShowPayload } from "@/lib/public-timeline-read"

export function ShowModule({ org }: { org: Org }) {
  const params = useParams<{ community: string }>()
  const community = params?.community ?? "snowboarding"
  const { membership } = useLineageStore()
  const isEditor = membership.is_editor || membership.tier === "founding"

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

  // Nothing to show and not an editor (no controls to offer): render nothing so a
  // brand-shaped media org with no episodes/canon yet stays clean for visitors.
  const isEmpty = !loading && episodes.length === 0 && (!payload || payload.entries.length === 0)
  if (isEmpty && !isEditor) return null

  return (
    <section className="mb-8 rounded-2xl border border-border-default bg-surface p-5 sm:p-6">
      {curating && (
        <StackCurateModal
          title="Curate the canon"
          stackUrl={`/api/orgs/${org.id}/stack`}
          initialEntries={payload?.entries ?? []}
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

      {/* Show header + editor controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <span aria-hidden>🎙</span> The show
        </h2>
        {isEditor && (
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={() => setAddingEpisode(true)}
              className="text-xs px-3 py-1.5 bg-[#1C1917] text-white rounded-lg hover:bg-[#292524] transition-colors font-medium">
              + Add episode
            </button>
            <button onClick={() => setCurating(true)} disabled={loading}
              className="text-xs px-3 py-1.5 rounded-lg border border-border-default text-muted hover:text-foreground disabled:opacity-50 transition-colors">
              Curate canon
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

      {/* Episodes (the show's primary content) */}
      <div className="mb-6">
        <div className="text-[10px] font-semibold text-muted uppercase tracking-widest mb-2">Episodes</div>
        {loading ? (
          <div className="text-sm text-muted py-6 text-center border border-dashed border-border-default rounded-xl">Loading…</div>
        ) : episodes.length === 0 ? (
          <div className="text-sm text-muted py-6 text-center border border-dashed border-border-default rounded-xl">
            No episodes yet.
            {isEditor && <> <button onClick={() => setAddingEpisode(true)} className="text-blue-400 hover:text-blue-300">Add the first one →</button></>}
          </div>
        ) : (
          <div className="space-y-2">
            {episodes.map((e) => (
              <CommunityLink key={e.id} href={`/events/${e.id}`}>
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
      </div>

      {/* Canon (curated highlights) — only when present or curatable */}
      {(loading || (payload && payload.entries.length > 0) || isEditor) && (
        <div>
          <div className="text-[10px] font-semibold text-muted uppercase tracking-widest mb-2">Canon</div>
          {loading ? (
            <div className="text-sm text-muted py-6 text-center border border-dashed border-border-default rounded-xl">Loading…</div>
          ) : payload && payload.entries.length > 0 ? (
            <div className="rounded-2xl p-4 sm:p-5" style={{ background: "#1C1917" }}>
              <StackView entries={payload.entries} owner={payload.owner} stories={payload.stories} entities={payload.entities} />
            </div>
          ) : (
            <div className="text-sm text-muted py-6 text-center border border-dashed border-border-default rounded-xl">
              No canon yet.{" "}
              <button onClick={() => setCurating(true)} disabled={loading} className="text-blue-400 hover:text-blue-300 disabled:opacity-50">Curate it →</button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
