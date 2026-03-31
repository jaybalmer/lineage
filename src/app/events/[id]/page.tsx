"use client"

import { use, useState, useEffect, useRef, useMemo } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Nav } from "@/components/ui/nav"
import { ImageLightbox } from "@/components/ui/image-lightbox"
import { useLineageStore, isAuthUser } from "@/store/lineage-store"
import { supabase } from "@/lib/supabase"
import { EVENTS, EVENT_SERIES, eventSlug, seriesSlug, placeSlug } from "@/lib/mock-data"
import { AddEntityModal } from "@/components/ui/add-entity-modal"
import { RiderAvatar } from "@/components/ui/rider-avatar"
import type { Event, Story, Claim } from "@/types"
import { StoryCard } from "@/components/feed/story-card"
import { AddStoryModal } from "@/components/ui/add-story-modal"
import { EditEventModal } from "@/components/ui/edit-event-modal"
import { parseYouTubeId } from "@/lib/utils"

function formatEventDate(start: string, end?: string): string {
  const [sy, sm, sd] = start.split("-").map(Number)
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  const startStr = `${sd} ${months[sm - 1]} ${sy}`
  if (!end || end === start) return startStr
  const [ey, em, ed] = end.split("-").map(Number)
  if (sy === ey && sm === em) return `${sd}–${ed} ${months[sm - 1]} ${sy}`
  return `${startStr} – ${ed} ${months[em - 1]} ${ey}`
}

const EVENT_PREDICATES = ["competed_at", "spectated_at", "organized_at"] as const

function parseResult(result?: string): number {
  if (!result) return 9999
  const n = parseInt(result)
  return isNaN(n) ? 9999 : n
}

