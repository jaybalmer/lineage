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
import { MentionEditorModal } from "@/components/ui/mention-editor-modal"
import { MentionGroup } from "@/components/feed/mention-group"
import { groupMentionsByMoment } from "@/lib/mentions"
import type { Event, Mention } from "@/types"
import type { PublicEpisodePayload } from "@/lib/public-timeline-read"

// ── Session C scheduled release ──────────────────────────────────────────────
// The picker is a <input type="datetime-local">, which speaks LOCAL wall-clock
// with no zone, while the column is timestamptz. These two convert at the edge
// so an editor sets "Feb 3, 9am" in their own time and the gate compares an
// absolute instant.

/** ISO timestamp -> the `YYYY-MM-DDTHH:mm` a datetime-local input expects. */
function toLocalInput(iso: string | null): string {
  if (!iso) return ""
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`
}

/** Local wall-clock from the input -> an absolute ISO instant, or null. */
function fromLocalInput(value: string): string | null {
  if (!value) return null
  const at = new Date(value)
  return Number.isNaN(at.getTime()) ? null : at.toISOString()
}

/** How the public gate currently reads, in one line. */
function publishStateLabel(enabled: boolean, publishAt: string | null): string {
  if (!enabled) return "Not public"
  if (!publishAt) return "Public"
  const at = new Date(publishAt)
  if (Number.isNaN(at.getTime())) return "Public"
  const when = at.toLocaleString(undefined, {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  })
  return at.getTime() <= Date.now() ? `Public since ${when}` : `Scheduled: goes public ${when}`
}

export function EpisodeView({ instance }: { instance: Event }) {
  const { catalog, activePersonId, membership } = useLineageStore()
  const isEditor = membership.is_editor
  const isAuth = isAuthUser(activePersonId)

  const [payload, setPayload] = useState<PublicEpisodePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [guestIds, setGuestIds] = useState<string[]>([])
  const [curating, setCurating] = useState(false)
  const [mentions, setMentions] = useState<Mention[]>([])
  const [addingMention, setAddingMention] = useState(false)
  const [editingMention, setEditingMention] = useState<Mention | null>(null)
  const [link, setLink] = useState<{ enabled: boolean; slug: string | null; publish_at: string | null }>(
    { enabled: false, slug: null, publish_at: null },
  )
  const [scheduleDraft, setScheduleDraft] = useState("")
  const [scheduleSaving, setScheduleSaving] = useState(false)
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
    fetch(`/api/events/${instance.id}/public-link`)
      .then((r) => r.json())
      .then((d) => {
        setLink({ enabled: Boolean(d?.enabled), slug: d?.slug ?? null, publish_at: d?.publish_at ?? null })
        setScheduleDraft(toLocalInput(d?.publish_at ?? null))
      })
      .catch(() => {})
  }, [instance.id, isEditor])

  // Mentions. Editors also pull drafts (the server re-checks the session, so
  // include_drafts is a request, not a grant). Re-runs when the editor flag
  // resolves so a signed-in editor never sees the anonymous read.
  function loadMentions() {
    const url = `/api/mentions?episode_id=${encodeURIComponent(instance.id)}${isEditor ? "&include_drafts=1" : ""}`
    fetch(url)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setMentions(Array.isArray(d) ? (d as Mention[]) : []))
      .catch(() => {})
  }
  useEffect(() => {
    loadMentions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance.id, isEditor])

  // Publishing is a per-STORY act while the schema stores per-subject rows, so
  // every row of a story flips together. One request, not one per subject.
  async function setMentionStatus(rows: Mention[], status: "draft" | "published") {
    const ids = rows.map((m) => m.id)
    if (ids.length === 0) return
    const res = await fetch("/api/admin/mentions", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, status }),
    }).catch(() => null)
    if (!res?.ok) return
    const idSet = new Set(ids)
    setMentions((all) => all.map((m) => (idSet.has(m.id) ? { ...m, status } : m)))
  }

  async function removeMention(mention: Mention) {
    if (!confirm("Remove this mention?")) return
    const res = await fetch(`/api/admin/mentions/${mention.id}`, { method: "DELETE" }).catch(() => null)
    if (res?.ok) setMentions((rows) => rows.filter((m) => m.id !== mention.id))
  }

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
    if (res.ok) setLink({ enabled: Boolean(d.enabled), slug: d.slug ?? link.slug, publish_at: d.publish_at ?? link.publish_at })
  }
  // Schedule save. Sends publish_at ALONE (no enabled key), so saving a time
  // never flips the published flag as a side effect.
  async function saveSchedule() {
    setScheduleSaving(true)
    const publish_at = fromLocalInput(scheduleDraft)
    const res = await fetch(`/api/events/${instance.id}/public-link`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publish_at }),
    }).catch(() => null)
    const d = await res?.json().catch(() => ({}))
    if (res?.ok) {
      setLink((l) => ({ ...l, publish_at: d?.publish_at ?? null }))
      setScheduleDraft(toLocalInput(d?.publish_at ?? null))
    }
    setScheduleSaving(false)
  }
  async function copy() {
    if (!publicUrl) return
    try { await navigator.clipboard.writeText(publicUrl); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch {}
  }
  // Pre-publish preview (B4): mint the slug without publishing if needed, then
  // open /t/[slug], which renders banner-marked for editors while disabled.
  async function openPreview() {
    let slug = link.slug
    if (!slug) {
      const res = await fetch(`/api/events/${instance.id}/public-link`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mint: true }),
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok && d.slug) { slug = d.slug as string; setLink((l) => ({ ...l, slug })) }
    }
    if (slug) window.open(`/t/${slug}`, "_blank", "noopener,noreferrer")
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

      {(addingMention || editingMention) && (
        <MentionEditorModal
          episodeId={instance.id}
          editMention={editingMention ?? undefined}
          onClose={() => { setAddingMention(false); setEditingMention(null) }}
          onSaved={loadMentions}
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
              <button onClick={() => setAddingMention(true)}
                className="text-xs px-3 py-1.5 rounded-lg border border-border-default text-foreground hover:bg-surface-hover transition-colors font-medium">
                Add mentions
              </button>
              <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
                <input type="checkbox" checked={link.enabled} onChange={togglePublish} className="accent-blue-600" />
                Public link
              </label>
              <div className="flex items-center gap-2">
                <button onClick={openPreview} className="text-xs text-accent-strong hover:underline">
                  Preview ↗
                </button>
                {link.enabled && link.slug && (
                  <button onClick={copy} className="text-xs px-2 py-1 rounded-lg border border-border-default text-muted hover:text-foreground transition-colors">
                    {copied ? "Copied" : "Copy link"}
                  </button>
                )}
              </div>

              {/* Scheduled release. Empty = manual (live the moment Public link
                  is ticked). A future time keeps the page editor-only until it
                  passes, with no cron and no redeploy. */}
              <div className="w-full flex flex-wrap items-center gap-2 pt-1">
                <label htmlFor="episode-publish-at" className="text-xs text-muted">Publish at</label>
                <input
                  id="episode-publish-at"
                  type="datetime-local"
                  value={scheduleDraft}
                  onChange={(e) => setScheduleDraft(e.target.value)}
                  className="text-xs px-2 py-1 rounded-lg border border-border-default bg-background text-foreground"
                />
                <button
                  onClick={saveSchedule}
                  disabled={scheduleSaving || scheduleDraft === toLocalInput(link.publish_at)}
                  className="text-xs px-2 py-1 rounded-lg border border-border-default text-muted hover:text-foreground disabled:opacity-40 transition-colors"
                >
                  {scheduleSaving ? "Saving…" : "Save"}
                </button>
                {scheduleDraft && (
                  <button
                    onClick={() => setScheduleDraft("")}
                    className="text-xs text-muted hover:text-foreground transition-colors"
                  >
                    Clear
                  </button>
                )}
                <span className="text-xs text-muted">· {publishStateLabel(link.enabled, link.publish_at)}</span>
              </div>
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
            className="flex items-center justify-center gap-2.5 w-full mb-6 px-6 py-4 rounded-xl bg-blue-600 text-white text-base font-semibold hover:bg-blue-500 transition-colors shadow-sm">
            <span className="text-lg" aria-hidden>▶</span> Listen to the episode
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

        {/* Mentions — who and what got talked about, and when. Hidden entirely
            for non-editors when empty, so a thin episode reads clean. */}
        {(mentions.length > 0 || isEditor) && (
          <section className="mb-8">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="text-xs font-semibold text-muted uppercase tracking-widest">Mentioned in this episode</h2>
              {isEditor && mentions.some((m) => m.status === "draft") && (
                <button
                  type="button"
                  onClick={() => {
                    const drafts = mentions.filter((m) => m.status === "draft")
                    if (!confirm(`Publish all ${drafts.length} draft mentions on this episode?`)) return
                    void setMentionStatus(drafts, "published")
                  }}
                  className="text-[11px] font-medium px-2.5 py-1 rounded-lg border border-border-default text-muted hover:text-foreground transition-colors"
                >
                  Publish all {mentions.filter((m) => m.status === "draft").length}
                </button>
              )}
            </div>
            {mentions.length > 0 ? (
              groupMentionsByMoment(mentions).map((moment) => (
                <MentionGroup
                  key={moment.key}
                  moment={moment}
                  isEditor={isEditor}
                  onEdit={setEditingMention}
                  onRemove={removeMention}
                  onSetStatus={setMentionStatus}
                />
              ))
            ) : (
              <div className="text-sm text-muted py-8 text-center border border-dashed border-border-default rounded-xl">
                No mentions mapped yet. <button onClick={() => setAddingMention(true)} className="text-blue-400 hover:text-blue-300">Add mentions →</button>
              </div>
            )}
          </section>
        )}

        {/* The member-added "community connections" list used to sit here. It
            was a flat roster of every entity an episode touched, with no
            context: a name, and nothing about why it was there.
            Story-first mentions replaced it. A mention says what happened, when
            in the episode it happened, and who else was in it, and the whole
            cast links out the same way the roster did. Keeping both meant the
            page named an entity twice and said less the second time.
            The junction data (event_people / event_places / event_events /
            event_orgs / event_boards) and GET|POST|DELETE
            /api/events/[id]/connections are deliberately left intact, so this
            is a rendering decision and not a deletion. */}

        {!isAuth && (
          <p className="text-xs text-muted text-center">
            <CommunityLink href="/" className="text-accent-strong hover:underline">Join Linestry</CommunityLink> to add what you know about this episode.
          </p>
        )}
      </div>
    </div>
  )
}
