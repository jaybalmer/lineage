"use client"

import { useState, use, useMemo } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Nav } from "@/components/ui/nav"
import { boardSlug, orgSlug } from "@/lib/mock-data"
import { formatDateRange } from "@/lib/utils"
import { cn } from "@/lib/utils"
import { useLineageStore } from "@/store/lineage-store"
import { RiderAvatar } from "@/components/ui/rider-avatar"
import type { Org, ConfidenceLevel, Predicate, Event, Place } from "@/types"

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

function AddBrandClaimModal({ org, onClose }: { org: Org; onClose: () => void }) {
  const { addClaim, activePersonId, catalog } = useLineageStore()

  const [mode, setMode] = useState<ClaimMode>("person")
  const [predicate, setPredicate] = useState<Predicate>("sponsored_by")
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
                {catalog.people.map((p) => (
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
                ? "bg-blue-600 text-white hover:bg-blue-500"
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
  trip: "border-l-emerald-700",
  camp: "border-l-blue-700",
  gathering: "border-l-zinc-600",
}

type FeedTab = "all" | "people" | "boards" | "events" | "places"

export default function BrandPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const { catalog, sessionClaims, dbClaims, userEntities } = useLineageStore()
  const allOrgs = [...catalog.orgs, ...userEntities.orgs]
  const org = allOrgs.find((o) => o.id === slug || orgSlug(o) === slug)
  if (!org) notFound()

  const storeClaims = [...sessionClaims, ...dbClaims]
  const [addOpen, setAddOpen] = useState(false)
  const [tab, setTab] = useState<FeedTab>("all")

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
  }, [peopleClaims, orgBoards, organizedClaims, extraBrandEvents, brandSeries, locatedAtClaims])

  const typeLabel = org.brand_category
    ? BRAND_CAT_LABEL[org.brand_category]
    : ORG_TYPE_LABEL[org.org_type]

  const initials = org.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()

  const totalEvents = organizedClaims.length + extraBrandEvents.length + brandSeries.length
  const hasNoContent = peopleClaims.length === 0 && orgBoards.length === 0 && totalEvents === 0 && locatedAtClaims.length === 0

  const tabs: { key: FeedTab; label: string; count?: number }[] = [
    { key: "all", label: "All" },
    { key: "people", label: "People", count: uniqueRiderIds.length },
    { key: "boards", label: "Boards", count: orgBoards.length },
    { key: "events", label: "Events", count: totalEvents },
    { key: "places", label: "Places", count: locatedAtClaims.length },
  ]

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Breadcrumb */}
        <div className="text-xs text-muted mb-6">
          <Link href="/brands" className="hover:text-foreground transition-colors">Brands</Link>
          <span className="mx-2">/</span>
          <span className="text-muted">{org.name}</span>
        </div>

        {/* Header */}
        <div className="bg-surface border border-border-default rounded-xl p-6 mb-6">
          <div className="flex items-start gap-5">
            {/* Logo / initials block */}
            <div
              className="w-16 h-16 rounded-xl shrink-0 flex items-center justify-center text-2xl font-bold overflow-hidden"
              style={{
                background: "linear-gradient(145deg, #1c1c1f 0%, #111113 100%)",
                border: "1px solid rgba(161,161,170,0.12)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                position: "relative",
              }}
            >
              <div style={{
                position: "absolute",
                inset: 0,
                backgroundImage: "radial-gradient(circle, rgba(161,161,170,0.15) 1px, transparent 1px)",
                backgroundSize: "8px 8px",
              }} />
              <span style={{
                position: "relative",
                background: "linear-gradient(140deg, #f4f4f5 0%, #a1a1aa 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>
                {initials}
              </span>
            </div>

            {/* Name + meta */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-muted uppercase tracking-widest">{typeLabel}</span>
                {org.founded_year && (
                  <span className="text-xs text-muted">· est. {org.founded_year}</span>
                )}
                {org.country && (
                  <span className="text-xs text-muted">· {org.country}</span>
                )}
              </div>
              <h1 className="text-2xl font-bold text-foreground">{org.name}</h1>
              {org.description && (
                <p className="text-sm text-muted mt-2 leading-relaxed max-w-2xl">{org.description}</p>
              )}
              {org.website && (
                <a
                  href={org.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:text-blue-400 mt-2 inline-block transition-colors"
                >
                  {org.website.replace(/^https?:\/\//, "")} ↗
                </a>
              )}
            </div>

            {/* Edit button (community editable) */}
            <button className="shrink-0 px-3 py-1.5 rounded-lg text-xs text-muted border border-border-default hover:border-border-default hover:text-foreground transition-all">
              Edit
            </button>
          </div>

          {/* Stats */}
          <div className="mt-5 flex gap-6 text-sm flex-wrap">
            {uniqueRiderIds.length > 0 && (
              <div>
                <div className="font-bold text-foreground text-xl">{uniqueRiderIds.length}</div>
                <div className="text-muted text-xs">connected riders</div>
              </div>
            )}
            {orgBoards.length > 0 && (
              <>
                <div className="w-px bg-border-default" />
                <div>
                  <div className="font-bold text-foreground text-xl">{orgBoards.length}</div>
                  <div className="text-muted text-xs">board models</div>
                </div>
              </>
            )}
            {totalEvents > 0 && (
              <>
                <div className="w-px bg-border-default" />
                <div>
                  <div className="font-bold text-foreground text-xl">{totalEvents}</div>
                  <div className="text-muted text-xs">events</div>
                </div>
              </>
            )}
            {locatedAtClaims.length > 0 && (
              <>
                <div className="w-px bg-border-default" />
                <div>
                  <div className="font-bold text-foreground text-xl">{locatedAtClaims.length}</div>
                  <div className="text-muted text-xs">locations</div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Tabs + Add claim */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex gap-1">
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
          <button
            onClick={() => setAddOpen(true)}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 transition-colors"
          >
            + Add claim
          </button>
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
                      className="px-5 py-2.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 transition-colors"
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
                          const person = catalog.people.find((p) => p.id === item.claim.subject_id)
                          if (!person) return null
                          const relLabel = PREDICATE_LABEL[item.claim.predicate] ?? item.claim.predicate
                          const confColor = CONFIDENCE_COLORS[item.claim.confidence] ?? "text-muted"
                          return (
                            <div key={item.claim.id} className="flex items-center gap-4 px-4 py-3.5 bg-surface border border-border-default rounded-xl hover:border-border-default transition-all">
                              <Link href={`/riders/${person.id}`} className="shrink-0">
                                <RiderAvatar person={person} size="md" ring={!!(person.membership_tier && person.membership_tier !== "free")} />
                              </Link>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-baseline gap-2 flex-wrap">
                                  <Link href={`/riders/${person.id}`} className="text-sm font-medium text-foreground hover:text-blue-300 transition-colors">
                                    {person.display_name}
                                  </Link>
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
                            <Link key={item.board.id} href={`/boards/${boardSlug(item.board)}`}>
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
                            </Link>
                          )
                        }

                        if (item.kind === "event") {
                          const accentColor = EVENT_TYPE_COLOR[item.event.event_type] ?? "border-l-zinc-600"
                          return (
                            <Link key={item.claim?.id ?? item.event.id} href={`/events/${item.event.id}`}>
                              <div className={cn(
                                "flex items-center gap-4 px-4 py-3.5 bg-surface border border-border-default border-l-2 rounded-xl hover:border-border-default transition-all group",
                                accentColor
                              )}>
                                <div className="shrink-0 w-9 h-9 rounded-lg bg-surface-hover border border-border-default flex items-center justify-center text-base">
                                  {item.event.event_type === "contest" ? "🏆" : item.event.event_type === "film-shoot" ? "🎬" : item.event.event_type === "trip" ? "🏔" : "📅"}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-foreground group-hover:text-blue-300 transition-colors">{item.event.name}</div>
                                  <div className="text-xs text-muted capitalize mt-0.5">{item.event.event_type.replace("-", " ")}{item.event.year ? ` · ${item.event.year}` : ""}</div>
                                </div>
                                {item.claim && (
                                  <span className={cn("text-[11px] shrink-0", CONFIDENCE_COLORS[item.claim.confidence] ?? "text-muted")}>
                                    {item.claim.confidence === "self-reported" ? "unverified" : item.claim.confidence}
                                  </span>
                                )}
                              </div>
                            </Link>
                          )
                        }

                        if (item.kind === "series") {
                          return (
                            <Link key={item.series.id} href={`/events/${item.series.id}`}>
                              <div className="flex items-center gap-4 px-4 py-3.5 bg-surface border border-border-default border-l-2 border-l-amber-700 rounded-xl hover:border-border-default transition-all group">
                                <div className="shrink-0 w-9 h-9 rounded-lg bg-surface-hover border border-border-default flex items-center justify-center text-base">📅</div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-foreground group-hover:text-blue-300 transition-colors">{item.series.name}</div>
                                  <div className="text-xs text-muted mt-0.5">
                                    Series{item.series.start_year ? ` · since ${item.series.start_year}` : ""}
                                  </div>
                                </div>
                              </div>
                            </Link>
                          )
                        }

                        if (item.kind === "place") {
                          const confColor = CONFIDENCE_COLORS[item.claim.confidence] ?? "text-muted"
                          return (
                            <div key={item.claim.id} className="flex items-center gap-4 px-4 py-3.5 bg-surface border border-border-default border-l-2 border-l-blue-800 rounded-xl">
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
                  const person = catalog.people.find((p) => p.id === claim.subject_id)
                  if (!person) return null
                  const relLabel = PREDICATE_LABEL[claim.predicate] ?? claim.predicate
                  const confColor = CONFIDENCE_COLORS[claim.confidence] ?? "text-muted"
                  return (
                    <div key={claim.id} className="flex items-center gap-4 px-4 py-3.5 bg-surface border border-border-default rounded-xl hover:border-border-default transition-all">
                      <Link href={`/riders/${person.id}`} className="shrink-0">
                        <RiderAvatar person={person} size="md" ring={!!(person.membership_tier && person.membership_tier !== "free")} />
                      </Link>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <Link href={`/riders/${person.id}`} className="text-sm font-medium text-foreground hover:text-blue-300 transition-colors">
                            {person.display_name}
                          </Link>
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
                        <Link key={board.id} href={`/boards/${boardSlug(board)}`}>
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
                        </Link>
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
                    {organizedClaims.map((claim) => {
                      const event = catalog.events.find((e) => e.id === claim.object_id)
                      if (!event) return null
                      const accentColor = EVENT_TYPE_COLOR[event.event_type] ?? "border-l-zinc-600"
                      const confColor = CONFIDENCE_COLORS[claim.confidence] ?? "text-muted"
                      return (
                        <Link key={claim.id} href={`/events/${event.id}`}>
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
                              {claim.note && <div className="text-[11px] text-muted mt-1 truncate">{claim.note}</div>}
                            </div>
                            <span className={cn("text-[11px] shrink-0", confColor)}>
                              {claim.confidence === "self-reported" ? "unverified" : claim.confidence}
                            </span>
                          </div>
                        </Link>
                      )
                    })}
                    {extraBrandEvents.map((event) => {
                      const accentColor = EVENT_TYPE_COLOR[event.event_type] ?? "border-l-zinc-600"
                      return (
                        <Link key={event.id} href={`/events/${event.id}`}>
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
                            </div>
                          </div>
                        </Link>
                      )
                    })}
                    {brandSeries.map((series) => (
                      <Link key={series.id} href={`/events/${series.id}`}>
                        <div className="flex items-start gap-4 px-4 py-3.5 bg-surface border border-border-default border-l-2 border-l-amber-700 rounded-xl hover:border-border-default transition-all group">
                          <div className="shrink-0 w-9 h-9 rounded-lg bg-surface-hover border border-border-default flex items-center justify-center text-base">📅</div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-foreground group-hover:text-blue-300 transition-colors">{series.name}</div>
                            <div className="text-xs text-muted mt-0.5">
                              Series{series.start_year ? ` · since ${series.start_year}` : ""}
                            </div>
                          </div>
                        </div>
                      </Link>
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
                    <div key={claim.id} className="flex items-start gap-4 px-4 py-3.5 bg-surface border border-border-default border-l-2 border-l-blue-800 rounded-xl">
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
                      <Link key={rid} href={`/riders/${rid}`}>
                        <div className="flex items-center gap-1 px-2 py-1 bg-background border border-border-default rounded-full text-xs text-muted hover:text-foreground hover:border-border-default transition-all">
                          <RiderAvatar person={person} size="xs" />
                          {person.display_name.split(" ")[0]}
                        </div>
                      </Link>
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
      </div>

      {addOpen && <AddBrandClaimModal org={org} onClose={() => setAddOpen(false)} />}
    </div>
  )
}