function AttendeeList({ eventId }: { eventId: string }) {
  const { catalog, sessionClaims, dbClaims, membership, removeClaim } = useLineageStore()
  const isEditor = membership.is_editor
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const allClaims = [...catalog.claims, ...sessionClaims, ...dbClaims]
  // Deduplicate by claim id, then by subject+predicate (keep first occurrence)
  const byId = Array.from(new Map(allClaims.map((c) => [c.id, c])).values())
  const eventClaims = byId.filter(
    (c) => c.object_id === eventId && EVENT_PREDICATES.includes(c.predicate as typeof EVENT_PREDICATES[number])
  )
  // Deduplicate: same person + same role = keep only first (prevents duplicate entries)
  const seen = new Set<string>()
  const claims = eventClaims.filter((c) => {
    const key = `${c.subject_id}:${c.predicate}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const competitors = claims
    .filter((c) => c.predicate === "competed_at")
    .sort((a, b) => parseResult(a.result) - parseResult(b.result))
  const attendees = claims.filter((c) => c.predicate === "spectated_at")
  const organizers = claims.filter((c) => c.predicate === "organized_at")

  if (claims.length === 0) {
    return <div className="text-xs text-muted italic py-2">No participants documented</div>
  }

  function handleDelete(claimId: string) {
    setDeleting(true)
    removeClaim(claimId)
    setConfirmDeleteId(null)
    setDeleting(false)
  }

  const RiderChip = ({ claim }: { claim: typeof claims[0] }) => {
    const person = catalog.people.find((p) => p.id === claim.subject_id)
    if (!person) return null
    const isConfirming = confirmDeleteId === claim.id
    return (
      <div className="relative">
        <div
          role="link"
          onClick={(e) => {
            if (isConfirming) return
            e.preventDefault(); e.stopPropagation(); window.location.href = `/riders/${claim.subject_id}`
          }}
          className="flex items-center gap-2 px-3 py-2 bg-surface border border-border-default rounded-xl hover:border-blue-500/40 transition-all group cursor-pointer"
        >
          <RiderAvatar person={person} size="sm" ring={!!(person.membership_tier && person.membership_tier !== "free")} />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-foreground group-hover:text-blue-400 transition-colors leading-tight">
              {person.display_name}
            </div>
            {(claim.division || claim.result) && (
              <div className="text-[10px] text-muted leading-tight mt-0.5 flex items-center gap-1">
                {claim.result && (
                  <span className="font-semibold text-amber-400">{claim.result}</span>
                )}
                {claim.result && claim.division && <span>·</span>}
                {claim.division && <span>{claim.division}</span>}
              </div>
            )}
          </div>
          {isEditor && !isConfirming && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDeleteId(claim.id) }}
              className="opacity-0 group-hover:opacity-100 shrink-0 w-5 h-5 flex items-center justify-center rounded-full text-muted hover:text-red-400 hover:bg-red-500/10 transition-all text-xs"
              title="Remove from event"
            >
              ✕
            </button>
          )}
        </div>
        {isConfirming && (
          <div className="mt-1 p-2 bg-surface border border-border-default rounded-lg flex items-center gap-2">
            <span className="text-[10px] text-muted flex-1">Remove {person.display_name}? This is permanent.</span>
            <button
              onClick={() => setConfirmDeleteId(null)}
              className="text-[10px] text-muted hover:text-foreground transition-colors px-1.5 py-0.5"
            >
              Cancel
            </button>
            <button
              onClick={() => handleDelete(claim.id)}
              disabled={deleting}
              className="text-[10px] text-red-400 hover:text-red-300 font-medium transition-colors px-1.5 py-0.5"
            >
              {deleting ? "Deleting\u2026" : "Delete"}
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {competitors.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold text-muted uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <span className="text-amber-400">🏆</span> Competitors
            <span className="text-muted font-normal">({competitors.length})</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {competitors.map((c) => <RiderChip key={c.id} claim={c} />)}
          </div>
        </div>
      )}
      {attendees.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold text-muted uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <span>👁</span> Attendees
            <span className="text-muted font-normal">({attendees.length})</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {attendees.map((c) => <RiderChip key={c.id} claim={c} />)}
          </div>
        </div>
      )}
      {organizers.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold text-muted uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <span>🎬</span> Organizers
            <span className="text-muted font-normal">({organizers.length})</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {organizers.map((c) => <RiderChip key={c.id} claim={c} />)}
          </div>
        </div>
      )}
    </div>
  )
}

function InstanceRow({ event }: { event: Event }) {
  const { catalog } = useLineageStore()
  const place = event.place_id ? catalog.places.find((p) => p.id === event.place_id) : null
  const attendeeCount = catalog.claims.filter(
    (c) => c.object_id === event.id && EVENT_PREDICATES.includes(c.predicate as typeof EVENT_PREDICATES[number])
  ).length

  return (
    <div
      role="link"
      onClick={() => { window.location.href = `/events/${event.id}` }}
      className="block cursor-pointer border border-border-default bg-background rounded-xl overflow-hidden hover:border-blue-500/40 transition-all"
    >
      <div className="px-4 py-3 border-b border-border-default flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-foreground">{event.name}</div>
          <div className="text-xs text-muted mt-0.5">
            {formatEventDate(event.start_date, event.end_date)}
            {place && <span className="text-muted"> · {place.name}</span>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-lg font-bold text-foreground">{attendeeCount}</div>
          <div className="text-[10px] text-muted">participant{attendeeCount !== 1 ? "s" : ""}</div>
        </div>
      </div>
      <div className="px-4 py-3">
        <AttendeeList eventId={event.id} />
      </div>
    </div>
  )
}

// ─── Photo system for individual event instances ──────────────────────────────

type VoteRow = { id: string; vote: string; user_id: string; suggested_image_url?: string | null }

function EventInstancePhotoBlock({ eventId, eventName, activePersonId }: {
  eventId: string
  eventName: string
  activePersonId: string
}) {
  const isAuth = isAuthUser(activePersonId)

  const [imageVoteRows, setImageVoteRows] = useState<VoteRow[]>([])
  const [imageVotes, setImageVotes] = useState<{ up: number; flag: number; userVote: "up" | "flag" | null; userVoteId: string | null }>({ up: 0, flag: 0, userVote: null, userVoteId: null })
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [showSuggestForm, setShowSuggestForm] = useState(false)
  const [suggestUrl, setSuggestUrl] = useState("")
  const [suggesting, setSuggesting] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [removingPhoto, setRemovingPhoto] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fetchedForEvent = useRef<string | null>(null)

  const suggestedImageUrl = imageVoteRows.find((r) => r.suggested_image_url)?.suggested_image_url ?? null
  const myImageVoteRow = imageVoteRows.find((r) => r.user_id === activePersonId && r.suggested_image_url)
  const displayImageUrl = suggestedImageUrl ?? null

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useMemo(() => {
    if (fetchedForEvent.current === eventId) return
    fetchedForEvent.current = eventId
    supabase.from("event_image_votes").select("id, vote, user_id, suggested_image_url")
      .eq("event_id", eventId).order("created_at", { ascending: false })
      .then(({ data }) => {
        if (!data) return
        const rows = data as VoteRow[]
        const up = rows.filter((v) => v.vote === "up").length
        const flag = rows.filter((v) => v.vote === "flag").length
        const mine = rows.find((v) => v.user_id === activePersonId)
        setImageVotes({ up, flag, userVote: (mine?.vote as "up" | "flag") ?? null, userVoteId: mine?.id ?? null })
        setImageVoteRows(rows)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  async function handleVote(vote: "up" | "flag") {
    if (!isAuth) return
    if (imageVotes.userVote === vote) {
      if (imageVotes.userVoteId) {
        await supabase.from("event_image_votes").delete().eq("id", imageVotes.userVoteId)
        setImageVotes((v) => ({ ...v, [vote]: v[vote] - 1, userVote: null, userVoteId: null }))
      }
      return
    }
    const prev = imageVotes.userVote
    const { data } = await supabase.from("event_image_votes").upsert(
      { event_id: eventId, user_id: activePersonId, vote },
      { onConflict: "event_id,user_id" }
    ).select("id").single()
    setImageVotes((v) => ({
      up:   vote === "up"   ? v.up + 1   : prev === "up"   ? v.up - 1   : v.up,
      flag: vote === "flag" ? v.flag + 1 : prev === "flag" ? v.flag - 1 : v.flag,
      userVote: vote,
      userVoteId: (data as { id: string } | null)?.id ?? v.userVoteId,
    }))
  }

  async function saveImageUrl(permanentUrl: string) {
    const { data, error } = await supabase.from("event_image_votes").upsert(
      { event_id: eventId, user_id: activePersonId, vote: "up", suggested_image_url: permanentUrl },
      { onConflict: "event_id,user_id" }
    ).select("id, vote, user_id, suggested_image_url").single()
    if (!error && data) {
      setImageVoteRows((prev) => {
        const without = prev.filter((r) => r.user_id !== activePersonId)
        return [data as VoteRow, ...without]
      })
    }
  }

  async function handleRemovePhoto() {
    if (!myImageVoteRow || removingPhoto) return
    setRemovingPhoto(true)
    const { error } = await supabase.from("event_image_votes")
      .update({ suggested_image_url: null }).eq("id", myImageVoteRow.id)
    if (!error) {
      setImageVoteRows((prev) =>
        prev.map((r) => r.id === myImageVoteRow.id ? { ...r, suggested_image_url: null } : r)
      )
    }
    setRemovingPhoto(false)
  }

  async function handleSuggestImage(e: React.FormEvent) {
    e.preventDefault()
    if (!suggestUrl.trim() || suggesting) return
    setSuggesting(true)
    setPhotoError(null)
    try {
      const res = await fetch("/api/events/archive-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: suggestUrl.trim(), event_id: eventId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Archive failed")
      await saveImageUrl(json.url)
      setSuggestUrl("")
      setShowSuggestForm(false)
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Failed to save image")
    } finally {
      setSuggesting(false)
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { setPhotoError("File too large — max 10 MB"); return }
    if (!file.type.startsWith("image/")) { setPhotoError("Please select an image file"); return }
    setUploadingPhoto(true)
    setPhotoError(null)
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg"
      const path = `events/${eventId}/${activePersonId}-${Date.now()}.${ext}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("event-images").upload(path, file, { contentType: file.type, upsert: false })
      if (uploadError || !uploadData) throw new Error(uploadError?.message ?? "Upload failed")
      const { data: { publicUrl } } = supabase.storage.from("event-images").getPublicUrl(uploadData.path)
      await saveImageUrl(publicUrl)
      setShowSuggestForm(false)
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploadingPhoto(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  return (
    <>
      {lightboxOpen && displayImageUrl && (
        <ImageLightbox src={displayImageUrl} alt={eventName} onClose={() => setLightboxOpen(false)} />
      )}
      <div className="shrink-0">
        {displayImageUrl ? (
          <button
            onClick={() => setLightboxOpen(true)}
            className="block w-24 h-24 rounded-lg overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500 group relative"
            title="Click to enlarge"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={displayImageUrl}
              alt={eventName}
              className="w-full h-full object-cover bg-surface-hover transition-transform group-hover:scale-105"
              onError={(e) => { (e.target as HTMLImageElement).closest("button")!.style.display = "none" }}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-medium transition-opacity drop-shadow">⤢ enlarge</span>
            </div>
          </button>
        ) : (
          <div className="w-24 h-24 rounded-lg bg-surface-hover border border-border-default flex items-center justify-center text-4xl">🏆</div>
        )}
        {isAuth && (
          <div className="flex gap-1 mt-2 justify-center">
            <button
              onClick={() => handleVote("up")}
              title="Confirm image is correct"
              className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] transition-colors ${imageVotes.userVote === "up" ? "bg-emerald-800/60 text-emerald-300 border border-emerald-700/50" : "bg-surface border border-border-default text-muted hover:text-foreground"}`}
            >
              👍{imageVotes.up > 0 && <span className="ml-0.5">{imageVotes.up}</span>}
            </button>
            <button
              onClick={() => handleVote("flag")}
              title="Flag as wrong image"
              className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] transition-colors ${imageVotes.userVote === "flag" ? "bg-red-900/60 text-red-300 border border-red-800/50" : "bg-surface border border-border-default text-muted hover:text-foreground"}`}
            >
              🚩{imageVotes.flag > 0 && <span className="ml-0.5">{imageVotes.flag}</span>}
            </button>
          </div>
        )}
        {isAuth && myImageVoteRow && (
          <div className="mt-1.5 flex justify-center">
            <button
              onClick={handleRemovePhoto}
              disabled={removingPhoto}
              className="text-[10px] text-muted hover:text-red-400 transition-colors disabled:opacity-50"
            >
              {removingPhoto ? "removing…" : "remove my photo"}
            </button>
          </div>
        )}
        {isAuth && (
          <div className="mt-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleFileUpload}
            />
            {!showSuggestForm ? (
              <button
                onClick={() => { setShowSuggestForm(true); setPhotoError(null) }}
                className="text-[10px] text-muted hover:text-foreground transition-colors w-full text-center"
              >
                {displayImageUrl ? "+ Update" : "+ Add photo"}
              </button>
            ) : (
              <div className="space-y-1.5 mt-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto || suggesting}
                  className="flex items-center gap-1 px-2 py-1 rounded border border-dashed border-border-default text-[10px] text-muted hover:text-foreground hover:border-blue-600 disabled:opacity-50 transition-colors w-full justify-center"
                >
                  {uploadingPhoto ? <span className="animate-pulse">Uploading…</span> : <><span>📁</span> Upload</>}
                </button>
                <form onSubmit={handleSuggestImage} className="flex gap-1">
                  <input
                    value={suggestUrl}
                    onChange={(e) => setSuggestUrl(e.target.value)}
                    placeholder="https://…"
                    className="flex-1 bg-surface-hover border border-border-default rounded px-2 py-1 text-[10px] text-foreground placeholder-zinc-600 outline-none focus:border-blue-600 min-w-0"
                  />
                  <button
                    type="submit"
                    disabled={suggesting || uploadingPhoto || !suggestUrl.trim()}
                    className="px-2 py-1 rounded bg-blue-600 text-white text-[10px] font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors"
                  >
                    {suggesting ? "…" : "Save"}
                  </button>
                </form>
                {photoError && <p className="text-[10px] text-red-400">{photoError}</p>}
                <button
                  type="button"
                  onClick={() => { setShowSuggestForm(false); setPhotoError(null) }}
                  className="text-[10px] text-muted hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

// ─── Add Rider to Event ────────────────────────────────────────────────────────

const ROLE_OPTIONS = [
  { value: "competed_at" as const, label: "Competed", icon: "🏆" },
  { value: "spectated_at" as const, label: "Spectated", icon: "👁" },
  { value: "organized_at" as const, label: "Organized", icon: "🎬" },
]

function AddRiderToEvent({
  eventId, eventStartDate, riderQuery, setRiderQuery, riderRole, setRiderRole, addClaim, activePersonId, catalog, onDone,
}: {
  eventId: string
  eventStartDate?: string | null
  riderQuery: string
  setRiderQuery: (q: string) => void
  riderRole: "competed_at" | "spectated_at" | "organized_at"
  setRiderRole: (r: "competed_at" | "spectated_at" | "organized_at") => void
  addClaim: (claim: Claim) => void
  activePersonId: string | null
  catalog: { people: { id: string; display_name: string }[]; claims: Claim[] }
  onDone: () => void
}) {
  const { addUserPerson, sessionClaims, dbClaims } = useLineageStore()
  const [showNewRider, setShowNewRider] = useState(false)
  const [newRiderName, setNewRiderName] = useState("")

  const allClaims = [...catalog.claims, ...sessionClaims, ...dbClaims]
  const existingRiderIds = new Set(
    allClaims
      .filter((c) => c.object_id === eventId && EVENT_PREDICATES.includes(c.predicate as typeof EVENT_PREDICATES[number]))
      .map((c) => c.subject_id)
  )

  const matches = riderQuery.trim()
    ? catalog.people
        .filter((p) => p.display_name.toLowerCase().includes(riderQuery.toLowerCase()))
        .slice(0, 8)
    : []

  function addRiderClaim(riderId: string) {
    const claimId = `claim_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    addClaim({
      id: claimId,
      subject_id: riderId,
      subject_type: "person",
      predicate: riderRole,
      object_id: eventId,
      object_type: "event",
      start_date: eventStartDate ?? undefined,
      confidence: "self-reported",
      visibility: "public",
      asserted_by: activePersonId ?? riderId,
      created_at: new Date().toISOString(),
    })
    setRiderQuery("")
  }

  function handleCreateRider() {
    if (!newRiderName.trim()) return
    const personId = `person_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    addUserPerson({
      id: personId,
      display_name: newRiderName.trim(),
      privacy_level: "public",
    } as import("@/types").Person)
    addRiderClaim(personId)
    setNewRiderName("")
    setShowNewRider(false)
  }

  return (
    <div className="mb-3 p-3 border border-blue-500/30 rounded-xl bg-blue-950/10 space-y-2">
      <div className="flex gap-1.5 mb-2">
        {ROLE_OPTIONS.map(({ value, label, icon }) => (
          <button
            key={value}
            onClick={() => setRiderRole(value)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${
              riderRole === value
                ? "bg-blue-600/20 border-blue-500/50 text-blue-300"
                : "border-border-default text-muted hover:text-foreground"
            }`}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {/* Add myself shortcut */}
      {activePersonId && !existingRiderIds.has(activePersonId) && (
        <button
          onClick={() => addRiderClaim(activePersonId)}
          className="w-full text-left px-3 py-2 text-sm text-blue-400 hover:bg-surface-hover rounded-lg transition-colors"
        >
          + Add myself
        </button>
      )}

      {/* Search for existing riders */}
      <div className="relative">
        <input
          type="text"
          value={riderQuery}
          onChange={(e) => { setRiderQuery(e.target.value); setShowNewRider(false) }}
          placeholder="Search riders by name…"
          className="w-full bg-background border border-border-default rounded-lg px-3 py-2 text-sm text-foreground placeholder-zinc-600 focus:outline-none focus:border-blue-500"
          autoFocus
        />
        {riderQuery.trim().length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-surface border border-border-default rounded-lg shadow-xl max-h-48 overflow-y-auto">
            {matches.map((p) => (
              <button
                key={p.id}
                onClick={() => addRiderClaim(p.id)}
                disabled={existingRiderIds.has(p.id)}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                  existingRiderIds.has(p.id)
                    ? "text-muted/50 cursor-not-allowed"
                    : "text-muted hover:bg-surface-hover hover:text-foreground"
                }`}
              >
                {p.display_name}
                {existingRiderIds.has(p.id) && <span className="text-xs ml-2">(already added)</span>}
              </button>
            ))}
            <button
              onClick={() => { setShowNewRider(true); setNewRiderName(riderQuery.trim()) }}
              className="w-full text-left px-3 py-2 text-sm text-blue-400 hover:bg-surface-hover transition-colors flex items-center gap-2"
            >
              <span className="font-bold">+</span> Add &ldquo;{riderQuery.trim()}&rdquo; as new rider
            </button>
          </div>
        )}
      </div>

      {/* Create new rider inline */}
      {showNewRider && (
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={newRiderName}
            onChange={(e) => setNewRiderName(e.target.value)}
            placeholder="Rider name…"
            className="flex-1 bg-background border border-border-default rounded-lg px-3 py-2 text-sm text-foreground placeholder-zinc-600 focus:outline-none focus:border-blue-500"
            autoFocus
          />
          <button
            onClick={handleCreateRider}
            disabled={!newRiderName.trim()}
            className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors"
          >
            Add
          </button>
          <button
            onClick={() => setShowNewRider(false)}
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      <button onClick={onDone} className="text-xs text-muted hover:text-foreground transition-colors">
        Done
      </button>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { catalog, userEntities, activePersonId } = useLineageStore()
  const isAuth = isAuthUser(activePersonId)
  const [showAddEdition, setShowAddEdition] = useState(false)
  const [eventStories, setEventStories] = useState<Story[]>([])
  const [addingStory, setAddingStory] = useState(false)
  const [editingEvent, setEditingEvent] = useState(false)
  const [addingRider, setAddingRider] = useState(false)
  const [riderQuery, setRiderQuery] = useState("")
  const [riderRole, setRiderRole] = useState<"competed_at" | "spectated_at" | "organized_at">("competed_at")
  const { addClaim } = useLineageStore()

  // Fetch stories for event instances (not series)
  const instanceId = (() => {
    const allSeries = [...EVENT_SERIES, ...catalog.eventSeries]
    const isSeries = allSeries.some((s) => s.id === id || seriesSlug(s) === id)
    if (isSeries) return null
    const allEvts = [...EVENTS, ...catalog.events.filter((e) => !EVENTS.some((m) => m.id === e.id)), ...userEntities.events]
    const inst = allEvts.find((e) => e.id === id) ?? allEvts.find((e) => eventSlug(e) === id)
    return inst?.id ?? null
  })()

  useEffect(() => {
    if (!instanceId) return
    fetch(`/api/stories?event_id=${instanceId}&limit=50`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setEventStories(data as Story[]) })
  }, [instanceId])

  // Look up from all sources: mock-data, catalog (Supabase), and user-added entities
  const allSeries = [
    ...EVENT_SERIES,
    ...catalog.eventSeries.filter((s) => !EVENT_SERIES.some((m) => m.id === s.id)),
  ]
  const allEvents = [
    ...EVENTS,
    ...catalog.events.filter((e) => !EVENTS.some((m) => m.id === e.id)),
    ...userEntities.events,
  ]

  const series =
    allSeries.find((s) => s.id === id) ??
    allSeries.find((s) => seriesSlug(s) === id)

  const instance = series
    ? undefined
    : allEvents.find((e) => e.id === id) ??
      allEvents.find((e) => eventSlug(e) === id)

  if (!series && !instance) notFound()

  // ── Instance view ────────────────────────────────────────────────────────
  if (instance && !series) {
    const parentSeries = instance.series_id
      ? catalog.eventSeries.find((s) => s.id === instance.series_id)
      : null
    const seriesInstances = parentSeries
      ? catalog.events.filter((e) => e.series_id === parentSeries.id).sort(
          (a, b) => (a.year ?? 0) - (b.year ?? 0)
        )
      : []
    const place = instance.place_id ? catalog.places.find((p) => p.id === instance.place_id) : null
    const totalAttendees = catalog.claims.filter(
      (c) => c.object_id === instance.id && EVENT_PREDICATES.includes(c.predicate as typeof EVENT_PREDICATES[number])
    ).length

    return (
      <div className="min-h-screen bg-background text-foreground">
        <Nav />

        {addingStory && (
          <AddStoryModal
            onClose={() => setAddingStory(false)}
            onSaved={(s) => { setEventStories((prev) => [s, ...prev]); setAddingStory(false) }}
            defaults={{ linkedEventId: instance.id }}
          />
        )}

        {editingEvent && (
          <EditEventModal
            event={instance}
            onClose={() => setEditingEvent(false)}
          />
        )}

        <div className="max-w-3xl mx-auto px-4 py-8">
          {/* Breadcrumb */}
          <div className="text-xs text-muted mb-6">
            <Link href="/events" className="hover:text-foreground">Events</Link>
            <span className="mx-2">/</span>
            {parentSeries ? (
              <>
                <Link href={`/events/${seriesSlug(parentSeries)}`} className="hover:text-foreground">{parentSeries.name}</Link>
                <span className="mx-2">/</span>
              </>
            ) : null}
            <span className="text-muted">{instance.name}</span>
          </div>

          {/* Header */}
          <div className="bg-surface border border-border-default rounded-xl p-6 mb-6">
            <div className="flex items-start gap-5">
              {/* Photo block */}
              <EventInstancePhotoBlock
                eventId={instance.id}
                eventName={instance.name}
                activePersonId={activePersonId ?? ""}
              />

              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted uppercase tracking-widest mb-1 flex items-center gap-2">
                  <span>{instance.event_type}</span>
                  {instance.year && <span className="text-muted">· {instance.year}</span>}
                </div>
                <div className="flex items-start justify-between gap-2">
                  <h1 className="text-2xl font-bold text-foreground">{instance.name}</h1>
                  {isAuth && (
                    <button
                      onClick={() => setEditingEvent(true)}
                      className="shrink-0 text-xs text-muted hover:text-foreground transition-colors px-2 py-1 border border-border-default rounded-lg hover:border-blue-500/40"
                    >
                      Edit
                    </button>
                  )}
                </div>
                {instance.description && (
                  <p className="text-muted text-sm mt-1 leading-relaxed">{instance.description}</p>
                )}
                {place && (
                  <Link href={`/places/${placeSlug(place)}`}>
                    <p className="text-muted text-sm mt-1 hover:text-blue-300 transition-colors">
                      🏔 {place.name}
                    </p>
                  </Link>
                )}
                <p className="text-muted text-sm mt-0.5">
                  {formatEventDate(instance.start_date, instance.end_date)}
                </p>
                {instance.website_url && (
                  <a
                    href={instance.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition-colors mt-1"
                  >
                    🔗 Website
                  </a>
                )}
                <div className="mt-4 flex gap-6">
                  <div>
                    <div className="font-bold text-foreground text-xl">{totalAttendees}</div>
                    <div className="text-muted text-xs">documented participants</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* YouTube embed */}
          {instance.youtube_url && parseYouTubeId(instance.youtube_url) && (
            <section className="mb-6">
              <div className="aspect-video rounded-xl overflow-hidden border border-border-default">
                <iframe
                  src={`https://www.youtube.com/embed/${parseYouTubeId(instance.youtube_url)}`}
                  title={instance.name}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                />
              </div>
            </section>
          )}

          {/* Participants */}
          <section className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-muted uppercase tracking-widest">Participants</h2>
              {isAuth && (
                <button
                  onClick={() => setAddingRider(!addingRider)}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {addingRider ? "Cancel" : "+ Add rider"}
                </button>
              )}
            </div>
            {addingRider && (
              <AddRiderToEvent
                eventId={instance.id}
                eventStartDate={instance.start_date}
                riderQuery={riderQuery}
                setRiderQuery={setRiderQuery}
                riderRole={riderRole}
                setRiderRole={setRiderRole}
                addClaim={addClaim}
                activePersonId={activePersonId}
                catalog={catalog}
                onDone={() => { setAddingRider(false); setRiderQuery("") }}
              />
            )}
            <div className="bg-background border border-border-default rounded-xl p-4">
              <AttendeeList eventId={instance.id} />
            </div>
          </section>

          {/* Stories */}
          {(eventStories.length > 0 || isAuth) && (
            <section className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold text-muted uppercase tracking-widest">Stories</h2>
                {isAuth && (
                  <button onClick={() => setAddingStory(true)} className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
                    ✍ Add a story
                  </button>
                )}
              </div>
              {eventStories.length === 0 ? (
                <div className="py-8 text-center border border-dashed border-border-default rounded-xl">
                  <div className="text-xs text-muted">No stories yet.</div>
                  <button onClick={() => setAddingStory(true)} className="text-xs text-violet-400 hover:text-violet-300 transition-colors mt-1">Share the first one →</button>
                </div>
              ) : (
                <div className="space-y-3">
                  {eventStories.map((s) => (
                    <StoryCard
                      key={s.id}
                      story={s}
                      isOwn={s.author_id === activePersonId}
                      onDelete={(sid) => setEventStories((prev) => prev.filter((x) => x.id !== sid))}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Other years in series */}
          {seriesInstances.length > 1 && (
            <section>
              <h2 className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">
                Other years — {parentSeries?.name}
              </h2>
              <div className="space-y-2">
                {seriesInstances.filter((e) => e.id !== instance.id).map((e) => {
                  const count = catalog.claims.filter(
                    (c) => c.object_id === e.id && EVENT_PREDICATES.includes(c.predicate as typeof EVENT_PREDICATES[number])
                  ).length
                  return (
                    <Link key={e.id} href={`/events/${e.id}`}>
                      <div className="flex items-center justify-between px-4 py-2.5 bg-background border border-border-default rounded-lg hover:border-border-default transition-all">
                        <div>
                          <div className="text-sm text-foreground">{e.name}</div>
                          <div className="text-xs text-muted">{formatEventDate(e.start_date, e.end_date)}</div>
                        </div>
                        <div className="text-xs text-muted">{count} rider{count !== 1 ? "s" : ""}</div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    )
  }

  // ── Series view ──────────────────────────────────────────────────────────
  const seriesInstances = allEvents
    .filter((e) => e.series_id === series!.id)
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))

  const place = series!.place_id ? catalog.places.find((p) => p.id === series!.place_id) : null

  const totalAttendees = new Set(
    catalog.claims
      .filter(
        (c) =>
          EVENT_PREDICATES.includes(c.predicate as typeof EVENT_PREDICATES[number]) &&
          seriesInstances.some((e) => e.id === c.object_id)
      )
      .map((c) => c.subject_id)
  ).size

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Breadcrumb */}
        <div className="text-xs text-muted mb-6">
          <Link href="/events" className="hover:text-foreground">Events</Link>
          <span className="mx-2">/</span>
          <span className="text-muted">{series!.name}</span>
        </div>

        {/* Header */}
        <div className="bg-surface border border-border-default rounded-xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-muted uppercase tracking-widest">Event Series</span>
            <span className="text-xs text-muted">· {series!.frequency}</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">{series!.name}</h1>
          {place && (
            <Link href={`/places/${placeSlug(place)}`}>
              <p className="text-muted text-sm mt-1 hover:text-blue-300 transition-colors">
                🏔 {place.name}
              </p>
            </Link>
          )}
          {series!.description && (
            <p className="text-muted text-sm mt-2 leading-relaxed">{series!.description}</p>
          )}

          <div className="mt-5 flex gap-6">
            <div>
              <div className="font-bold text-foreground text-xl">{seriesInstances.length}</div>
              <div className="text-muted text-xs">documented years</div>
            </div>
            <div className="w-px bg-border-default" />
            <div>
              <div className="font-bold text-foreground text-xl">{totalAttendees}</div>
              <div className="text-muted text-xs">unique riders</div>
            </div>
            {series!.start_year && (
              <>
                <div className="w-px bg-border-default" />
                <div>
                  <div className="font-bold text-foreground text-base">{series!.start_year}</div>
                  <div className="text-muted text-xs">since</div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Instances by year */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-muted uppercase tracking-widest">Editions by year</h2>
            <button
              onClick={() => setShowAddEdition(true)}
              className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors font-medium"
            >
              + Add edition
            </button>
          </div>
          {seriesInstances.length === 0 ? (
            <div className="text-sm text-muted py-8 text-center border border-dashed border-border-default rounded-xl">
              No editions documented yet.{" "}
              <button onClick={() => setShowAddEdition(true)} className="text-blue-400 hover:text-blue-300 transition-colors">
                Add the first one →
              </button>
            </div>
          ) : (
            seriesInstances.map((event) => (
              <InstanceRow key={event.id} event={event} />
            ))
          )}
        </div>
      </div>

      {showAddEdition && (
        <AddEntityModal
          entityType="event"
          initialSeriesId={series!.id}
          initialPlaceId={series!.place_id ?? ""}
          onClose={() => setShowAddEdition(false)}
          onAdded={() => setShowAddEdition(false)}
        />
      )}
    </div>
  )
}
