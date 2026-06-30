"use client"

import { useState, useEffect, useRef, use, useMemo } from "react"
import { CommunityLink } from "@/components/ui/community-link"
import { notFound, useRouter } from "next/navigation"
import { CatalogGate } from "@/components/ui/catalog-gate"
import { Nav } from "@/components/ui/nav"
import { boardSlug, orgSlug, eventSlug, seriesSlug } from "@/lib/mock-data"
import { formatDateRange } from "@/lib/utils"
import { cn, resolveBrandColor, brandButtonColor } from "@/lib/utils"
import { signInHref } from "@/lib/safe-redirect"
import { useLineageStore, isAuthUser } from "@/store/lineage-store"
import { usePersonHref } from "@/lib/use-person-href"
import { useCanonicalPath } from "@/lib/use-canonical-path"
import { RiderAvatar } from "@/components/ui/rider-avatar"
import { StoryCard } from "@/components/feed/story-card"
import { AddStoryModal } from "@/components/ui/add-story-modal"
import { ShowModule } from "@/components/orgs/show-module"
import type { Org, ConfidenceLevel, Predicate, Event, Place, Story, Person } from "@/types"

// ─── Label maps ───────────────────────────────────────────────────────────────

const BRAND_CAT_LABEL: Record<string, string> = {
  board_brand: "Board Brand",
  outerwear: "Apparel & Outerwear",
  bindings: "Bindings",
  boots: "Boots",
  retailer: "Retailer",
  media: "Media",
  other: "Other",
}

const ORG_TYPE_LABEL: Record<string, string> = {
  brand: "Brand",
  shop: "Shop",
  team: "Team / Collective",
  magazine: "Media / Magazine",
  "event-series": "Event Series",
  media: "Show / Media",
}

const PEOPLE_PREDICATES: { value: Predicate; label: string; desc: string }[] = [
  { value: "sponsored_by",  label: "Sponsored rider",   desc: "This person was on the brand's team/sponsorship" },
  { value: "worked_at",     label: "Staff / worked at", desc: "Worked for this brand in any capacity" },
  { value: "part_of_team",  label: "Team member",       desc: "Rider team, club, or collective member" },
]

const EVENT_PREDICATES: { value: Predicate; label: string; desc: string }[] = [
  { value: "organized",     label: "Organized event",   desc: "This brand hosted or organized this event" },
]

const PLACE_PREDICATES: { value: Predicate; label: string; desc: string }[] = [
  { value: "located_at",   label: "Store / location",  desc: "This brand had a store or office at this location" },
]

const inputCls =
  "w-full bg-background border border-border-default rounded-lg px-3 py-2.5 text-sm text-foreground placeholder-zinc-600 focus:outline-none focus:border-blue-500"

// ─── Add Claim Modal ───────────────────────────────────────────────────────────

type ClaimMode = "person" | "event" | "place"

