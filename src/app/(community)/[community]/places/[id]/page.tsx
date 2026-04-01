"use client"

import { use, useState, useMemo, useRef } from "react"
import { Nav } from "@/components/ui/nav"
import { PLACES, eventSlug, placeSlug } from "@/lib/mock-data"
import { formatDateRange } from "@/lib/utils"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { CommunityLink } from "@/components/ui/community-link"
import { notFound } from "next/navigation"
import { useLineageStore, isAuthUser } from "@/store/lineage-store"
import { RiderAvatar } from "@/components/ui/rider-avatar"
import { ImageLightbox } from "@/components/ui/image-lightbox"
import { supabase } from "@/lib/supabase"
import { StoryCard } from "@/components/feed/story-card"
import { AddStoryModal } from "@/components/ui/add-story-modal"
import type { Story } from "@/types"

type PlaceTab = "all" | "riders" | "events" | "stories"

const EVENT_TYPE_ICON: Record<string, string> = {
  contest: "🏆",
  "film-shoot": "🎬",
  trip: "🏔",
  camp: "🏕",
  gathering: "📅",
}

const EVENT_TYPE_COLOR: Record<string, string> = {
  contest: "border-l-amber-700",
  "film-shoot": "border-l-violet-700",
  trip: "border-l-emerald-700",
  camp: "border-l-blue-700",
  gathering: "border-l-zinc-600",
}

