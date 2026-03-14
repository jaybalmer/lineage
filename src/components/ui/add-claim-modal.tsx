"use client"

import { useState, useRef, useEffect } from "react"
import { useLineageStore } from "@/store/lineage-store"
import { cn } from "@/lib/utils"
import { PREDICATE_ICONS, PREDICATE_LABELS } from "@/lib/utils"
import { PLACES, ORGS, BOARDS, PEOPLE, EVENTS } from "@/lib/mock-data"
import { AddEntityModal } from "@/components/ui/add-entity-modal"
import type { Predicate, EntityType, ConfidenceLevel, PrivacyLevel, Board } from "@/types"

const inputCls =
  "w-full bg-background border border-border-default rounded-lg px-3 py-2.5 text-sm text-foreground placeholder-zinc-600 focus:outline-none focus:border-blue-500"

// ─── Board Picker ─────────────────────────────────────────────────────────────

type BoardStep = "brand" | "model" | "year"

interface BoardPickerProps {
  allBoards: Board[]
  onSelect: (boardId: string) => void
}

function BoardPicker({ allBoards, onSelect }: BoardPickerProps) {
  const { addUserBoard } = useLineageStore()
  const [step, setStep] = useState<BoardStep>("brand")
  const [brand, setBrand] = useState("")
  const [model, setModel] = useState("")
  const [query, setQuery] = useState("")
  const [customYear, setCustomYear] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [step])

  const uniqueBrands = [...new Set(allBoards.map((b) => b.brand))].sort()
  const filteredBrands = uniqueBrands.filter((b) =>
    b.toLowerCase().includes(query.toLowerCase())
  )

  const modelsForBrand = [...new Set(
    allBoards.filter((b) => b.brand === brand).map((b) => b.model)
  )].sort()
  const filteredModels = modelsForBrand.filter((m) =>
    m.toLowerCase().includes(query.toLowerCase())
  )

  const yearsForPair = allBoards
    .filter((b) => b.brand === brand && b.model === model)
    .map((b) => b.model_year)
    .sort((a, z) => z - a)

  function pickBrand(b: string) {
    setBrand(b); setModel(""); setQuery(""); setStep("model")
  }

  function pickModel(m: string) {
    setModel(m); setQuery(""); setStep("year")
  }

  function pickYear(year: number) {
    const existing = allBoards.find(
      (b) => b.brand === brand && b.model === model && b.model_year === year
    )
    if (existing) {
      onSelect(existing.id)
    } else {
      const id = `board_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`
      addUserBoard({ id, brand, model, model_year: year })
      onSelect(id)
    }
  }

  function handleCustomYear() {
    const y = parseInt(customYear)
    if (y >= 1965 && y <= new Date().getFullYear() + 2) pickYear(y)
  }

  const breadcrumbs = (
    <div className="flex items-center gap-1.5 text-[11px] text-muted mb-3 flex-wrap">
      <button
        onClick={() => { setStep("brand"); setBrand(""); setModel(""); setQuery("") }}
        className={cn("hover:text-foreground transition-colors", step === "brand" ? "text-foreground font-medium" : "")}
      >
        Brand
      </button>
      {brand && (
        <>
          <span>/</span>
          <button
            onClick={() => { setStep("model"); setModel(""); setQuery("") }}
            className={cn("hover:text-foreground transition-colors", step === "model" ? "text-foreground font-medium" : "text-blue-400")}
          >
            {brand}
          </button>
        </>
      )}
      {model && (
        <>
          <span>/</span>
          <span className={cn(step === "year" ? "text-foreground font-medium" : "text-blue-400")}>{model}</span>
        </>
      )}
    </div>
  )

  if (step === "brand") return (
    <div>
      {breadcrumbs}
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter brands…"
        className={inputCls}
      />
      <div className="mt-1.5 max-h-52 overflow-y-auto rounded-lg border border-border-default divide-y divide-[#1a1a1a]">
        {filteredBrands.map((b) => (
          <button
            key={b}
            onClick={() => pickBrand(b)}
            className="w-full text-left px-3 py-2.5 text-sm text-muted hover:bg-surface-hover hover:text-foreground transition-colors flex items-center justify-between"
          >
            <span>{b}</span>
            <span className="text-xs text-muted/60">
              {[...new Set(allBoards.filter((bd) => bd.brand === b).map((bd) => bd.model))].length} models
            </span>
          </button>
        ))}
        {query.trim() && !uniqueBrands.some((b) => b.toLowerCase() === query.trim().toLowerCase()) && (
          <button
            onClick={() => pickBrand(query.trim())}
            className="w-full text-left px-3 py-2.5 text-sm text-blue-400 hover:bg-surface-hover transition-colors flex items-center gap-2"
          >
            <span className="font-bold">+</span> Add &ldquo;{query.trim()}&rdquo; as a new brand
          </button>
        )}
        {filteredBrands.length === 0 && !query.trim() && (
          <div className="px-3 py-2.5 text-xs text-muted">No brands found</div>
        )}
      </div>
    </div>
  )

  if (step === "model") return (
    <div>
      {breadcrumbs}
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`Filter ${brand} models…`}
        className={inputCls}
      />
      <div className="mt-1.5 max-h-52 overflow-y-auto rounded-lg border border-border-default divide-y divide-[#1a1a1a]">
        {filteredModels.map((m) => (
          <button
            key={m}
            onClick={() => pickModel(m)}
            className="w-full text-left px-3 py-2.5 text-sm text-muted hover:bg-surface-hover hover:text-foreground transition-colors flex items-center justify-between"
          >
            <span>{m}</span>
            <span className="text-xs text-muted/60">
              {allBoards.filter((b) => b.brand === brand && b.model === m).map((b) => `'${String(b.model_year).slice(2)}`).join(", ")}
            </span>
          </button>
        ))}
        {query.trim() && !modelsForBrand.some((m) => m.toLowerCase() === query.trim().toLowerCase()) && (
          <button
            onClick={() => pickModel(query.trim())}
            className="w-full text-left px-3 py-2.5 text-sm text-blue-400 hover:bg-surface-hover transition-colors flex items-center gap-2"
          >
            <span className="font-bold">+</span> Add &ldquo;{query.trim()}&rdquo; as a new {brand} model
          </button>
        )}
        {modelsForBrand.length === 0 && !query.trim() && (
          <div className="px-3 py-2.5 text-xs text-muted">
            No models yet — type to add the first one
          </div>
        )}
      </div>
    </div>
  )

  // step === "year"
  return (
    <div>
      {breadcrumbs}
      <div className="max-h-52 overflow-y-auto rounded-lg border border-border-default divide-y divide-[#1a1a1a]">
        {yearsForPair.map((y) => (
          <button
            key={y}
            onClick={() => pickYear(y)}
            className="w-full text-left px-3 py-2.5 text-sm text-muted hover:bg-surface-hover hover:text-foreground transition-colors"
          >
            {y}
          </button>
        ))}
        <div className="px-3 py-2.5 flex items-center gap-2">
          <input
            ref={inputRef}
            type="number"
            value={customYear}
            onChange={(e) => setCustomYear(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCustomYear()}
            placeholder="Different year…"
            min={1965}
            max={new Date().getFullYear() + 2}
            className="flex-1 bg-background border border-border-default rounded-lg px-2.5 py-1.5 text-sm text-foreground placeholder-zinc-600 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleCustomYear}
            disabled={!customYear || parseInt(customYear) < 1965}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              customYear && parseInt(customYear) >= 1965
                ? "bg-blue-600 text-white hover:bg-blue-500"
                : "bg-surface-active text-muted cursor-not-allowed"
            )}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}

