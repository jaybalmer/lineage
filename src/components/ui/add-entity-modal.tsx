"use client"

import { useState } from "react"
import { useLineageStore } from "@/store/lineage-store"
import { cn } from "@/lib/utils"
import { PLACES, EVENT_SERIES, getPersonById } from "@/lib/mock-data"
import type { PlaceType, OrgType, EventType, EventSeries } from "@/types"

type AddEntityType = "place" | "board" | "org" | "event" | "person"

interface AddEntityModalProps {
  entityType: AddEntityType
  initialName?: string
  initialSeriesId?: string
  initialPlaceId?: string
  onClose: () => void
  onAdded: (id: string) => void
}

function generateId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

const PLACE_TYPES: PlaceType[] = ["resort", "shop", "zone", "city", "venue"]
const ORG_TYPES: OrgType[] = ["brand", "shop", "team", "magazine", "event-series"]
const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: "contest", label: "Contest" },
  { value: "film-shoot", label: "Film shoot" },
  { value: "trip", label: "Trip" },
  { value: "camp", label: "Camp" },
  { value: "gathering", label: "Gathering" },
]
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

export function AddEntityModal({ entityType, initialName = "", initialSeriesId = "", initialPlaceId = "", onClose, onAdded }: AddEntityModalProps) {
  const { addUserPlace, addUserBoard, addUserOrg, addUserEvent, addUserSeries, addUserPerson, activePersonId, profileOverride, catalog } = useLineageStore()

  // Combined series/places lists (catalog includes user-added entries)
  const allSeries = catalog.eventSeries?.length ? catalog.eventSeries : EVENT_SERIES
  const allPlaces = catalog.places?.length ? catalog.places : PLACES

  // Resolve the current user's display name for attribution
  // Check PEOPLE mock data first, then profile override, then generic fallback
  const currentPerson = getPersonById(activePersonId)
  const addingAsName = currentPerson?.display_name ?? profileOverride.display_name ?? "you"

  // Shared
  const [name, setName] = useState(initialName)

  // Place fields
  const [placeType, setPlaceType] = useState<PlaceType>("resort")
  const [region, setRegion] = useState("")
  const [country, setCountry] = useState("")
  const [placeWebsite, setPlaceWebsite] = useState("")
  const [placeDescription, setPlaceDescription] = useState("")
  const [firstSnowboardYear, setFirstSnowboardYear] = useState("")

  // Board fields
  const [brand, setBrand] = useState(initialName)
  const [model, setModel] = useState("")
  const [modelYear, setModelYear] = useState<number>(new Date().getFullYear())

  // Org fields
  const [orgType, setOrgType] = useState<OrgType>("shop")
  const [orgCountry, setOrgCountry] = useState("")
  const [foundedYear, setFoundedYear] = useState("")
  const [website, setWebsite] = useState("")
  const [description, setDescription] = useState("")

  // Event fields
  const [eventType, setEventType] = useState<EventType>("contest")
  const [eventYear, setEventYear] = useState("")
  const [eventMonth, setEventMonth] = useState("")
  const [showExactDates, setShowExactDates] = useState(false)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  // Event — place
  const [eventPlaceId, setEventPlaceId] = useState(initialPlaceId)
  const [eventPlaceQuery, setEventPlaceQuery] = useState("")
  // Event — series
  const [eventSeriesId, setEventSeriesId] = useState(initialSeriesId)
  const [eventSeriesQuery, setEventSeriesQuery] = useState("")
  const [showCreateSeries, setShowCreateSeries] = useState(false)
  const [newSeriesName, setNewSeriesName] = useState("")
  const [newSeriesFreq, setNewSeriesFreq] = useState<EventSeries["frequency"]>("annual")
  const [newSeriesStartYear, setNewSeriesStartYear] = useState("")

  // Person fields
  const [displayName, setDisplayName] = useState(initialName)
  const [ridingSince, setRidingSince] = useState("")
  const [bio, setBio] = useState("")

  const canSubmit = () => {
    if (entityType === "place") return name.trim().length > 0
    if (entityType === "board") return brand.trim().length > 0 && model.trim().length > 0
    if (entityType === "org") return name.trim().length > 0
    if (entityType === "person") return displayName.trim().length > 0
    if (entityType === "event") {
      const y = parseInt(eventYear)
      return name.trim().length > 0 && eventYear.length === 4 && y >= 1950 && y <= 2030
    }
    return false
  }

  const handleSubmit = () => {
    if (!canSubmit()) return

    if (entityType === "place") {
      const id = generateId("place")
      addUserPlace({
        id,
        name: name.trim(),
        place_type: placeType,
        region: region.trim() || undefined,
        country: country.trim() || undefined,
        website: placeWebsite.trim() || undefined,
        description: placeDescription.trim() || undefined,
        first_snowboard_year: firstSnowboardYear ? parseInt(firstSnowboardYear) : undefined,
        community_status: "unverified",
        added_by: activePersonId,
      })
      onAdded(id)
    } else if (entityType === "board") {
      const id = generateId("board")
      addUserBoard({
        id,
        brand: brand.trim(),
        model: model.trim(),
        model_year: modelYear,
        community_status: "unverified",
        added_by: activePersonId,
      })
      onAdded(id)
    } else if (entityType === "org") {
      const id = generateId("org")
      addUserOrg({
        id,
        name: name.trim(),
        org_type: orgType,
        description: description.trim() || undefined,
        country: orgCountry.trim() || undefined,
        founded_year: foundedYear ? parseInt(foundedYear) : undefined,
        website: website.trim() || undefined,
        community_status: "unverified",
        added_by: activePersonId,
      })
      onAdded(id)
    } else if (entityType === "event") {
      // If user typed a new series name but hasn't created it yet, create it now
      let resolvedSeriesId = eventSeriesId
      if (!resolvedSeriesId && showCreateSeries && newSeriesName.trim()) {
        const sid = generateId("series")
        addUserSeries({
          id: sid,
          name: newSeriesName.trim(),
          frequency: newSeriesFreq,
          start_year: newSeriesStartYear ? parseInt(newSeriesStartYear) : undefined,
          place_id: eventPlaceId || undefined,
        })
        resolvedSeriesId = sid
      }
      const id = generateId("event")
      const year = parseInt(eventYear)
      let computedStart = eventYear
      if (eventMonth) computedStart = `${eventYear}-${eventMonth.padStart(2, "0")}`
      if (showExactDates && startDate) computedStart = startDate
      addUserEvent({
        id,
        name: name.trim(),
        event_type: eventType,
        year,
        start_date: computedStart,
        end_date: showExactDates && endDate ? endDate : undefined,
        place_id: eventPlaceId || undefined,
        series_id: resolvedSeriesId || undefined,
        community_status: "unverified",
        added_by: activePersonId,
      })
      onAdded(id)
    } else if (entityType === "person") {
      const id = generateId("rider")
      addUserPerson({
        id,
        display_name: displayName.trim(),
        riding_since: ridingSince ? parseInt(ridingSince) : undefined,
        bio: bio.trim() || undefined,
        privacy_level: "public",
        community_status: "unverified",
        added_by: activePersonId,
      })
      onAdded(id)
    }
  }

  const titles: Record<AddEntityType, string> = {
    place: "Add a new place",
    board: "Add a new board",
    org: "Add a brand, shop, or team",
    event: "Add a new event",
    person: "Add a rider",
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative w-full max-w-md bg-surface border border-border-default rounded-2xl p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-5">
          <h2 className="text-lg font-bold text-foreground">{titles[entityType]}</h2>
          <p className="text-xs text-muted mt-1">
            Will be added as unverified — the community can confirm it.
          </p>
        </div>

        {/* Fields */}
        <div className="space-y-3">
          {entityType === "place" && (
            <>
              <Field label="Place name" required>
                <input
                  autoFocus
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Whistler Blackcomb"
                  className={inputCls}
                />
              </Field>
              <Field label="Type">
                <select
                  value={placeType}
                  onChange={(e) => setPlaceType(e.target.value as PlaceType)}
                  className={inputCls}
                >
                  {PLACE_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Region">
                  <input
                    type="text"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    placeholder="e.g. BC"
                    className={inputCls}
                  />
                </Field>
                <Field label="Country">
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="e.g. Canada"
                    className={inputCls}
                  />
                </Field>
              </div>
              <Field label="First snowboard year">
                <input
                  type="number"
                  value={firstSnowboardYear}
                  onChange={(e) => setFirstSnowboardYear(e.target.value)}
                  placeholder="e.g. 1985"
                  min={1950}
                  max={new Date().getFullYear()}
                  className={inputCls}
                />
              </Field>
              <Field label="Website">
                <input
                  type="text"
                  value={placeWebsite}
                  onChange={(e) => setPlaceWebsite(e.target.value)}
                  placeholder="https://..."
                  className={inputCls}
                />
              </Field>
              <Field label="Description">
                <textarea
                  value={placeDescription}
                  onChange={(e) => setPlaceDescription(e.target.value)}
                  placeholder="Brief description of this place…"
                  rows={2}
                  className={cn(inputCls, "resize-none")}
                />
              </Field>
            </>
          )}

          {entityType === "board" && (
            <>
              <Field label="Brand" required>
                <input
                  autoFocus
                  type="text"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="e.g. Burton"
                  className={inputCls}
                />
              </Field>
              <Field label="Model" required>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="e.g. Custom"
                  className={inputCls}
                />
              </Field>
              <Field label="Year">
                <input
                  type="number"
                  value={modelYear}
                  onChange={(e) => setModelYear(parseInt(e.target.value) || new Date().getFullYear())}
                  min={1965}
                  max={2030}
                  className={inputCls}
                />
              </Field>
            </>
          )}

          {entityType === "org" && (
            <>
              <Field label="Name" required>
                <input
                  autoFocus
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Local Shred Shop"
                  className={inputCls}
                />
              </Field>
              <Field label="Type">
                <select
                  value={orgType}
                  onChange={(e) => setOrgType(e.target.value as OrgType)}
                  className={inputCls}
                >
                  {ORG_TYPES.map((t) => (
                    <option key={t} value={t}>{t.replace("-", " ")}</option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Founded year">
                  <input
                    type="number"
                    value={foundedYear}
                    onChange={(e) => setFoundedYear(e.target.value)}
                    placeholder="e.g. 1995"
                    min={1900}
                    max={2030}
                    className={inputCls}
                  />
                </Field>
                <Field label="Country">
                  <input
                    type="text"
                    value={orgCountry}
                    onChange={(e) => setOrgCountry(e.target.value)}
                    placeholder="e.g. CA"
                    className={inputCls}
                  />
                </Field>
              </div>
              <Field label="Website">
                <input
                  type="text"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://..."
                  className={inputCls}
                />
              </Field>
              <Field label="Description">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of this brand or org…"
                  rows={2}
                  className={cn(inputCls, "resize-none")}
                />
              </Field>
            </>
          )}

          {entityType === "event" && (
            <>
              <Field label="Event name" required>
                <input
                  autoFocus
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Mt. Baker Legendary Banked Slalom"
                  className={inputCls}
                />
              </Field>
              <Field label="Type">
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value as EventType)}
                  className={inputCls}
                >
                  {EVENT_TYPES.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Year" required>
                  <input
                    type="number"
                    value={eventYear}
                    onChange={(e) => setEventYear(e.target.value)}
                    placeholder="e.g. 2004"
                    min={1950}
                    max={2030}
                    className={inputCls}
                  />
                </Field>
                <Field label="Month">
                  <select
                    value={eventMonth}
                    onChange={(e) => setEventMonth(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">— optional —</option>
                    {MONTHS.map((m, i) => (
                      <option key={i + 1} value={String(i + 1)}>{m}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <button
                type="button"
                onClick={() => setShowExactDates(!showExactDates)}
                className="text-xs text-muted hover:text-foreground transition-colors text-left"
              >
                {showExactDates ? "− Remove specific dates" : "+ Add specific start / end dates"}
              </button>
              {showExactDates && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Start date">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value)
                        if (!endDate) setEndDate(e.target.value)
                        const d = new Date(e.target.value)
                        if (!isNaN(d.getTime())) {
                          setEventYear(String(d.getUTCFullYear()))
                          setEventMonth(String(d.getUTCMonth() + 1))
                        }
                      }}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="End date">
                    <input
                      type="date"
                      value={endDate}
                      min={startDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className={inputCls}
                    />
                  </Field>
                </div>
              )}

              {/* Place picker */}
              <Field label="Place">
                {eventPlaceId ? (
                  <div className="flex items-center justify-between bg-emerald-950/30 border border-emerald-800/40 rounded-lg px-3 py-2">
                    <span className="text-sm text-foreground">
                      🏔 {allPlaces.find((p) => p.id === eventPlaceId)?.name ?? eventPlaceId}
                    </span>
                    <button onClick={() => setEventPlaceId("")} className="text-xs text-muted hover:text-foreground ml-2">×</button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      value={eventPlaceQuery}
                      onChange={(e) => setEventPlaceQuery(e.target.value)}
                      placeholder="Search places…"
                      className={inputCls}
                    />
                    {eventPlaceQuery.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-surface border border-border-default rounded-lg shadow-xl max-h-36 overflow-y-auto">
                        {allPlaces.filter((p) => p.name.toLowerCase().includes(eventPlaceQuery.toLowerCase())).slice(0, 6).map((p) => (
                          <button key={p.id} onClick={() => { setEventPlaceId(p.id); setEventPlaceQuery("") }}
                            className="w-full text-left px-3 py-2 text-sm text-muted hover:bg-surface-hover hover:text-foreground transition-colors">
                            {p.name}
                          </button>
                        ))}
                        {allPlaces.filter((p) => p.name.toLowerCase().includes(eventPlaceQuery.toLowerCase())).length === 0 && (
                          <div className="px-3 py-2 text-xs text-muted">No places found</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </Field>

              {/* Series picker */}
              <Field label="Part of a series?">
                {eventSeriesId && !showCreateSeries ? (
                  <div className="flex items-center justify-between bg-blue-950/30 border border-blue-800/40 rounded-lg px-3 py-2">
                    <span className="text-sm text-foreground">
                      📅 {allSeries.find((s) => s.id === eventSeriesId)?.name ?? eventSeriesId}
                    </span>
                    <button onClick={() => setEventSeriesId("")} className="text-xs text-muted hover:text-foreground ml-2">×</button>
                  </div>
                ) : !showCreateSeries ? (
                  <div className="relative">
                    <input
                      type="text"
                      value={eventSeriesQuery}
                      onChange={(e) => setEventSeriesQuery(e.target.value)}
                      placeholder="Search or create a series…"
                      className={inputCls}
                    />
                    {eventSeriesQuery.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-surface border border-border-default rounded-lg shadow-xl max-h-40 overflow-y-auto">
                        {allSeries.filter((s) => s.name.toLowerCase().includes(eventSeriesQuery.toLowerCase())).slice(0, 5).map((s) => (
                          <button key={s.id} onClick={() => { setEventSeriesId(s.id); setEventSeriesQuery("") }}
                            className="w-full text-left px-3 py-2 text-sm text-muted hover:bg-surface-hover hover:text-foreground transition-colors">
                            {s.name}
                            {s.start_year && <span className="text-xs text-muted/60 ml-2">since {s.start_year}</span>}
                          </button>
                        ))}
                        <button
                          onClick={() => { setNewSeriesName(eventSeriesQuery); setShowCreateSeries(true); setEventSeriesQuery("") }}
                          className="w-full text-left px-3 py-2 text-sm text-blue-400 hover:bg-surface-hover transition-colors flex items-center gap-2">
                          <span className="font-bold">+</span> Create &ldquo;{eventSeriesQuery.trim()}&rdquo; as new series
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Inline series creation */
                  <div className="border border-blue-800/40 rounded-lg p-3 bg-blue-950/20 space-y-2">
                    <div className="text-xs font-medium text-blue-300 mb-2">New series</div>
                    <input
                      autoFocus
                      type="text"
                      value={newSeriesName}
                      onChange={(e) => setNewSeriesName(e.target.value)}
                      placeholder="Series name…"
                      className={inputCls}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select value={newSeriesFreq} onChange={(e) => setNewSeriesFreq(e.target.value as EventSeries["frequency"])} className={inputCls}>
                        <option value="annual">Annual</option>
                        <option value="tour">Tour</option>
                        <option value="irregular">Irregular</option>
                      </select>
                      <input
                        type="number"
                        value={newSeriesStartYear}
                        onChange={(e) => setNewSeriesStartYear(e.target.value)}
                        placeholder="Start year"
                        min={1950} max={2030}
                        className={inputCls}
                      />
                    </div>
                    <button onClick={() => { setShowCreateSeries(false); setNewSeriesName("") }} className="text-xs text-muted hover:text-foreground transition-colors">
                      ← Cancel
                    </button>
                  </div>
                )}
              </Field>
            </>
          )}

          {entityType === "person" && (
            <>
              <Field label="Full name" required>
                <input
                  autoFocus
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Jake Burton"
                  className={inputCls}
                />
              </Field>
              <Field label="Riding since">
                <input
                  type="number"
                  value={ridingSince}
                  onChange={(e) => setRidingSince(e.target.value)}
                  placeholder="e.g. 1995"
                  min={1950}
                  max={new Date().getFullYear()}
                  className={inputCls}
                />
              </Field>
              <Field label="Bio">
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Brief note about this rider…"
                  rows={2}
                  className={cn(inputCls, "resize-none")}
                />
              </Field>
            </>
          )}
        </div>

        {/* Author attribution */}
        <div className="mt-4 flex items-center gap-2 px-3 py-2 bg-bg-nav border border-border-default rounded-lg">
          <div className="w-5 h-5 rounded-full bg-[#1C1917] flex items-center justify-center text-[9px] font-bold text-foreground shrink-0">
            {addingAsName[0]}
          </div>
          <span className="text-xs text-muted">
            Adding as <span className="text-muted">{addingAsName}</span>
            <span className="text-muted"> · marked unverified until confirmed</span>
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-4">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm text-muted hover:text-foreground border border-border-default hover:border-border-default transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit()}
            className={cn(
              "flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
              canSubmit()
                ? "bg-[#1C1917] text-[#F5F2EE] hover:bg-[#292524]"
                : "bg-surface-active text-muted cursor-not-allowed"
            )}
          >
            Add to graph
          </button>
        </div>
      </div>
    </div>
  )
}

const inputCls =
  "w-full bg-background border border-border-default rounded-lg px-3 py-2.5 text-sm text-foreground placeholder-zinc-600 focus:outline-none focus:border-blue-500"

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-muted mb-1.5">
        {label}{required && <span className="text-blue-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}