export default function PlacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { catalog, userEntities, activePersonId } = useLineageStore()
  const isAuth = isAuthUser(activePersonId)
  // Catalog-first: Supabase catalog > user-created > mock-data fallback (deduped by id)
  const seen = new Set<string>()
  const allPlaces = [...catalog.places, ...userEntities.places, ...PLACES].filter((p) => {
    if (seen.has(p.id)) return false
    seen.add(p.id)
    return true
  })
  const place = allPlaces.find((p) => p.id === id || placeSlug(p) === id)
  if (!place) notFound()

  const [tab, setTab] = useState<PlaceTab>("all")

  // ── Photo state ────────────────────────────────────────────────────────────
  type VoteRow = { id: string; vote: string; user_id: string; suggested_image_url?: string | null }
  const [imageVoteRows, setImageVoteRows] = useState<VoteRow[]>([])
  const [imageVotes, setImageVotes] = useState<{ up: number; flag: number; userVote: "up" | "flag" | null; userVoteId: string | null }>({ up: 0, flag: 0, userVote: null, userVoteId: null })
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [showSuggestForm, setShowSuggestForm] = useState(false)
  const [suggestUrl, setSuggestUrl] = useState("")
  const [suggesting, setSuggesting] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [removingPhoto, setRemovingPhoto] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [placeStories, setPlaceStories] = useState<Story[]>([])
  const [addingStory, setAddingStory] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fetchedForPlace = useRef<string | null>(null)

  const suggestedImageUrl = imageVoteRows.find((r) => r.suggested_image_url)?.suggested_image_url ?? null
  const myImageVoteRow = imageVoteRows.find((r) => r.user_id === activePersonId && r.suggested_image_url)
  const displayImageUrl = suggestedImageUrl ?? place?.image_url ?? null

  const rideClaims = catalog.claims.filter((c) => c.object_id === place.id && c.predicate === "rode_at")
  const workClaims = catalog.claims.filter((c) => c.object_id === place.id && c.predicate === "worked_at")
  const placeEvents = catalog.events.filter((e) => e.place_id === place.id)

  const riderIds = [...new Set(rideClaims.map((c) => c.subject_id))]
  const staffIds = [...new Set(workClaims.map((c) => c.subject_id))]

  // Riders grouped by decade (for Riders tab)
  const byDecade = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const claim of rideClaims) {
      const year = claim.start_date ? parseInt(claim.start_date.slice(0, 4)) : 0
      const decade = year ? `${Math.floor(year / 10) * 10}s` : "Unknown"
      if (!map[decade]) map[decade] = []
      if (!map[decade].includes(claim.subject_id)) map[decade].push(claim.subject_id)
    }
    return map
  }, [rideClaims])

  // All tab: unified decade feed (riders + events mixed)
  const allDecadeGroups = useMemo(() => {
    type AllItem =
      | { kind: "rider"; year: number; riderId: string; claim: typeof rideClaims[0] }
      | { kind: "event"; year: number; event: typeof placeEvents[0] }

    const items: AllItem[] = []

    rideClaims.forEach((claim) => {
      const y = claim.start_date ? parseInt(claim.start_date.slice(0, 4)) : null
      if (y) items.push({ kind: "rider", year: y, riderId: claim.subject_id, claim })
    })
    placeEvents.forEach((event) => {
      if (event.year) items.push({ kind: "event", year: event.year, event })
    })

    const byDecadeMap = new Map<number, AllItem[]>()
    items.forEach((item) => {
      const decade = Math.floor(item.year / 10) * 10
      if (!byDecadeMap.has(decade)) byDecadeMap.set(decade, [])
      byDecadeMap.get(decade)!.push(item)
    })

    return [...byDecadeMap.entries()]
      .sort(([a], [b]) => b - a)
      .map(([decade, entries]) => ({
        label: `${decade}s`,
        entries: [...entries].sort((a, b) => b.year - a.year),
      }))
  }, [rideClaims, placeEvents])

  const tabs: { key: PlaceTab; label: string; count: number }[] = [
    { key: "all",     label: "All",     count: riderIds.length + placeEvents.length },
    { key: "riders",  label: "Riders",  count: riderIds.length },
    { key: "events",  label: "Events",  count: placeEvents.length },
    { key: "stories", label: "Stories", count: placeStories.length },
  ]

  const sortedDecades = Object.keys(byDecade).sort((a, b) => parseInt(b) - parseInt(a))

  // ── Photo useEffect + handlers (mirrors board page) ────────────────────────
  const placeId = place!.id

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useMemo(() => {
    if (fetchedForPlace.current === placeId) return
    fetchedForPlace.current = placeId
    supabase.from("place_image_votes").select("id, vote, user_id, suggested_image_url")
      .eq("place_id", placeId).order("created_at", { ascending: false })
      .then(({ data }) => {
        if (!data) return
        const rows = data as VoteRow[]
        const up = rows.filter((v) => v.vote === "up").length
        const flag = rows.filter((v) => v.vote === "flag").length
        const mine = rows.find((v) => v.user_id === activePersonId)
        setImageVotes({ up, flag, userVote: (mine?.vote as "up" | "flag") ?? null, userVoteId: mine?.id ?? null })
        setImageVoteRows(rows)
      })

    fetch(`/api/stories?place_id=${placeId}&limit=50`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setPlaceStories(data as Story[]) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeId])

  async function handleVote(vote: "up" | "flag") {
    if (!isAuth) return
    if (imageVotes.userVote === vote) {
      if (imageVotes.userVoteId) {
        await supabase.from("place_image_votes").delete().eq("id", imageVotes.userVoteId)
        setImageVotes((v) => ({ ...v, [vote]: v[vote] - 1, userVote: null, userVoteId: null }))
      }
      return
    }
    const prev = imageVotes.userVote
    const { data } = await supabase.from("place_image_votes").upsert(
      { place_id: placeId, user_id: activePersonId, vote },
      { onConflict: "place_id,user_id" }
    ).select("id").single()
    setImageVotes((v) => ({
      up:   vote === "up"   ? v.up + 1   : prev === "up"   ? v.up - 1   : v.up,
      flag: vote === "flag" ? v.flag + 1 : prev === "flag" ? v.flag - 1 : v.flag,
      userVote: vote,
      userVoteId: (data as { id: string } | null)?.id ?? v.userVoteId,
    }))
  }

  async function saveImageUrl(permanentUrl: string) {
    const { data, error } = await supabase.from("place_image_votes").upsert(
      { place_id: placeId, user_id: activePersonId, vote: "up", suggested_image_url: permanentUrl },
      { onConflict: "place_id,user_id" }
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
    const { error } = await supabase.from("place_image_votes")
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
      const res = await fetch("/api/places/archive-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: suggestUrl.trim(), place_id: placeId }),
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
      const path = `places/${placeId}/${activePersonId}-${Date.now()}.${ext}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("place-images").upload(path, file, { contentType: file.type, upsert: false })
      if (uploadError || !uploadData) throw new Error(uploadError?.message ?? "Upload failed")
      const { data: { publicUrl } } = supabase.storage.from("place-images").getPublicUrl(uploadData.path)
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
    <div className="min-h-screen bg-background">
      <Nav />

      {addingStory && (
        <AddStoryModal
          onClose={() => setAddingStory(false)}
          onSaved={(s) => { setPlaceStories((prev) => [s, ...prev]); setAddingStory(false) }}
          defaults={{ linkedPlaceId: place.id }}
        />
      )}

      {/* Image lightbox */}
      {lightboxOpen && displayImageUrl && (
        <ImageLightbox
          src={displayImageUrl}
          alt={place.name}
          onClose={() => setLightboxOpen(false)}
        />
      )}

      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Breadcrumb */}
        <div className="text-xs text-muted mb-6">
          <CommunityLink href="/places" className="hover:text-foreground transition-colors">Places</CommunityLink>
          <span className="mx-2">/</span>
          <span className="text-muted">{place.name}</span>
        </div>

        {/* Header */}
        <div className="bg-surface border border-border-default rounded-xl p-6 mb-6">
          <div className="flex items-start gap-5">
            {/* Photo thumbnail */}
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
                    alt={place.name}
                    className="w-full h-full object-cover bg-surface-hover transition-transform group-hover:scale-105"
                    onError={(e) => { (e.target as HTMLImageElement).closest("button")!.style.display = "none" }}
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-medium transition-opacity drop-shadow">⤢ enlarge</span>
                  </div>
                </button>
              ) : (
                <div className="w-24 h-24 rounded-lg bg-surface-hover border border-border-default flex items-center justify-center text-4xl">🏔</div>
              )}
              {/* Vote buttons */}
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
              {/* Remove my photo */}
              {isAuth && myImageVoteRow && (
                <div className="mt-1.5 flex justify-center">
                  <button
                    onClick={handleRemovePhoto}
                    disabled={removingPhoto}
                    title="Remove the photo you suggested"
                    className="text-[10px] text-muted hover:text-red-400 transition-colors disabled:opacity-50"
                  >
                    {removingPhoto ? "removing…" : "remove my photo"}
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-muted uppercase tracking-widest capitalize">{place.place_type}</span>
                {place.osm_id && <span className="text-[10px] text-muted font-mono">OSM ✓</span>}
              </div>
              <h1 className="text-2xl font-bold text-foreground">{place.name}</h1>
              {place.region && (
                <p className="text-muted mt-0.5 text-sm">{place.region}{place.country ? `, ${place.country}` : ""}</p>
              )}
              {place.description && (
                <p className="text-sm text-muted mt-3 leading-relaxed max-w-2xl">{place.description}</p>
              )}
              {place.website && (
                <a
                  href={place.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:text-blue-400 mt-2 inline-block transition-colors"
                >
                  {place.website.replace(/^https?:\/\//, "")} ↗
                </a>
              )}

              {/* Photo upload / URL suggestion */}
              {isAuth && (
                <div className="mt-3">
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
                      className="text-xs text-muted hover:text-foreground transition-colors"
                    >
                      {displayImageUrl ? "+ Update photo" : "+ Add a photo"}
                    </button>
                  ) : (
                    <div className="space-y-2 mt-1">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingPhoto || suggesting}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-dashed border-border-default text-xs text-muted hover:text-foreground hover:border-blue-600 disabled:opacity-50 transition-colors w-full justify-center"
                      >
                        {uploadingPhoto ? (
                          <span className="animate-pulse">Uploading…</span>
                        ) : (
                          <><span>📁</span> Upload a photo from your device</>
                        )}
                      </button>
                      <div className="flex items-center gap-2 text-[10px] text-muted">
                        <div className="flex-1 h-px bg-border-default" />
                        <span>or paste an image URL</span>
                        <div className="flex-1 h-px bg-border-default" />
                      </div>
                      <form onSubmit={handleSuggestImage} className="flex gap-2">
                        <input
                          value={suggestUrl}
                          onChange={(e) => setSuggestUrl(e.target.value)}
                          placeholder="https://…"
                          className="flex-1 bg-surface-hover border border-border-default rounded-lg px-3 py-1.5 text-xs text-foreground placeholder-zinc-600 outline-none focus:border-blue-600"
                        />
                        <button
                          type="submit"
                          disabled={suggesting || uploadingPhoto || !suggestUrl.trim()}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors"
                        >
                          {suggesting ? "Saving…" : "Save"}
                        </button>
                      </form>
                      {photoError && <p className="text-xs text-red-400">{photoError}</p>}
                      <button
                        type="button"
                        onClick={() => { setShowSuggestForm(false); setPhotoError(null) }}
                        className="text-xs text-muted hover:text-foreground transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-5 flex gap-6 text-sm flex-wrap">
            {riderIds.length > 0 && (
              <div>
                <div className="font-bold text-foreground text-xl">{riderIds.length}</div>
                <div className="text-muted text-xs">riders</div>
              </div>
            )}
            {placeEvents.length > 0 && (
              <>
                {riderIds.length > 0 && <div className="w-px bg-border-default" />}
                <div>
                  <div className="font-bold text-foreground text-xl">{placeEvents.length}</div>
                  <div className="text-muted text-xs">events</div>
                </div>
              </>
            )}
            {Object.keys(byDecade).length > 0 && (
              <>
                <div className="w-px bg-border-default" />
                <div>
                  <div className="font-bold text-foreground text-xl">{Object.keys(byDecade).length}</div>
                  <div className="text-muted text-xs">decades</div>
                </div>
              </>
            )}
            {place.first_snowboard_year && (
              <>
                <div className="w-px bg-border-default" />
                <div>
                  <div className="font-bold text-foreground text-xl">{place.first_snowboard_year}</div>
                  <div className="text-muted text-xs">first snowboard year</div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-surface border border-border-default rounded-lg p-1 mb-6 w-fit">
          {tabs.map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "px-4 py-1.5 rounded-md text-sm font-medium transition-all",
                tab === key
                  ? "bg-surface-active text-foreground"
                  : "text-muted hover:text-foreground"
              )}
            >
              {label}
              {count > 0 && (
                <span className={cn("ml-1.5 text-[11px]", tab === key ? "text-muted" : "text-muted")}>{count}</span>
              )}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-6">

          {/* Main feed */}
          <div>

            {/* ── All tab: unified calendar feed ── */}
            {tab === "all" && (
              <div className="space-y-8">
                {allDecadeGroups.length === 0 ? (
                  <div className="text-sm text-muted py-12 text-center border border-dashed border-border-default rounded-xl">
                    No riders or events documented yet for this place.
                  </div>
                ) : allDecadeGroups.map(({ label, entries }) => (
                  <div key={label}>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xs font-semibold text-muted uppercase tracking-widest shrink-0">{label}</span>
                      <div className="flex-1 h-px bg-surface-active" />
                    </div>
                    <div className="space-y-2">
                      {entries.map((item, i) => {
                        if (item.kind === "rider") {
                          const rider = catalog.people.find((p) => p.id === item.riderId)
                          if (!rider) return null
                          return (
                            <CommunityLink key={`rider-${item.riderId}-${i}`} href={`/riders/${item.riderId}`}>
                              <div className="flex items-center gap-3 px-4 py-3 bg-surface border border-border-default rounded-xl hover:border-border-default transition-all">
                                <RiderAvatar person={rider} size="md" ring={!!(rider.membership_tier && rider.membership_tier !== "free")} />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-foreground">{rider.display_name}</div>
                                  {(item.claim.start_date || item.claim.end_date) && (
                                    <div className="text-xs text-muted">{formatDateRange(item.claim.start_date, item.claim.end_date)}</div>
                                  )}
                                </div>
                                <span className="text-[10px] text-muted capitalize shrink-0">
                                  {item.claim.predicate.replace("_", " ")}
                                </span>
                              </div>
                            </CommunityLink>
                          )
                        }

                        if (item.kind === "event") {
                          const accent = EVENT_TYPE_COLOR[item.event.event_type] ?? "border-l-zinc-600"
                          const icon = EVENT_TYPE_ICON[item.event.event_type] ?? "📅"
                          return (
                            <CommunityLink key={`event-${item.event.id}`} href={`/events/${eventSlug(item.event)}`}>
                              <div className={cn(
                                "flex items-center gap-3 px-4 py-3 bg-surface border border-border-default border-l-2 rounded-xl hover:border-border-default transition-all group",
                                accent
                              )}>
                                <div className="shrink-0 w-8 h-8 rounded-lg bg-surface-hover border border-border-default flex items-center justify-center text-sm">
                                  {icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-foreground group-hover:text-blue-300 transition-colors">{item.event.name}</div>
                                  <div className="text-xs text-muted capitalize">{item.event.event_type.replace("-", " ")}</div>
                                </div>
                                <span className="text-xs text-muted shrink-0">{item.event.year}</span>
                              </div>
                            </CommunityLink>
                          )
                        }

                        return null
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Riders tab ── */}
            {tab === "riders" && (
              <div className="space-y-8">
                {riderIds.length === 0 ? (
                  <div className="text-sm text-muted py-12 text-center border border-dashed border-border-default rounded-xl">
                    No riders documented yet for this place.
                  </div>
                ) : sortedDecades.map((decade) => (
                  <div key={decade}>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xs font-semibold text-muted uppercase tracking-widest shrink-0">{decade}</span>
                      <div className="flex-1 h-px bg-surface-active" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {byDecade[decade].map((riderId) => {
                        const rider = catalog.people.find((p) => p.id === riderId)
                        if (!rider) return null
                        const claim = rideClaims.find((c) => c.subject_id === riderId)
                        return (
                          <CommunityLink key={riderId} href={`/riders/${riderId}`}>
                            <div className="flex items-center gap-2 p-2.5 bg-surface border border-border-default rounded-lg hover:border-border-default transition-all">
                              <RiderAvatar person={rider} size="sm" />
                              <div className="min-w-0">
                                <div className="text-xs font-medium text-foreground truncate">{rider.display_name}</div>
                                {claim?.start_date && (
                                  <div className="text-[10px] text-muted">{formatDateRange(claim.start_date, claim.end_date)}</div>
                                )}
                              </div>
                            </div>
                          </CommunityLink>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Events tab ── */}
            {tab === "events" && (
              <div className="space-y-2">
                {placeEvents.length === 0 ? (
                  <div className="text-sm text-muted py-12 text-center border border-dashed border-border-default rounded-xl">
                    No events documented at this place yet.
                  </div>
                ) : [...placeEvents].sort((a, b) => (b.year ?? 0) - (a.year ?? 0)).map((event) => {
                  const accent = EVENT_TYPE_COLOR[event.event_type] ?? "border-l-zinc-600"
                  const icon = EVENT_TYPE_ICON[event.event_type] ?? "📅"
                  return (
                    <CommunityLink key={event.id} href={`/events/${eventSlug(event)}`}>
                      <div className={cn(
                        "flex items-center gap-4 px-4 py-3.5 bg-surface border border-border-default border-l-2 rounded-xl hover:border-border-default transition-all group",
                        accent
                      )}>
                        <div className="shrink-0 w-9 h-9 rounded-lg bg-surface-hover border border-border-default flex items-center justify-center text-base">
                          {icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground group-hover:text-blue-300 transition-colors">{event.name}</div>
                          <div className="text-xs text-muted capitalize mt-0.5">{event.event_type.replace("-", " ")}</div>
                        </div>
                        <span className="text-sm text-muted shrink-0">{event.year}</span>
                      </div>
                    </CommunityLink>
                  )
                })}
              </div>
            )}

            {/* ── Stories tab ── */}
            {tab === "stories" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-semibold text-muted uppercase tracking-widest">Stories</h2>
                  {isAuth && (
                    <button onClick={() => setAddingStory(true)} className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
                      ✍ Add a story
                    </button>
                  )}
                </div>
                {placeStories.length === 0 ? (
                  <div className="py-10 text-center border border-dashed border-border-default rounded-xl">
                    <div className="text-sm text-muted mb-1">No stories yet for this place.</div>
                    {isAuth
                      ? <button onClick={() => setAddingStory(true)} className="text-xs text-violet-400 hover:text-violet-300 transition-colors">Share the first one →</button>
                      : <div className="text-xs text-muted"><Link href="/auth/signin" className="text-blue-400 hover:text-blue-300">Sign in</Link> to share your story</div>
                    }
                  </div>
                ) : (
                  placeStories.map((s) => (
                    <StoryCard
                      key={s.id}
                      story={s}
                      isOwn={s.author_id === activePersonId}
                      onDelete={(sid) => setPlaceStories((prev) => prev.filter((x) => x.id !== sid))}
                    />
                  ))
                )}
              </div>
            )}

          </div>

          {/* Sidebar */}
          <div className="space-y-4">

            {/* About */}
            {(place.first_snowboard_year || place.website || place.wikidata_qid || place.osm_id) && (
              <div className="bg-surface border border-border-default rounded-xl p-4">
                <div className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">About</div>
                <div className="space-y-2 text-sm">
                  {place.first_snowboard_year && (
                    <div className="flex justify-between">
                      <span className="text-muted">Snowboards since</span>
                      <span className="text-muted">{place.first_snowboard_year}</span>
                    </div>
                  )}
                  {place.region && (
                    <div className="flex justify-between">
                      <span className="text-muted">Region</span>
                      <span className="text-muted">{place.region}</span>
                    </div>
                  )}
                  {place.country && (
                    <div className="flex justify-between">
                      <span className="text-muted">Country</span>
                      <span className="text-muted">{place.country}</span>
                    </div>
                  )}
                  {place.website && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted">Website</span>
                      <a
                        href={place.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:text-blue-400 text-xs transition-colors"
                      >
                        {place.website.replace(/^https?:\/\//, "").replace(/\/$/, "")} ↗
                      </a>
                    </div>
                  )}
                  {place.osm_id && (
                    <div className="flex justify-between">
                      <span className="text-muted">OSM</span>
                      <span className="font-mono text-muted text-xs">{place.osm_id}</span>
                    </div>
                  )}
                  {place.wikidata_qid && (
                    <div className="flex justify-between">
                      <span className="text-muted">Wikidata</span>
                      <span className="font-mono text-muted text-xs">{place.wikidata_qid}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Staff */}
            {staffIds.length > 0 && (
              <div className="bg-surface border border-border-default rounded-xl p-4">
                <div className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">People who worked here</div>
                {staffIds.map((sid) => {
                  const person = catalog.people.find((p) => p.id === sid)
                  if (!person) return null
                  const claim = workClaims.find((c) => c.subject_id === sid)
                  return (
                    <CommunityLink key={sid} href={`/riders/${sid}`}>
                      <div className="flex items-center gap-2 py-2 hover:text-blue-300 transition-colors">
                        <RiderAvatar person={person} size="sm" />
                        <div>
                          <div className="text-xs text-foreground">{person.display_name}</div>
                          {claim && <div className="text-[10px] text-muted">{formatDateRange(claim.start_date, claim.end_date)}</div>}
                        </div>
                      </div>
                    </CommunityLink>
                  )
                })}
              </div>
            )}

            {/* Add claim CTA */}
            <div className="bg-bg-nav border border-border-default rounded-xl p-4">
              <div className="text-xs font-semibold text-muted uppercase tracking-widest mb-2">Add a claim</div>
              <p className="text-xs text-muted mb-3">Did you ride here? Work here? Compete here?</p>
              <CommunityLink href="/profile">
                <button className="w-full px-3 py-2 bg-blue-600 rounded-lg text-xs text-foreground font-medium hover:bg-blue-500 transition-colors">
                  + Add to my profile
                </button>
              </CommunityLink>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