// Which entity type each predicate points to
const PREDICATE_ENTITY_TYPE: Record<Predicate, EntityType> = {
  rode_at: "place",
  worked_at: "place",
  competed_at: "event",
  spectated_at: "event",
  organized_at: "event",
  sponsored_by: "org",
  part_of_team: "org",
  fan_of: "org",
  rode_with: "person",
  shot_by: "person",
  coached_by: "person",
  owned_board: "board",
  organized: "event",
  located_at: "place",
}

type PredicateGroup = {
  label: string
  icon: string
  predicates: Predicate[]
  addEntityType?: "place" | "board" | "org" | "event"
  addEntityLabel?: string
}

const PREDICATE_GROUPS: PredicateGroup[] = [
  {
    label: "Places",
    icon: "🏔",
    predicates: ["rode_at", "worked_at"],
    addEntityType: "place",
    addEntityLabel: "place",
  },
  {
    label: "People",
    icon: "👥",
    predicates: ["rode_with", "coached_by", "shot_by"],
  },
  {
    label: "Gear",
    icon: "🏂",
    predicates: ["owned_board"],
    addEntityType: "board",
    addEntityLabel: "board",
  },
  {
    label: "Orgs",
    icon: "🎽",
    predicates: ["fan_of", "sponsored_by", "part_of_team"],
    addEntityType: "org",
    addEntityLabel: "shop/brand/team",
  },
  {
    label: "Events",
    icon: "🏆",
    predicates: ["competed_at", "spectated_at", "organized_at"],
    addEntityType: "event",
    addEntityLabel: "event",
  },
]

