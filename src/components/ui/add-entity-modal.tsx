"use client"

import { useState } from "react"
import { useLineageStore } from "@/store/lineage-store"
import { cn } from "@/lib/utils"
import type { PlaceType, OrgType, EventType } from "@/types"

type AddEntityType = "place" | "board" | "org" | "event"

interface AddEntityModalProps {
  entityType: AddEntityType
  initialName?: string
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

export function AddEntityModal({ entityType, initialName = "", onClose, onAdded }: AddEntityModalProps) {
  const { addUserPlace, addUserBoard, addUserOrg, addUserEvent, activePersonId } = useLineageStore()

  // Shared
  const [name, setName] = useState(initialName)

  // Place fields
  const [placeType, setPlaceType] = useState<PlaceType>("resort")
  const [region, setRegion] = useState("")
  const [country, setCountry] = useState("")

  // Board fields
  const [brand, setBrand] = useState(initialName)
  const [model, setModel] = useState("")
  const [modelYear, setModelYear] = useState<number>(new Date().getFullYear())

  // Org fields
  const [orgType, setOrgType] = useState<OrgType>("shop")

  // Event fields
  const [eventType, setEventType] = useState<EventType>("contest")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [description, setDescription] = useState("")

  const canSubmit = () => {
    if (entityType === "place") return name.trim().length > 0
    if (entityType === "board") return brand.trim().length > 0 && model.trim().length > 0
    if (entityType === "org") return name.trim().length > 0
    if (entityType === "event") return name.trim().length > 0 && startDate.length > 0
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
        community_status: "unverified",
        added_by: activePersonId,
      })
      onAdded(id)
    } else if (entityType === "event") {
      const id = generateId("event")
      addUserEvent({
        id,
        name: name.trim(),
        event_type: eventType,
        start_date: startDate,
        end_date: endDate || startDate, // default end = start for single-day events
        description: description.trim() || undefined,
        community_status: "unverified",
        added_by: activePersonId,
      })
      onAdded(id)
    }
  }

  const titles: Record<AddEntityType, string> = {
    place: "Add a new place",
    board: "Add a new board",
    org: "Add a shop, brand, or team",
    event: "Add a new event",
  }

  const subtitles: Record<AddEntityType, string> = {
    place: "It'll be marked as unverified until the community confirms it.",
    board: "It'll be marked as unverified until the community confirms it.",
    org: "It'll be marked as unverified until the community confirms it.",
    event: "It'll be marked as unverified until the community confirms it.",
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative w-full max-w-md bg-[#111] border border-[#2a2a2a] rounded-2xl p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-5">
          <h2 className="text-lg font-bold text-white">{titles[entityType]}</h2>
          <p className="text-xs text-zinc-500 mt-1">{subtitles[entityType]}</p>
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
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
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
                <Field label="Start date" required>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value)
                      // auto-set end date if not set
                      if (!endDate) setEndDate(e.target.value)
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
              <Field label="Description">
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description (optional)"
                  className={inputCls}
                />
              </Field>
            </>
          )}
        </div>

        {/* Unverified notice */}
        <div className="mt-4 flex items-center gap-2 px-3 py-2 bg-amber-950/30 border border-amber-800/30 rounded-lg">
          <span className="text-amber-400 text-xs">◎</span>
          <span className="text-xs text-amber-300/70">Will be added as <strong className="text-amber-300">unverified</strong> — others can confirm it</span>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm text-zinc-400 hover:text-white border border-[#2a2a2a] hover:border-zinc-600 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit()}
            className={cn(
              "flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
              canSubmit()
                ? "bg-blue-600 text-white hover:bg-blue-500"
                : "bg-[#1e1e1e] text-zinc-600 cursor-not-allowed"
            )}
          >
            Add to my lineage
          </button>
        </div>
      </div>
    </div>
  )
}

const inputCls =
  "w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500"

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-zinc-500 mb-1.5">
        {label}{required && <span className="text-blue-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}