function AddBrandClaimModal({ org, onClose, initial }: { org: Org; onClose: () => void; initial?: { mode?: ClaimMode; predicate?: Predicate } }) {
  const { addClaim, activePersonId, catalog, userEntities } = useLineageStore()
  const allPeople = [...catalog.people, ...(userEntities.people ?? [])]

  const [mode, setMode] = useState<ClaimMode>(initial?.mode ?? "person")
  const [predicate, setPredicate] = useState<Predicate>(initial?.predicate ?? "sponsored_by")
  const [personId, setPersonId] = useState(activePersonId ?? "")
  const [eventId, setEventId] = useState("")
  const [placeId, setPlaceId] = useState("")
  const [startYear, setStartYear] = useState("")
  const [endYear, setEndYear] = useState("")
  const [note, setNote] = useState("")
  const [confidence, setConfidence] = useState<ConfidenceLevel>("self-reported")
  const [submitted, setSubmitted] = useState(false)

  const handleModeChange = (m: ClaimMode) => {
    setMode(m)
    if (m === "person") setPredicate("sponsored_by")
    if (m === "event") setPredicate("organized")
    if (m === "place") setPredicate("located_at")
  }

  const entitySelected = mode === "person" ? personId.length > 0
                       : mode === "event" ? eventId.length > 0
                       : placeId.length > 0

  const canSubmit = entitySelected && startYear.length === 4

  const handleSubmit = () => {
    if (!canSubmit) return

    // People predicates: org is OBJECT (person → org)
    // Event/place predicates: org is SUBJECT (org → event/place)
    const isPeopleMode = mode === "person"

    addClaim({
      id: `brand-claim-${Date.now()}`,
      subject_id: isPeopleMode ? personId : org.id,
      subject_type: isPeopleMode ? "person" : "org",
      predicate,
      object_id: isPeopleMode ? org.id : mode === "event" ? eventId : placeId,
      object_type: isPeopleMode ? "org" : mode === "event" ? "event" : "place",
      start_date: `${startYear}-01-01`,
      end_date: endYear.length === 4 ? `${endYear}-01-01` : undefined,
      confidence,
      visibility: "public",
      asserted_by: activePersonId ?? "anon",
      created_at: new Date().toISOString(),
      note: note.trim() || undefined,
    })
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={onClose}>
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative w-full max-w-md bg-surface border border-border-default rounded-2xl p-8 shadow-2xl text-center">
          <div className="text-3xl mb-3">✓</div>
          <div className="text-foreground font-semibold text-lg mb-1">Claim added</div>
          <p className="text-muted text-sm mb-5">
            This claim is unverified and visible to the community. It can be corroborated or challenged by others.
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-surface-active border border-border-default rounded-lg text-sm text-foreground hover:bg-border-default transition-all"
          >
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative w-full max-w-md bg-surface border border-border-default rounded-2xl p-6 shadow-2xl">
        <div className="mb-5">
          <div className="text-lg font-semibold text-foreground mb-1">Add a claim</div>
          <p className="text-xs text-muted">
            Connect something to <span className="text-muted">{org.name}</span>.
            Unverified claims are visible to the community.
          </p>
        </div>

        <div className="space-y-4">
          {/* Mode selector */}
          <div>
            <label className="block text-xs text-muted mb-2">What are you connecting?</label>
            <div className="flex gap-2">
              {([
                { key: "person" as ClaimMode, label: "A rider" },
                { key: "event" as ClaimMode, label: "An event" },
                { key: "place" as ClaimMode, label: "A location" },
              ]).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => handleModeChange(key)}
                  className={cn(
                    "flex-1 px-3 py-2 rounded-lg border text-xs transition-all",
                    mode === key
                      ? "border-blue-500 bg-blue-950/40 text-blue-200"
                      : "border-border-default text-muted hover:border-border-default hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Predicate (only shown when mode has multiple options) */}
          {mode === "person" && (
            <div>
              <label className="block text-xs text-muted mb-2">Relationship</label>
              <div className="space-y-1.5">
                {PEOPLE_PREDICATES.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setPredicate(opt.value)}
                    className={cn(
                      "w-full text-left px-3 py-2.5 rounded-lg border text-xs transition-all",
                      predicate === opt.value
                        ? "border-blue-500 bg-blue-950/40 text-blue-200"
                        : "border-border-default text-muted hover:border-border-default hover:text-foreground"
                    )}
                  >
                    <div className="font-medium">{opt.label}</div>
                    <div className="text-[10px] opacity-70 mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Entity picker */}
          {mode === "person" && (
            <div>
              <label className="block text-xs text-muted mb-1.5">Who is this about?</label>
              <select
                value={personId}
                onChange={(e) => setPersonId(e.target.value)}
                className={cn(inputCls, "appearance-none")}
              >
                <option value="">Select a rider…</option>
                {allPeople.map((p) => (
                  <option key={p.id} value={p.id}>{p.display_name}</option>
                ))}
              </select>
            </div>
          )}

          {mode === "event" && (
            <div>
              <label className="block text-xs text-muted mb-1.5">Which event?</label>
              <select
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                className={cn(inputCls, "appearance-none")}
              >
                <option value="">Select an event…</option>
                {catalog.events.map((ev) => (
                  <option key={ev.id} value={ev.id}>{ev.name}</option>
                ))}
              </select>
            </div>
          )}

          {mode === "place" && (
            <div>
              <label className="block text-xs text-muted mb-1.5">Which location?</label>
              <select
                value={placeId}
                onChange={(e) => setPlaceId(e.target.value)}
                className={cn(inputCls, "appearance-none")}
              >
                <option value="">Select a place…</option>
                {catalog.places.map((pl) => (
                  <option key={pl.id} value={pl.id}>{pl.name}{pl.region ? ` — ${pl.region}` : ""}</option>
                ))}
              </select>
            </div>
          )}

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1.5">
                {mode === "event" ? "Year" : "Start year"}
              </label>
              <input
                type="number"
                value={startYear}
                onChange={(e) => setStartYear(e.target.value)}
                placeholder="e.g. 2003"
                min={1960}
                max={2030}
                className={inputCls}
              />
            </div>
            {mode !== "event" && (
              <div>
                <label className="block text-xs text-muted mb-1.5">End year <span className="text-muted">(optional)</span></label>
                <input
                  type="number"
                  value={endYear}
                  onChange={(e) => setEndYear(e.target.value)}
                  placeholder="present"
                  min={1960}
                  max={2030}
                  className={inputCls}
                />
              </div>
            )}
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs text-muted mb-1.5">Note <span className="text-muted">(optional)</span></label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Any context about this connection…"
              rows={2}
              className={cn(inputCls, "resize-none")}
            />
          </div>

          {/* Confidence */}
          <div>
            <label className="block text-xs text-muted mb-2">How sure are you?</label>
            <div className="flex gap-2">
              {(["self-reported", "corroborated", "documented"] as ConfidenceLevel[]).map((c) => (
                <button
                  key={c}
                  onClick={() => setConfidence(c)}
                  className={cn(
                    "flex-1 px-2 py-2 rounded-lg border text-[11px] transition-all capitalize",
                    confidence === c
                      ? "border-blue-500 bg-blue-950/40 text-blue-200"
                      : "border-border-default text-muted hover:border-border-default"
                  )}
                >
                  {c.replace("-", " ")}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm text-muted hover:text-foreground border border-border-default hover:border-border-default transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={cn(
              "flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
              canSubmit
                ? "bg-[#1C1917] text-white hover:bg-[#292524]"
                : "bg-surface-active text-muted cursor-not-allowed"
            )}
          >
            Add claim
          </button>
        </div>

        <p className="text-[10px] text-muted mt-3 text-center">
          Claims are unverified until corroborated. Anyone can add or dispute them.
        </p>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const PREDICATE_LABEL: Record<string, string> = {
  sponsored_by: "Sponsored",
  worked_at: "Worked at",
  part_of_team: "Team member",
}

const CONFIDENCE_COLORS: Record<string, string> = {
  "self-reported": "text-muted",
  "corroborated":  "text-blue-500",
  "documented":    "text-emerald-500",
  "partner-verified": "text-violet-400",
}

const EVENT_TYPE_COLOR: Record<string, string> = {
  contest: "border-l-amber-700",
  "film-shoot": "border-l-violet-700",
  trip: "border-l-rose-700",
  camp: "border-l-emerald-700",
  gathering: "border-l-cyan-700",
}

type FeedTab = "all" | "people" | "boards" | "events" | "places" | "stories"

export default function BrandPage(props: { params: Promise<{ community: string; slug: string }> }) {
  // Gate on catalogLoaded so a fresh load renders a loader (HTTP 200) instead of
  // 404ing before the client catalog hydrates (BUG-001 detail-page fix).
  return (
    <CatalogGate>
      <BrandPageInner {...props} />
    </CatalogGate>
  )
}

function BrandPageInner({ params }: { params: Promise<{ community: string; slug: string }> }) {
  const { community, slug } = use(params)
  const { catalog, sessionClaims, dbClaims, userEntities, activePersonId, membership } = useLineageStore()
  const isEditor = membership.is_editor || membership.tier === "founding"
  const personLink = usePersonHref()
  const router = useRouter()
  const isAuth = isAuthUser(activePersonId)
  const allOrgs = [...catalog.orgs, ...userEntities.orgs]
  const allPeople = [...catalog.people, ...(userEntities.people ?? [])]
  // Case-insensitive slug match (BUG-083). orgSlug() is case-preserving (e.g.
  // "Linestry.com" -> "Linestry_com"), so the canonical app link resolves, but a
  // lowercased, shared, or legacy URL ("linestry_com") would 404. Match on a
  // lowercased compare; useCanonicalPath below rewrites the bar to the canonical
  // slug once resolved, so the address still settles on the correct casing.
  const slugLower = slug.toLowerCase()
  const org = allOrgs.find((o) => o.id === slug || orgSlug(o).toLowerCase() === slugLower)
  useCanonicalPath(org ? `/${community}/brands/${orgSlug(org)}` : null)
  if (!org) notFound()

  const storeClaims = [...sessionClaims, ...dbClaims]
  const [addOpen, setAddOpen] = useState(false)
  const [addingStory, setAddingStory] = useState(false)
  // Stories are the richest, most human content on a brand page, so the feed
  // opens on Stories; the unified "All" decade feed is one tab away.
  const [tab, setTab] = useState<FeedTab>("stories")
  // Curated contribute-module chips can preselect a claim mode/predicate.
  const [claimPreset, setClaimPreset] = useState<{ mode: ClaimMode; predicate: Predicate } | undefined>(undefined)
  const openClaim = (preset?: { mode: ClaimMode; predicate: Predicate }) => { setClaimPreset(preset); setAddOpen(true) }

  // Brand accent + primary-CTA wiring. brand_color drives the accent bar and the
  // brand-filled buttons; null falls back to the Linestry accent. ctaColor keeps
  // white text legible (falls back to the accent on a too-light brand color).
  // Contribute a story is the primary action: members open the story composer
  // (brand pre-linked), signed-out visitors route to sign in and back.
  const brandColor = resolveBrandColor(org.brand_color)
  const ctaColor = brandButtonColor(org.brand_color)
  const handleContribute = () => {
    if (isAuth) { setAddingStory(true); return }
    router.push(signInHref(`/${community}/brands/${orgSlug(org)}`))
  }

  // Stories linked to this org
  const [orgStories, setOrgStories] = useState<Story[]>([])
  const storiesFetchedRef = useRef(false)
  useEffect(() => {
    if (storiesFetchedRef.current) return
    storiesFetchedRef.current = true
    fetch(`/api/stories?org_id=${org.id}&limit=50`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setOrgStories(data as Story[]) })
  }, [org.id])

  // All claims in catalog + session store
  const allClaims = [...catalog.claims, ...storeClaims]

  // People claims — org is OBJECT
  const brandClaims  = allClaims.filter((c) => c.object_id === org.id && c.object_type === "org")
  const sponsorClaims = brandClaims.filter((c) => c.predicate === "sponsored_by")
  const workClaims    = brandClaims.filter((c) => c.predicate === "worked_at")
  const teamClaims    = brandClaims.filter((c) => c.predicate === "part_of_team")
  const peopleClaims  = [...sponsorClaims, ...workClaims, ...teamClaims]

  // Event + place claims — org is SUBJECT
  const organizedClaims = allClaims.filter((c) => c.subject_id === org.id && c.predicate === "organized")
  const locatedAtClaims = allClaims.filter((c) => c.subject_id === org.id && c.predicate === "located_at")

  // Events and series directly linked via brand_ids junction
  const brandEvents = catalog.events.filter((e) => e.brand_ids?.includes(org.id))
  const brandSeries = catalog.eventSeries.filter((s) => s.brand_ids?.includes(org.id))
  // Deduplicate: events already linked via organized claims
  const organizedEventIds = new Set(organizedClaims.map((c) => c.object_id))
  const extraBrandEvents = brandEvents.filter((e) => !organizedEventIds.has(e.id))

  const uniqueRiderIds = [...new Set(peopleClaims.map((c) => c.subject_id))]

  // Boards by this brand
  const orgFirstWord = org.name.split(" ")[0].toLowerCase()
  const orgBoards = catalog.boards.filter(
    (b) =>
      b.brand.toLowerCase() === org.name.toLowerCase() ||
      b.brand.toLowerCase() === orgFirstWord
  )
  const boardOwnerClaims = allClaims.filter(
    (c) => c.predicate === "owned_board" && orgBoards.some((b) => b.id === c.object_id)
  )

  // ── All tab: unified calendar feed grouped by decade ─────────────────────
  type AllItem =
    | { kind: "person"; year: number; claim: typeof peopleClaims[0] }
    | { kind: "board";  year: number; board: typeof orgBoards[0] }
    | { kind: "event";  year: number; claim?: typeof organizedClaims[0]; event: Event }
    | { kind: "place";  year: number; claim: typeof locatedAtClaims[0]; place: Place }
    | { kind: "series"; year: number; series: typeof brandSeries[0] }
    | { kind: "story";  year: number; story: Story }

  const decadeGroups = useMemo(() => {
    const items: AllItem[] = []

    peopleClaims.forEach((claim) => {
      const y = claim.start_date ? parseInt(claim.start_date.slice(0, 4)) : null
      if (y) items.push({ kind: "person", year: y, claim })
    })
    orgBoards.forEach((board) => {
      items.push({ kind: "board", year: board.model_year, board })
    })
    organizedClaims.forEach((claim) => {
      const event = catalog.events.find((e) => e.id === claim.object_id)
      if (!event?.year) return
      items.push({ kind: "event", year: event.year, claim, event })
    })
    // Brand-linked events (not already in organized claims)
    extraBrandEvents.forEach((event) => {
      if (!event.year) return
      items.push({ kind: "event", year: event.year, event })
    })
    // Brand-linked series
    brandSeries.forEach((series) => {
      const y = series.start_year
      if (y) items.push({ kind: "series", year: y, series })
    })
    locatedAtClaims.forEach((claim) => {
      const place = catalog.places.find((p) => p.id === claim.object_id)
      if (!place) return
      const y = claim.start_date ? parseInt(claim.start_date.slice(0, 4)) : null
      if (y) items.push({ kind: "place", year: y, claim, place })
    })
    // Stories linked to this brand
    orgStories.forEach((story) => {
      const y = story.story_date ? parseInt(story.story_date.slice(0, 4)) : null
      if (y) items.push({ kind: "story", year: y, story })
    })

    const byDecade = new Map<number, AllItem[]>()
    items.forEach((item) => {
      const decade = Math.floor(item.year / 10) * 10
      if (!byDecade.has(decade)) byDecade.set(decade, [])
      byDecade.get(decade)!.push(item)
    })

    return [...byDecade.entries()]
      .sort(([a], [b]) => b - a)
      .map(([decade, entries]) => ({
        label: `${decade}s`,
        entries: [...entries].sort((a, b) => b.year - a.year),
      }))
  }, [peopleClaims, orgBoards, organizedClaims, extraBrandEvents, brandSeries, locatedAtClaims, orgStories])

  // Events tab: organized claims + brand-linked events merged into one list,
  // sorted chronologically ascending by event year (BUG-094). Events without a
  // usable year sort last so the dated run stays fully ordered.
  const sortedBrandEvents = useMemo(() => {
    const entries: { event: Event; claim?: typeof organizedClaims[0] }[] = []
    organizedClaims.forEach((claim) => {
      const event = catalog.events.find((e) => e.id === claim.object_id)
      if (event) entries.push({ event, claim })
    })
    extraBrandEvents.forEach((event) => entries.push({ event }))
    return entries.sort((a, b) => (a.event.year ?? Infinity) - (b.event.year ?? Infinity))
  }, [organizedClaims, extraBrandEvents, catalog.events])

  const typeLabel = org.brand_category
    ? BRAND_CAT_LABEL[org.brand_category]
    : ORG_TYPE_LABEL[org.org_type]

  const initials = org.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()

  const totalEvents = organizedClaims.length + extraBrandEvents.length + brandSeries.length
  const hasNoContent = peopleClaims.length === 0 && orgBoards.length === 0 && totalEvents === 0 && locatedAtClaims.length === 0 && orgStories.length === 0

  const tabs: { key: FeedTab; label: string; count?: number }[] = [
    { key: "all", label: "All" },
    { key: "people", label: "Riders", count: uniqueRiderIds.length },
    { key: "boards", label: "Boards", count: orgBoards.length },
    { key: "events", label: "Events", count: totalEvents },
    { key: "places", label: "Places", count: locatedAtClaims.length },
    { key: "stories", label: "Stories", count: orgStories.length },
  ]

  // ── Curated / partner layer (Phase 2, gated by curation_tier) ──────────────
  const isCurated = org.curation_tier === "curated" || org.curation_tier === "founding"
  const isFounding = org.curation_tier === "founding"
  // Validate the editor-authored jsonb defensively; render in stored (editor) order.
  const milestones = Array.isArray(org.brand_milestones)
    ? org.brand_milestones.filter((m) => !!m && typeof m.label === "string" && m.label.trim().length > 0)
    : []
  const media = Array.isArray(org.brand_media)
    ? org.brand_media.filter((m) => !!m && (!!m.title || !!m.image_url))
    : []
  const brandLinks = Array.isArray(org.brand_links)
    ? org.brand_links.filter((l) => !!l && typeof l.url === "string" && l.url.trim().length > 0)
    : []
  // Featured riders: resolve ids to catalog people; skip unresolved or private
  // profiles (visibility-safe, do not error). Owner-ordered.
  const featuredRiders = (org.featured_rider_ids ?? [])
    .map((rid) => allPeople.find((p) => p.id === rid))
    .filter((p): p is Person => !!p && p.privacy_level !== "private")

  // Shared CTA buttons + stat blocks, reused by the standard header card and the
  // curated under-hero strip so the two tiers never drift.
  const ctaButtons = (
    <>
      <button
        onClick={handleContribute}
        style={{ background: ctaColor, borderColor: ctaColor }}
        className="px-4 py-2.5 rounded-lg text-sm font-medium text-white border inline-flex items-center gap-1.5 hover:opacity-90 transition-opacity"
      >
        <span aria-hidden>✎</span> Contribute a story
      </button>
      <button
        onClick={() => openClaim()}
        className="px-4 py-2.5 rounded-lg text-sm font-medium text-foreground border border-border-default bg-background hover:bg-surface-hover transition-colors"
      >
        + Add a claim
      </button>
      {org.website && (
        <a
          href={org.website}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2.5 rounded-lg text-sm font-medium text-foreground border border-border-default bg-background hover:bg-surface-hover transition-colors inline-flex items-center gap-1.5"
        >
          <span aria-hidden>↗</span> Visit website
        </a>
      )}
    </>
  )

  // Connected-rider headline counts both claim-connected riders and curated team
  // members (featured_rider_ids), so a curated team member who lacks a claim still
  // counts. For standard brands featuredRiders is empty, so this equals the claim set.
  const connectedRiderCount = new Set([...uniqueRiderIds, ...featuredRiders.map((p) => p.id)]).size

  const statBlocks = [
    { n: connectedRiderCount, l: "riders" },
    { n: orgBoards.length, l: "boards" },
    { n: totalEvents, l: "events" },
    { n: locatedAtClaims.length, l: "places" },
    { n: orgStories.length, l: "stories" },
  ].map(({ n, l }) => (
    <div key={l}>
      <div className="text-foreground text-xl leading-none" style={{ fontFamily: "var(--font-wordmark)" }}>{n}</div>
      <div className="text-muted text-[11px] mt-1.5">{l}</div>
    </div>
  ))

  // FNRad: a media-company org (e.g. a podcast show) renders the FULL brand page
  // (stories + connections + feed) PLUS a Show block on top (episodes + canon +
  // publish), injected below the header. No early return, so nothing on the
  // brand page is lost.

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Breadcrumb */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="text-xs text-muted">
            <CommunityLink href="/brands" className="hover:text-foreground transition-colors">Brands</CommunityLink>
            <span className="mx-2">/</span>
            <span className="text-muted">{org.name}</span>
          </div>
          {isEditor && (
            <a
              href={`/admin/brand/${orgSlug(org)}`}
              className="shrink-0 text-xs text-accent-strong hover:opacity-80 transition-opacity"
            >
              ⚙ Manage page
            </a>
          )}
        </div>

        {/* ── Header: curated hero (partner pages) or standard card (every brand) ── */}
        {isCurated ? (
          <>
            {/* Curated hero banner */}
            <div className="relative rounded-2xl overflow-hidden border border-border-default mb-3.5">
              <div
                className="relative h-[260px] sm:h-[300px]"
                style={org.banner_url ? undefined : {
                  background: `radial-gradient(120% 140% at 80% 10%, ${brandColor}8c, transparent 55%), radial-gradient(90% 120% at 10% 90%, rgba(20,17,15,.92), rgba(20,17,15,.45) 60%), linear-gradient(135deg, #2a211d 0%, #171311 60%, #0e0c0b 100%)`,
                }}
              >
                {org.banner_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={org.banner_url} alt={`${org.name} banner`} className="absolute inset-0 w-full h-full object-cover" />
                )}
                <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,.07) 1px, transparent 1px)", backgroundSize: "7px 7px", mixBlendMode: "overlay" }} />
                <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6 flex items-end gap-4" style={{ background: "linear-gradient(to top, rgba(10,8,7,.85), transparent)" }}>
                  <div
                    className="w-[68px] h-[68px] sm:w-[78px] sm:h-[78px] rounded-2xl shrink-0 flex items-center justify-center overflow-hidden"
                    style={{ background: "#0c0a09", border: "1px solid rgba(255,255,255,.14)", boxShadow: "0 8px 24px rgba(0,0,0,.4)" }}
                  >
                    {org.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={org.logo_url} alt={org.name} className="w-full h-full object-contain p-2" />
                    ) : (
                      <span className="text-sm" style={{ fontFamily: "var(--font-wordmark)", color: "#fff", letterSpacing: ".04em" }}>{initials}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-white">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5 text-[11px]">
                      {isFounding && org.partner_label && (
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold text-white" style={{ background: ctaColor }}>
                          ★ {org.partner_label}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium text-white" style={{ background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.18)" }}>
                        ✓ Curated
                      </span>
                      <span className="text-white/75">
                        {[typeLabel, org.founded_year ? `est. ${org.founded_year}` : null, org.country].filter(Boolean).join("  ·  ")}
                      </span>
                    </div>
                    <h1 className="text-3xl sm:text-4xl leading-none" style={{ fontFamily: "var(--font-wordmark)", color: "#fff" }}>{org.name}</h1>
                  </div>
                </div>
              </div>
            </div>

            {/* CTA + stats sit directly under the hero (no header card) */}
            <div className="mb-6">
              <div className="flex flex-wrap gap-2.5">{ctaButtons}</div>
              <div className="mt-4 flex gap-7 flex-wrap">{statBlocks}</div>
            </div>
          </>
        ) : (
          <>
            {/* Standard header card */}
            <div className="bg-surface border border-border-default rounded-xl overflow-hidden mb-4">
              {/* 5px brand-color accent bar (brand_color, fallback --accent) */}
              <div style={{ height: 5, background: brandColor }} />
              <div className="p-6">
                <div className="flex items-start gap-5">
                  {/* Logo (logo_url) or initials block */}
                  {org.logo_url ? (
                    <div className="w-16 h-16 rounded-xl shrink-0 overflow-hidden bg-white border border-border-default flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={org.logo_url} alt={org.name} className="w-full h-full object-contain p-1.5" />
                    </div>
                  ) : (
                    <div
                      className="w-16 h-16 rounded-xl shrink-0 flex items-center justify-center text-xl overflow-hidden"
                      style={{
                        background: "linear-gradient(145deg, #1c1c1f 0%, #111113 100%)",
                        border: "1px solid rgba(161,161,170,0.12)",
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                      }}
                    >
                      <span style={{ fontFamily: "var(--font-wordmark)", color: "#fff", letterSpacing: ".03em" }}>
                        {initials}
                      </span>
                    </div>
                  )}

                  {/* Name + meta */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-muted uppercase tracking-wider font-medium mb-1">
                      {[typeLabel, org.founded_year ? `est. ${org.founded_year}` : null, org.country]
                        .filter(Boolean)
                        .join("  ·  ")}
                    </div>
                    <h1
                      className="text-2xl sm:text-3xl text-foreground leading-tight"
                      style={{ fontFamily: "var(--font-wordmark)" }}
                    >
                      {org.name}
                    </h1>
                    {org.description && (
                      <p className="text-sm text-muted mt-2 leading-relaxed max-w-2xl">{org.description}</p>
                    )}
                    {org.website && (
                      <a
                        href={org.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-accent-strong hover:opacity-80 mt-2 inline-block transition-opacity"
                      >
                        {org.website.replace(/^https?:\/\//, "").replace(/\/$/, "")} ↗
                      </a>
                    )}
                  </div>
                </div>

                {/* CTA row: Contribute a story is the primary action */}
                <div className="flex flex-wrap gap-2.5 mt-5">{ctaButtons}</div>

                {/* Stats: connected riders, board models, events, places, stories */}
                <div className="mt-5 pt-5 border-t border-border-default flex gap-7 flex-wrap">{statBlocks}</div>
              </div>
            </div>

            {/* Invite strip: engagement nudge */}
            <div
              className="flex items-center gap-3.5 rounded-xl px-4 py-3.5 mb-6 border"
              style={{
                background: `linear-gradient(100deg, ${brandColor}14, ${brandColor}05)`,
                borderColor: `${brandColor}38`,
              }}
            >
              <div
                className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center text-white text-lg"
                style={{ background: ctaColor }}
                aria-hidden
              >
                ✎
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-foreground">Were you part of the {org.name} story?</div>
                <p className="text-xs text-muted mt-0.5">
                  Add a story, tag a board you rode, or claim a contest you were at. Every connection grows the brand&apos;s history.
                </p>
              </div>
              <button
                onClick={handleContribute}
                style={{ background: ctaColor, borderColor: ctaColor }}
                className="shrink-0 px-4 py-2 rounded-lg text-sm font-medium text-white border hover:opacity-90 transition-opacity"
              >
                Contribute a story
              </button>
            </div>
          </>
        )}

        {/* ── Show block (media orgs only): episodes + canon + publish, on top ── */}
        {org.org_type === "media" && <ShowModule org={org} />}

        {/* ── Curated sections (partner pages, above the shared feed) ── */}
        {isCurated && (
          <div className="space-y-7 mb-7">
            {/* Heritage statement */}
            {org.heritage_statement && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-semibold text-muted uppercase tracking-widest">Heritage</h2>
                  <span className="text-[10px] font-semibold rounded-full px-2 py-0.5" style={{ color: brandColor, background: `${brandColor}1a` }}>Curated</span>
                </div>
                <div className="relative rounded-2xl overflow-hidden p-6 sm:p-7" style={{ background: "#191613", color: "#f4f1ef" }}>
                  <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,.05) 1px, transparent 1px)", backgroundSize: "8px 8px" }} />
                  <blockquote className="relative m-0 text-lg leading-relaxed font-light whitespace-pre-line">{org.heritage_statement}</blockquote>
                </div>
              </section>
            )}

            {/* Brand timeline */}
            {milestones.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-semibold text-muted uppercase tracking-widest">Brand timeline</h2>
                  <span className="text-[10px] font-semibold rounded-full px-2 py-0.5" style={{ color: brandColor, background: `${brandColor}1a` }}>Curated</span>
                </div>
                <div className="flex gap-0 overflow-x-auto pb-3">
                  {milestones.map((m, i) => (
                    <div key={i} className="relative flex-none w-44 pr-6">
                      <div className="absolute left-0 right-0 top-[14px] h-0.5" style={{ background: "var(--border)" }} />
                      <div className="absolute left-0 top-[9px] w-3 h-3 rounded-full" style={{ background: brandColor, border: "3px solid var(--background)" }} />
                      {Number.isFinite(m.year) && m.year > 0 && (
                        <div className="mt-7 text-base text-foreground" style={{ fontFamily: "var(--font-wordmark)" }}>{m.year}</div>
                      )}
                      <div className="text-xs text-muted font-light leading-snug mt-0.5 pr-2">{m.label}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* The team */}
            {featuredRiders.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-semibold text-muted uppercase tracking-widest">The team</h2>
                  <button onClick={() => setTab("people")} className="text-xs text-accent-strong hover:opacity-80 transition-opacity">View all →</button>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-1.5">
                  {featuredRiders.map((p) => {
                    const claim = peopleClaims.find((c) => c.subject_id === p.id)
                    const role = claim ? PREDICATE_LABEL[claim.predicate] : null
                    return (
                      <CommunityLink key={p.id} href={personLink(p)} className="flex-none w-32">
                        <div className="bg-surface border border-border-default rounded-2xl p-3.5 text-center hover:border-foreground/20 transition-colors h-full">
                          <div className="flex justify-center mb-2">
                            <RiderAvatar person={p} size="lg" ring />
                          </div>
                          <div className="text-[13px] font-medium text-foreground truncate">{p.display_name}</div>
                          {claim && (claim.start_date || claim.end_date) && (
                            <div className="text-[11px] text-muted mt-0.5">{formatDateRange(claim.start_date, claim.end_date)}</div>
                          )}
                          {role && (
                            <div className="text-[10.5px] mt-1.5 inline-block rounded-full px-2 py-0.5 text-violet-700 bg-violet-500/10">{role}</div>
                          )}
                        </div>
                      </CommunityLink>
                    )
                  })}
                </div>
              </section>
            )}

            {/* Media & artifacts */}
            {media.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-semibold text-muted uppercase tracking-widest">Media &amp; artifacts</h2>
                </div>
                <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
                  {media.map((m, i) => {
                    const inner = (
                      <div className="border border-border-default rounded-2xl overflow-hidden bg-surface h-full">
                        <div className="flex items-center justify-center text-white/65 text-[11px]" style={{ height: 104, background: m.image_url ? undefined : "linear-gradient(135deg, #2a211d, #171311)" }}>
                          {m.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={m.image_url} alt={m.title ?? "media"} className="w-full h-full object-cover" />
                          ) : (
                            <span>{m.kind ?? "Artifact"}</span>
                          )}
                        </div>
                        <div className="px-3 py-2.5">
                          <div className="text-[12.5px] font-medium text-foreground truncate">{m.title}</div>
                          {m.subtitle && <div className="text-[11px] text-muted truncate">{m.subtitle}</div>}
                        </div>
                      </div>
                    )
                    return m.link_url ? (
                      <a key={i} href={m.link_url} target="_blank" rel="noopener noreferrer" className="block">{inner}</a>
                    ) : (
                      <div key={i}>{inner}</div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* Contribute module */}
            <section className="rounded-2xl p-5 sm:p-6 bg-surface border" style={{ borderColor: `${brandColor}40` }}>
              <h2 className="text-xl text-foreground mb-1.5" style={{ fontFamily: "var(--font-wordmark)" }}>Were you part of the {org.name} story?</h2>
              <p className="text-sm text-muted font-light max-w-xl mb-4 leading-relaxed">
                Riders, staff, photographers, shop crew, collectors. If you have a connection, add it. Your story becomes a permanent, linked node in the brand&apos;s history.
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                {[
                  { label: "✎ Share a story or memory", onClick: handleContribute },
                  { label: "⛷ I rode for the team", onClick: () => openClaim({ mode: "person", predicate: "sponsored_by" }) },
                  { label: "🛠 I worked here", onClick: () => openClaim({ mode: "person", predicate: "worked_at" }) },
                  { label: "🏁 I was at a contest", onClick: handleContribute },
                  { label: "🛹 I own a classic board", onClick: handleContribute },
                ].map((chip) => (
                  <button
                    key={chip.label}
                    onClick={chip.onClick}
                    className="text-[12.5px] rounded-full px-3.5 py-2 border border-border-default bg-background hover:border-foreground/30 transition-colors"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
              <button
                onClick={handleContribute}
                style={{ background: ctaColor, borderColor: ctaColor }}
                className="px-4 py-2.5 rounded-lg text-sm font-medium text-white border hover:opacity-90 transition-opacity"
              >
                Contribute a story
              </button>
            </section>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center mb-5">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm transition-colors",
                  tab === key
                    ? "bg-surface-active text-foreground"
                    : "text-muted hover:text-foreground hover:bg-surface-hover"
                )}
              >
                {label}
                {count !== undefined && count > 0 && (
                  <span className="ml-1.5 text-[11px] text-muted">{count}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-6">

          {/* Feed */}
          <div className="space-y-3">

            {/* ── All tab: calendar feed grouped by decade ── */}
            {tab === "all" && (
              <div className="space-y-8">
                {hasNoContent ? (
                  <div className="py-16 text-center">
                    <p className="text-muted text-sm mb-4">No claims yet for this brand.</p>
                    <button
                      onClick={() => setAddOpen(true)}
                      className="px-5 py-2.5 rounded-lg text-sm font-medium bg-[#1C1917] text-white hover:bg-[#292524] transition-colors"
                    >
                      + Add the first claim
                    </button>
                  </div>
                ) : decadeGroups.map(({ label, entries }) => (
                  <div key={label}>
                    {/* Decade divider */}
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xs font-semibold text-muted uppercase tracking-widest shrink-0">{label}</span>
                      <div className="flex-1 h-px bg-surface-active" />
                    </div>
                    <div className="space-y-2">
                      {entries.map((item, i) => {
                        if (item.kind === "person") {
                          const person = allPeople.find((p) => p.id === item.claim.subject_id)
                          if (!person) return null
                          const relLabel = PREDICATE_LABEL[item.claim.predicate] ?? item.claim.predicate
                          const confColor = CONFIDENCE_COLORS[item.claim.confidence] ?? "text-muted"
                          return (
                            <div key={item.claim.id} className="flex items-center gap-4 px-4 py-3.5 bg-surface border border-border-default rounded-xl hover:border-border-default transition-all">
                              <CommunityLink href={personLink(person)} className="shrink-0">
                                <RiderAvatar person={person} size="md" ring={!!(person.membership_tier && person.membership_tier !== "free")} />
                              </CommunityLink>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-baseline gap-2 flex-wrap">
                                  <CommunityLink href={personLink(person)} className="text-sm font-medium text-foreground hover:text-blue-300 transition-colors">
                                    {person.display_name}
                                  </CommunityLink>
                                  <span className="text-xs text-muted">{relLabel}</span>
                                </div>
                                {(item.claim.start_date || item.claim.end_date) && (
                                  <span className="text-xs text-muted">{formatDateRange(item.claim.start_date, item.claim.end_date)}</span>
                                )}
                              </div>
                              <span className={cn("text-[11px] shrink-0", confColor)}>
                                {item.claim.confidence === "self-reported" ? "unverified" : item.claim.confidence}
                              </span>
                            </div>
                          )
                        }

                        if (item.kind === "board") {
                          const ownerCount = boardOwnerClaims.filter((c) => c.object_id === item.board.id).length
                          return (
                            <CommunityLink key={item.board.id} href={`/boards/${boardSlug(item.board)}`}>
                              <div className="flex items-center gap-4 px-4 py-3.5 bg-surface border border-border-default border-l-2 border-l-emerald-700 rounded-xl hover:border-border-default transition-all group">
                                <span className="text-xl shrink-0">🏂</span>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-foreground group-hover:text-blue-300 transition-colors">
                                    {item.board.brand} {item.board.model}
                                  </div>
                                  <div className="text-xs text-muted mt-0.5">
                                    &apos;{String(item.board.model_year).slice(2)}
                                    {item.board.shape && <span className="text-muted capitalize"> · {item.board.shape.replace("-", " ")}</span>}
                                    {ownerCount > 0 && <span className="text-muted"> · {ownerCount} rider{ownerCount !== 1 ? "s" : ""}</span>}
                                  </div>
                                </div>
                              </div>
                            </CommunityLink>
                          )
                        }

                        if (item.kind === "event") {
                          const accentColor = EVENT_TYPE_COLOR[item.event.event_type] ?? "border-l-zinc-600"
                          return (
                            <CommunityLink key={item.claim?.id ?? item.event.id} href={`/events/${eventSlug(item.event)}`}>
                              <div className={cn(
                                "flex items-center gap-4 px-4 py-3.5 bg-surface border border-border-default border-l-2 rounded-xl hover:border-border-default transition-all group",
                                accentColor
                              )}>
                                <div className="shrink-0 w-9 h-9 rounded-lg bg-surface-hover border border-border-default flex items-center justify-center text-base">
                                  {item.event.event_type === "contest" ? "🏆" : item.event.event_type === "film-shoot" ? "🎬" : item.event.event_type === "trip" ? "🏔" : "📅"}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-foreground group-hover:text-blue-300 transition-colors">{item.event.name}</div>
                                  <div className="text-xs text-muted mt-0.5">
                                    <span className="uppercase tracking-widest mr-2">{item.event.event_type.replace("-", " ")}</span>
                                    {item.event.year ?? ""}
                                  </div>
                                </div>
                                {item.claim && (
                                  <span className={cn("text-[11px] shrink-0", CONFIDENCE_COLORS[item.claim.confidence] ?? "text-muted")}>
                                    {item.claim.confidence === "self-reported" ? "unverified" : item.claim.confidence}
                                  </span>
                                )}
                              </div>
                            </CommunityLink>
                          )
                        }

                        if (item.kind === "series") {
                          return (
                            <CommunityLink key={item.series.id} href={`/events/${seriesSlug(item.series)}`}>
                              <div className="flex items-center gap-4 px-4 py-3.5 bg-surface border border-border-default border-l-2 border-l-amber-700 rounded-xl hover:border-border-default transition-all group">
                                <div className="shrink-0 w-9 h-9 rounded-lg bg-surface-hover border border-border-default flex items-center justify-center text-base">📅</div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-foreground group-hover:text-blue-300 transition-colors">{item.series.name}</div>
                                  <div className="text-xs text-muted mt-0.5">
                                    Series{item.series.start_year ? ` · since ${item.series.start_year}` : ""}
                                  </div>
                                </div>
                              </div>
                            </CommunityLink>
                          )
                        }

                        if (item.kind === "place") {
                          const confColor = CONFIDENCE_COLORS[item.claim.confidence] ?? "text-muted"
                          return (
                            <div key={item.claim.id} className="flex items-center gap-4 px-4 py-3.5 bg-surface border border-border-default border-l-2 border-l-teal-700 rounded-xl">
                              <div className="shrink-0 w-9 h-9 rounded-lg bg-surface-hover border border-border-default flex items-center justify-center text-base">📍</div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-foreground">{item.place.name}</div>
                                <div className="text-xs text-muted mt-0.5">
                                  {[item.place.region, item.place.country].filter(Boolean).join(" · ")}
                                  {(item.claim.start_date || item.claim.end_date) && (
                                    <span className="text-muted"> · {formatDateRange(item.claim.start_date, item.claim.end_date)}</span>
                                  )}
                                </div>
                              </div>
                              <span className={cn("text-[11px] shrink-0", confColor)}>
                                {item.claim.confidence === "self-reported" ? "unverified" : item.claim.confidence}
                              </span>
                            </div>
                          )
                        }

                        if (item.kind === "story") {
                          return (
                            <StoryCard
                              key={item.story.id}
                              story={item.story}
                              isOwn={item.story.author_id === activePersonId}
                              onDelete={(sid) => setOrgStories((prev) => prev.filter((x) => x.id !== sid))}
                            />
                          )
                        }

                        return null
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── People tab ── */}
            {tab === "people" && (
              <div className="space-y-2">
                {peopleClaims.length === 0 ? (
                  <div className="py-12 text-center text-muted text-sm">
                    No people claims yet. <button onClick={() => setAddOpen(true)} className="text-blue-500 hover:text-blue-400">Add one.</button>
                  </div>
                ) : peopleClaims.map((claim) => {
                  const person = allPeople.find((p) => p.id === claim.subject_id)
                  if (!person) return null
                  const relLabel = PREDICATE_LABEL[claim.predicate] ?? claim.predicate
                  const confColor = CONFIDENCE_COLORS[claim.confidence] ?? "text-muted"
                  return (
                    <div key={claim.id} className="flex items-center gap-4 px-4 py-3.5 bg-surface border border-border-default rounded-xl hover:border-border-default transition-all">
                      <CommunityLink href={personLink(person)} className="shrink-0">
                        <RiderAvatar person={person} size="md" ring={!!(person.membership_tier && person.membership_tier !== "free")} />
                      </CommunityLink>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <CommunityLink href={personLink(person)} className="text-sm font-medium text-foreground hover:text-blue-300 transition-colors">
                            {person.display_name}
                          </CommunityLink>
                          <span className="text-xs text-muted">{relLabel}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {(claim.start_date || claim.end_date) && (
                            <span className="text-xs text-muted">{formatDateRange(claim.start_date, claim.end_date)}</span>
                          )}
                          {claim.note && (
                            <span className="text-xs text-muted truncate max-w-[200px]">{claim.note}</span>
                          )}
                        </div>
                      </div>
                      <span className={cn("text-[11px] shrink-0", confColor)}>
                        {claim.confidence === "self-reported" ? "unverified" : claim.confidence}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* ── Boards tab ── */}
            {tab === "boards" && (
              <div>
                {orgBoards.length === 0 ? (
                  <div className="py-12 text-center text-muted text-sm">No board models found for this brand.</div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {orgBoards.map((board) => {
                      const ownerCount = boardOwnerClaims.filter((c) => c.object_id === board.id).length
                      return (
                        <CommunityLink key={board.id} href={`/boards/${boardSlug(board)}`}>
                          <div className="flex items-start gap-3 px-3 py-3 bg-surface border border-border-default rounded-xl hover:border-border-default transition-all group">
                            <div className="shrink-0 flex items-center justify-center" style={{ width: 28, height: 60 }}>
                              <div style={{
                                width: 22, height: 54, borderRadius: 999,
                                background: "linear-gradient(180deg, #6ee7b7 0%, #059669 38%, #065f46 72%, #022c22 100%)",
                                boxShadow: "0 0 10px 3px rgba(52,211,153,0.15)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                              }}>
                                <div style={{ width: 1.5, height: 34, borderRadius: 999, background: "linear-gradient(180deg, rgba(167,243,208,0.9) 0%, transparent 100%)" }} />
                              </div>
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm text-foreground group-hover:text-blue-300 transition-colors leading-tight">{board.model}</div>
                              <div className="text-[11px] text-muted mt-0.5">
                                &apos;{String(board.model_year).slice(2)} · {board.shape ?? "–"}
                              </div>
                              {ownerCount > 0 && (
                                <div className="text-[10px] text-muted mt-0.5">{ownerCount} rider{ownerCount !== 1 ? "s" : ""}</div>
                              )}
                            </div>
                          </div>
                        </CommunityLink>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Events tab ── */}
            {tab === "events" && (
              <div className="space-y-2">
                {totalEvents === 0 ? (
                  <div className="py-12 text-center text-muted text-sm">
                    No events yet. <button onClick={() => setAddOpen(true)} className="text-blue-500 hover:text-blue-400">Add one.</button>
                  </div>
                ) : (
                  <>
                    {sortedBrandEvents.map(({ event, claim }) => {
                      const accentColor = EVENT_TYPE_COLOR[event.event_type] ?? "border-l-zinc-600"
                      const confColor = claim ? (CONFIDENCE_COLORS[claim.confidence] ?? "text-muted") : ""
                      return (
                        <CommunityLink key={claim?.id ?? event.id} href={`/events/${eventSlug(event)}`}>
                          <div className={cn(
                            "flex items-start gap-4 px-4 py-3.5 bg-surface border border-border-default border-l-2 rounded-xl hover:border-border-default transition-all group",
                            accentColor
                          )}>
                            <div className="shrink-0 w-9 h-9 rounded-lg bg-surface-hover border border-border-default flex items-center justify-center text-base">
                              {event.event_type === "contest" ? "🏆" : event.event_type === "film-shoot" ? "🎬" : event.event_type === "trip" ? "🏔" : "📅"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-foreground group-hover:text-blue-300 transition-colors">{event.name}</div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-muted capitalize">{event.event_type.replace("-", " ")}</span>
                                {event.year && <span className="text-xs text-muted">· {event.year}</span>}
                              </div>
                              {claim?.note && <div className="text-[11px] text-muted mt-1 truncate">{claim.note}</div>}
                            </div>
                            {claim && (
                              <span className={cn("text-[11px] shrink-0", confColor)}>
                                {claim.confidence === "self-reported" ? "unverified" : claim.confidence}
                              </span>
                            )}
                          </div>
                        </CommunityLink>
                      )
                    })}
                    {brandSeries.map((series) => (
                      <CommunityLink key={series.id} href={`/events/${seriesSlug(series)}`}>
                        <div className="flex items-start gap-4 px-4 py-3.5 bg-surface border border-border-default border-l-2 border-l-amber-700 rounded-xl hover:border-border-default transition-all group">
                          <div className="shrink-0 w-9 h-9 rounded-lg bg-surface-hover border border-border-default flex items-center justify-center text-base">📅</div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-foreground group-hover:text-blue-300 transition-colors">{series.name}</div>
                            <div className="text-xs text-muted mt-0.5">
                              Series{series.start_year ? ` · since ${series.start_year}` : ""}
                            </div>
                          </div>
                        </div>
                      </CommunityLink>
                    ))}
                  </>
                )}
              </div>
            )}

            {/* ── Places tab ── */}
            {tab === "places" && (
              <div className="space-y-2">
                {locatedAtClaims.length === 0 ? (
                  <div className="py-12 text-center text-muted text-sm">
                    No store locations yet. <button onClick={() => setAddOpen(true)} className="text-blue-500 hover:text-blue-400">Add one.</button>
                  </div>
                ) : locatedAtClaims.map((claim) => {
                  const place = catalog.places.find((p) => p.id === claim.object_id)
                  if (!place) return null
                  const confColor = CONFIDENCE_COLORS[claim.confidence] ?? "text-muted"
                  return (
                    <div key={claim.id} className="flex items-start gap-4 px-4 py-3.5 bg-surface border border-border-default border-l-2 border-l-teal-700 rounded-xl">
                      <div className="shrink-0 w-9 h-9 rounded-lg bg-surface-hover border border-border-default flex items-center justify-center text-base">📍</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground">{place.name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {place.region && <span className="text-xs text-muted">{place.region}</span>}
                          {place.country && <span className="text-xs text-muted">· {place.country}</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {(claim.start_date || claim.end_date) && (
                            <span className="text-xs text-muted">{formatDateRange(claim.start_date, claim.end_date)}</span>
                          )}
                          {claim.note && <span className="text-xs text-muted truncate max-w-[300px]">{claim.note}</span>}
                        </div>
                      </div>
                      <span className={cn("text-[11px] shrink-0", confColor)}>
                        {claim.confidence === "self-reported" ? "unverified" : claim.confidence}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* ── Stories tab ── */}
            {tab === "stories" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-semibold text-muted uppercase tracking-widest">Stories</h2>
                  {isAuth && (
                    <button
                      onClick={() => setAddingStory(true)}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      + Add story
                    </button>
                  )}
                </div>
                {orgStories.length === 0 ? (
                  <div className="py-12 text-center">
                    <div className="text-sm text-muted mb-1">No stories yet for this brand.</div>
                    {isAuth && (
                      <button
                        onClick={() => setAddingStory(true)}
                        className="text-xs text-blue-500 hover:text-blue-400"
                      >
                        Add the first story
                      </button>
                    )}
                  </div>
                ) : (
                  orgStories.map((s) => (
                    <StoryCard
                      key={s.id}
                      story={s}
                      isOwn={s.author_id === activePersonId}
                      onDelete={(sid) => setOrgStories((prev) => prev.filter((x) => x.id !== sid))}
                    />
                  ))
                )}
              </div>
            )}

          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Quick facts */}
            <div className="bg-surface border border-border-default rounded-xl p-4">
              <div className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">About</div>
              <div className="space-y-2 text-sm">
                {org.founded_year && (
                  <div className="flex justify-between">
                    <span className="text-muted">Founded</span>
                    <span className="text-muted">{org.founded_year}</span>
                  </div>
                )}
                {org.country && (
                  <div className="flex justify-between">
                    <span className="text-muted">Country</span>
                    <span className="text-muted">{org.country}</span>
                  </div>
                )}
                {org.region && (
                  <div className="flex justify-between">
                    <span className="text-muted">Region</span>
                    <span className="text-muted">{org.region}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted">Type</span>
                  <span className="text-muted">{typeLabel}</span>
                </div>
                {org.website && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted">Website</span>
                    <a
                      href={org.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-400 text-xs transition-colors"
                    >
                      {org.website.replace(/^https?:\/\//, "").replace(/\/$/, "")} ↗
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* From {brand}: outbound brand links (curated) */}
            {isCurated && brandLinks.length > 0 && (
              <div className="bg-surface border border-border-default rounded-xl p-4">
                <div className="text-xs font-semibold text-muted uppercase tracking-widest mb-2">From {org.name}</div>
                <div className="flex flex-col">
                  {brandLinks.map((l, i) => (
                    <a
                      key={i}
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-2 py-2 text-sm text-foreground border-b border-border-default last:border-0 hover:text-accent-strong transition-colors"
                    >
                      <span className="truncate">{l.label || l.url}</span>
                      <span className="text-xs text-muted shrink-0">↗</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Riders who owned boards */}
            {boardOwnerClaims.length > 0 && (
              <div className="bg-surface border border-border-default rounded-xl p-4">
                <div className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">
                  Riders who owned {org.name.split(" ")[0]} boards
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[...new Set(boardOwnerClaims.map((c) => c.subject_id))].map((rid) => {
                    const person = catalog.people.find((p) => p.id === rid)
                    if (!person) return null
                    return (
                      <CommunityLink key={rid} href={personLink(rid)}>
                        <div className="flex items-center gap-1 px-2 py-1 bg-background border border-border-default rounded-full text-xs text-muted hover:text-foreground hover:border-border-default transition-all">
                          <RiderAvatar person={person} size="xs" />
                          {person.display_name.split(" ")[0]}
                        </div>
                      </CommunityLink>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Community note */}
            <div className="bg-bg-nav border border-border-default rounded-xl p-4">
              <div className="text-xs font-semibold text-muted uppercase tracking-widest mb-2">Community profile</div>
              <p className="text-xs text-muted leading-relaxed">
                This brand profile is open for anyone to contribute. Claims are unverified until corroborated by multiple sources.
              </p>
              <button
                onClick={() => setAddOpen(true)}
                className="mt-3 w-full px-3 py-2 bg-surface-hover border border-border-default rounded-lg text-xs text-muted hover:text-foreground hover:border-border-default transition-all"
              >
                + Add a claim
              </button>
            </div>
          </div>
        </div>

        {/* Provenance line (curated) */}
        {isCurated && (
          <div className="text-center text-xs text-muted font-light pt-7">
            <span className="font-semibold" style={{ color: brandColor }}>Curated by Linestry</span>
            {" · expanded by the community · "}
            {orgStories.length} stor{orgStories.length === 1 ? "y" : "ies"} and {uniqueRiderIds.length} rider{uniqueRiderIds.length === 1 ? "" : "s"} added by members
          </div>
        )}
      </div>

      {addOpen && <AddBrandClaimModal org={org} initial={claimPreset} onClose={() => { setAddOpen(false); setClaimPreset(undefined) }} />}
      {addingStory && (
        <AddStoryModal
          defaults={{ linkedOrgId: org.id }}
          onClose={() => setAddingStory(false)}
          onSaved={(s) => { setOrgStories((prev) => [s, ...prev]); setAddingStory(false) }}
        />
      )}
    </div>
  )
}