// Map timeline filter → default predicate
const FILTER_DEFAULT_PREDICATE: Record<string, Predicate | null> = {
  all: null,
  places: "rode_at",
  gear: "owned_board",
  people: "rode_with",
  orgs: "sponsored_by",
  events: "competed_at",
}

function generateId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

function yearToDate(year: string): string | undefined {
  if (!year || year.length < 4) return undefined
  return `${year}-01-01`
}

interface AddClaimModalProps {
  defaultFilter?: string
  onClose: () => void
}

export function AddClaimModal({ defaultFilter = "all", onClose }: AddClaimModalProps) {
  const { activePersonId, addClaim, userEntities } = useLineageStore()

  const defaultPredicate = FILTER_DEFAULT_PREDICATE[defaultFilter] ?? null
  const [predicate, setPredicate] = useState<Predicate | null>(defaultPredicate)
  const [entityId, setEntityId] = useState<string | null>(null)
  const [entityQuery, setEntityQuery] = useState("")
  const [startYear, setStartYear] = useState("")
  const [endYear, setEndYear] = useState("")
  const [confidence, setConfidence] = useState<ConfidenceLevel>("self-reported")
  const [visibility, setVisibility] = useState<PrivacyLevel>("private")
  const [note, setNote] = useState("")
  const [showAddEntity, setShowAddEntity] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  const entityType = predicate ? PREDICATE_ENTITY_TYPE[predicate] : null

  // Get the entity list based on type
  const getEntityList = () => {
    if (!entityType) return []
    switch (entityType) {
      case "place": return [...PLACES, ...userEntities.places]
      case "org": return [...ORGS, ...userEntities.orgs]
      case "board": return [...BOARDS, ...userEntities.boards]
      case "person": return PEOPLE.filter((p) => p.id !== activePersonId)
      case "event": return [...EVENTS, ...userEntities.events]
      default: return []
    }
  }

  const getEntityLabel = (item: unknown): string => {
    const r = item as Record<string, unknown>
    if (entityType === "board") {
      return `${r.brand} ${r.model} '${String(r.model_year).slice(2)}`
    }
    if (entityType === "person") return String(r.display_name ?? "")
    return String(r.name ?? "")
  }

  const getEventDateRange = (item: unknown): string | null => {
    const r = item as Record<string, unknown>
    if (entityType !== "event") return null
    const start = r.start_date as string | undefined
    const end = r.end_date as string | undefined
    if (!start) return null
    const fmt = (d: string) => {
      const [y, m, day] = d.split("-")
      return `${parseInt(day)} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(m)-1]} ${y}`
    }
    if (!end || end === start) return fmt(start)
    return `${fmt(start)} – ${fmt(end)}`
  }

  const currentGroup = predicate
    ? PREDICATE_GROUPS.find((g) => g.predicates.includes(predicate)) ?? null
    : null

  const filteredEntities = getEntityList().filter((e) =>
    getEntityLabel(e)
      .toLowerCase()
      .includes(entityQuery.toLowerCase())
  )

  const selectedEntity = entityId
    ? getEntityList().find((e) => (e as unknown as Record<string, unknown>).id === entityId) ?? null
    : null

  const canSave = predicate !== null && entityId !== null && startYear.length === 4

  const handleSave = () => {
    if (!predicate || !entityId || !canSave) return

    addClaim({
      id: generateId("claim"),
      subject_id: activePersonId,
      subject_type: "person",
      predicate,
      object_id: entityId,
      object_type: PREDICATE_ENTITY_TYPE[predicate],
      start_date: yearToDate(startYear)!,
      end_date: yearToDate(endYear),
      confidence,
      visibility,
      asserted_by: activePersonId,
      created_at: new Date().toISOString(),
      note: note.trim() || undefined,
    })
    onClose()
  }

  return (
    <>
      {showAddEntity && currentGroup?.addEntityType && (
        <AddEntityModal
          entityType={currentGroup.addEntityType}
          initialName={entityQuery}
          onClose={() => setShowAddEntity(false)}
          onAdded={(id) => {
            setEntityId(id)
            setEntityQuery("")
            setShowAddEntity(false)
          }}
        />
      )}

      <div
        className="fixed inset-0 z-40 flex items-center justify-center px-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative w-full max-w-lg bg-surface border border-border-default rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="px-6 pt-5 pb-4 border-b border-border-default flex-shrink-0">
            <h2 className="text-base font-bold text-foreground">Add to your lineage</h2>
            <p className="text-xs text-muted mt-0.5">Build your snowboarding history, one claim at a time</p>
          </div>

          <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
            {/* Section 1: Predicate */}
            <div>
              <div className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">What happened?</div>
              <div className="space-y-2">
                {PREDICATE_GROUPS.map((group) => (
                  <div key={group.label}>
                    <div className="text-[10px] text-muted uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                      <span>{group.icon}</span> {group.label}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {group.predicates.map((p) => (
                        <button
                          key={p}
                          onClick={() => {
                            setPredicate(p)
                            setEntityId(null)
                            setEntityQuery("")
                          }}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5",
                            predicate === p
                              ? "border-blue-500 bg-blue-950/50 text-blue-200"
                              : "border-border-default text-muted hover:border-border-default hover:text-foreground"
                          )}
                        >
                          <span>{PREDICATE_ICONS[p]}</span>
                          {PREDICATE_LABELS[p]}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 2: Entity search */}
            {predicate && (
              <div>
                <div className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">
                  {entityType === "place" && "Which place?"}
                  {entityType === "person" && "Which rider?"}
                  {entityType === "board" && "Which board?"}
                  {entityType === "org" && "Which org or brand?"}
                  {entityType === "event" && "Which event?"}
                </div>

                {selectedEntity ? (
                  <div className="flex items-center justify-between bg-blue-950/30 border border-blue-800/40 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-blue-400 text-sm flex-shrink-0">{PREDICATE_ICONS[predicate]}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-blue-200">
                            {getEntityLabel(selectedEntity)}
                          </span>
                          {(selectedEntity as unknown as Record<string, unknown>).community_status === "unverified" && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-400 border border-amber-800/40">◎ new</span>
                          )}
                        </div>
                        {getEventDateRange(selectedEntity) && (
                          <div className="text-[11px] text-blue-400/70 mt-0.5">
                            {getEventDateRange(selectedEntity)}
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => { setEntityId(null); setEntityQuery("") }}
                      className="text-xs text-muted hover:text-foreground transition-colors flex-shrink-0 ml-2"
                    >
                      change
                    </button>
                  </div>
                ) : entityType === "board" ? (
                  <BoardPicker
                    allBoards={[...BOARDS, ...userEntities.boards]}
                    onSelect={(id) => setEntityId(id)}
                  />
                ) : (
                  <div>
                    <input
                      autoFocus
                      type="text"
                      value={entityQuery}
                      onChange={(e) => setEntityQuery(e.target.value)}
                      placeholder={`Search ${entityType === "person" ? "riders" : entityType + "s"}…`}
                      className="w-full bg-background border border-border-default rounded-lg px-3 py-2.5 text-sm text-foreground placeholder-zinc-600 focus:outline-none focus:border-blue-500"
                    />
                    {entityQuery.length > 0 && (
                      <div className="mt-1.5 max-h-44 overflow-y-auto rounded-lg border border-border-default divide-y divide-[#1a1a1a]">
                        {filteredEntities.slice(0, 8).map((item) => {
                          const e = item as unknown as Record<string, unknown>
                          const dateRange = getEventDateRange(e)
                          return (
                            <button
                              key={String(e.id)}
                              onClick={() => { setEntityId(String(e.id)); setEntityQuery("") }}
                              className="w-full text-left px-3 py-2.5 text-sm text-muted hover:bg-surface-hover transition-colors flex items-center justify-between gap-2"
                            >
                              <div>
                                <div>{getEntityLabel(e)}</div>
                                {dateRange && <div className="text-[11px] text-muted mt-0.5">{dateRange}</div>}
                              </div>
                              {e.community_status === "unverified" && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-400 border border-amber-800/40 flex-shrink-0">◎ new</span>
                              )}
                            </button>
                          )
                        })}
                        {currentGroup?.addEntityType && (
                          <button
                            onClick={() => setShowAddEntity(true)}
                            className="w-full text-left px-3 py-2.5 text-sm text-blue-400 hover:bg-surface-hover transition-colors flex items-center gap-2"
                          >
                            <span className="font-bold">+</span>
                            Add &ldquo;{entityQuery.trim()}&rdquo; as a new {currentGroup.addEntityLabel}
                          </button>
                        )}
                        {filteredEntities.length === 0 && !currentGroup?.addEntityType && (
                          <div className="px-3 py-2.5 text-xs text-muted">No results</div>
                        )}
                      </div>
                    )}
                    {entityQuery.length === 0 && (
                      <div className="mt-1.5 max-h-44 overflow-y-auto rounded-lg border border-border-default divide-y divide-[#1a1a1a]">
                        {getEntityList().slice(0, 8).map((item) => {
                          const e = item as unknown as Record<string, unknown>
                          const dateRange = getEventDateRange(e)
                          return (
                            <button
                              key={String(e.id)}
                              onClick={() => { setEntityId(String(e.id)); setEntityQuery("") }}
                              className="w-full text-left px-3 py-2.5 text-sm text-muted hover:bg-surface-hover transition-colors"
                            >
                              <div>{getEntityLabel(e)}</div>
                              {dateRange && <div className="text-[11px] text-muted mt-0.5">{dateRange}</div>}
                            </button>
                          )
                        })}
                        {currentGroup?.addEntityType && (
                          <button
                            onClick={() => setShowAddEntity(true)}
                            className="w-full text-left px-3 py-2.5 text-sm text-blue-400 hover:bg-surface-hover transition-colors flex items-center gap-2"
                          >
                            <span className="font-bold">+</span>
                            Add a new {currentGroup.addEntityLabel}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Section 3: When */}
            {predicate && entityId && (
              <div>
                <div className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">When?</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-muted mb-1.5">Start year <span className="text-blue-500">*</span></label>
                    <input
                      autoFocus
                      type="number"
                      value={startYear}
                      onChange={(e) => setStartYear(e.target.value)}
                      placeholder="e.g. 2003"
                      min={1965}
                      max={2030}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted mb-1.5">End year <span className="text-muted">(optional)</span></label>
                    <input
                      type="number"
                      value={endYear}
                      onChange={(e) => setEndYear(e.target.value)}
                      placeholder="present"
                      min={1965}
                      max={2030}
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Section 4: Details (collapsible) */}
            {predicate && entityId && startYear.length === 4 && (
              <div>
                <button
                  onClick={() => setShowDetails((v) => !v)}
                  className="text-xs text-muted hover:text-foreground transition-colors flex items-center gap-1"
                >
                  <span>{showDetails ? "▾" : "▸"}</span>
                  {showDetails ? "Hide details" : "Add confidence, visibility & note"}
                </button>

                {showDetails && (
                  <div className="mt-3 space-y-4">
                    {/* Confidence */}
                    <div>
                      <label className="block text-xs text-muted mb-2">Confidence</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {(["self-reported", "corroborated", "documented", "partner-verified"] as ConfidenceLevel[]).map((c) => (
                          <button
                            key={c}
                            onClick={() => setConfidence(c)}
                            className={cn(
                              "text-left px-3 py-2 rounded-lg border text-xs transition-all",
                              confidence === c
                                ? "border-blue-500 bg-blue-950/40 text-blue-200"
                                : "border-border-default text-muted hover:border-border-default hover:text-foreground"
                            )}
                          >
                            {c.replace("-", " ")}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Visibility */}
                    <div>
                      <label className="block text-xs text-muted mb-2">Visibility</label>
                      <div className="flex gap-2">
                        {([
                          { v: "private", icon: "🔒" },
                          { v: "shared", icon: "👥" },
                          { v: "public", icon: "🌐" },
                        ] as { v: PrivacyLevel; icon: string }[]).map(({ v, icon }) => (
                          <button
                            key={v}
                            onClick={() => setVisibility(v)}
                            className={cn(
                              "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs transition-all",
                              visibility === v
                                ? "border-blue-500 bg-blue-950/40 text-blue-200"
                                : "border-border-default text-muted hover:border-border-default hover:text-foreground"
                            )}
                          >
                            <span>{icon}</span> {v}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Note */}
                    <div>
                      <label className="block text-xs text-muted mb-1.5">Note <span className="text-muted">(optional)</span></label>
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Any context about this claim…"
                        rows={2}
                        className={cn(inputCls, "resize-none")}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border-default flex gap-3 flex-shrink-0">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm text-muted hover:text-foreground border border-border-default hover:border-border-default transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className={cn(
                "flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
                canSave
                  ? "bg-blue-600 text-white hover:bg-blue-500"
                  : "bg-surface-active text-muted cursor-not-allowed"
              )}
            >
              Add to lineage
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

