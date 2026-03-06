"use client"

import { useState } from "react"
import { useLineageStore } from "@/store/lineage-store"
import { cn } from "@/lib/utils"
import { PREDICATE_ICONS, PREDICATE_LABELS } from "@/lib/utils"
import { PLACES, ORGS, BOARDS, PEOPLE, EVENTS } from "@/lib/mock-data"
import { AddEntityModal } from "@/components/ui/add-entity-modal"
import type { Predicate, EntityType, ConfidenceLevel, PrivacyLevel } from "@/types"

// Which entity type each predicate points to
const PREDICATE_ENTITY_TYPE: Record<Predicate, EntityType> = {
  rode_at: "place",
  worked_at: "place",
  competed_at: "event",
  spectated_at: "event",
  organized_at: "event",
  sponsored_by: "org",
  part_of_team: "org",
  rode_with: "person",
  shot_by: "person",
  coached_by: "person",
  owned_board: "board",
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
    predicates: ["sponsored_by", "part_of_team"],
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
        <div className="relative w-full max-w-lg bg-[#111] border border-[#2a2a2a] rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="px-6 pt-5 pb-4 border-b border-[#1e1e1e] flex-shrink-0">
            <h2 className="text-base font-bold text-white">Add to your lineage</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Build your snowboarding history, one claim at a time</p>
          </div>

          <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
            {/* Section 1: Predicate */}
            <div>
              <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">What happened?</div>
              <div className="space-y-2">
                {PREDICATE_GROUPS.map((group) => (
                  <div key={group.label}>
                    <div className="text-[10px] text-zinc-700 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
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
                              : "border-[#2a2a2a] text-zinc-400 hover:border-zinc-600 hover:text-white"
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
                <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">
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
                      className="text-xs text-zinc-600 hover:text-white transition-colors flex-shrink-0 ml-2"
                    >
                      change
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      autoFocus
                      type="text"
                      value={entityQuery}
                      onChange={(e) => setEntityQuery(e.target.value)}
                      placeholder={`Search ${entityType === "person" ? "riders" : entityType + "s"}…`}
                      className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500"
                    />
                    {entityQuery.length > 0 && (
                      <div className="mt-1.5 max-h-44 overflow-y-auto rounded-lg border border-[#2a2a2a] divide-y divide-[#1a1a1a]">
                        {filteredEntities.slice(0, 8).map((item) => {
                          const e = item as unknown as Record<string, unknown>
                          const dateRange = getEventDateRange(e)
                          return (
                            <button
                              key={String(e.id)}
                              onClick={() => { setEntityId(String(e.id)); setEntityQuery("") }}
                              className="w-full text-left px-3 py-2.5 text-sm text-zinc-300 hover:bg-[#1a1a1a] transition-colors flex items-center justify-between gap-2"
                            >
                              <div>
                                <div>{getEntityLabel(e)}</div>
                                {dateRange && <div className="text-[11px] text-zinc-600 mt-0.5">{dateRange}</div>}
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
                            className="w-full text-left px-3 py-2.5 text-sm text-blue-400 hover:bg-[#1a1a1a] transition-colors flex items-center gap-2"
                          >
                            <span className="font-bold">+</span>
                            Add &ldquo;{entityQuery.trim()}&rdquo; as a new {currentGroup.addEntityLabel}
                          </button>
                        )}
                        {filteredEntities.length === 0 && !currentGroup?.addEntityType && (
                          <div className="px-3 py-2.5 text-xs text-zinc-600">No results</div>
                        )}
                      </div>
                    )}
                    {entityQuery.length === 0 && (
                      <div className="mt-1.5 max-h-44 overflow-y-auto rounded-lg border border-[#2a2a2a] divide-y divide-[#1a1a1a]">
                        {getEntityList().slice(0, 8).map((item) => {
                          const e = item as unknown as Record<string, unknown>
                          const dateRange = getEventDateRange(e)
                          return (
                            <button
                              key={String(e.id)}
                              onClick={() => { setEntityId(String(e.id)); setEntityQuery("") }}
                              className="w-full text-left px-3 py-2.5 text-sm text-zinc-300 hover:bg-[#1a1a1a] transition-colors"
                            >
                              <div>{getEntityLabel(e)}</div>
                              {dateRange && <div className="text-[11px] text-zinc-600 mt-0.5">{dateRange}</div>}
                            </button>
                          )
                        })}
                        {currentGroup?.addEntityType && (
                          <button
                            onClick={() => setShowAddEntity(true)}
                            className="w-full text-left px-3 py-2.5 text-sm text-blue-400 hover:bg-[#1a1a1a] transition-colors flex items-center gap-2"
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
                <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">When?</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-600 mb-1.5">Start year <span className="text-blue-500">*</span></label>
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
                    <label className="block text-xs text-zinc-600 mb-1.5">End year <span className="text-zinc-700">(optional)</span></label>
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
                  className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors flex items-center gap-1"
                >
                  <span>{showDetails ? "▾" : "▸"}</span>
                  {showDetails ? "Hide details" : "Add confidence, visibility & note"}
                </button>

                {showDetails && (
                  <div className="mt-3 space-y-4">
                    {/* Confidence */}
                    <div>
                      <label className="block text-xs text-zinc-600 mb-2">Confidence</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {(["self-reported", "corroborated", "documented", "partner-verified"] as ConfidenceLevel[]).map((c) => (
                          <button
                            key={c}
                            onClick={() => setConfidence(c)}
                            className={cn(
                              "text-left px-3 py-2 rounded-lg border text-xs transition-all",
                              confidence === c
                                ? "border-blue-500 bg-blue-950/40 text-blue-200"
                                : "border-[#2a2a2a] text-zinc-500 hover:border-zinc-600 hover:text-white"
                            )}
                          >
                            {c.replace("-", " ")}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Visibility */}
                    <div>
                      <label className="block text-xs text-zinc-600 mb-2">Visibility</label>
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
                                : "border-[#2a2a2a] text-zinc-500 hover:border-zinc-600 hover:text-white"
                            )}
                          >
                            <span>{icon}</span> {v}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Note */}
                    <div>
                      <label className="block text-xs text-zinc-600 mb-1.5">Note <span className="text-zinc-700">(optional)</span></label>
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
          <div className="px-6 py-4 border-t border-[#1e1e1e] flex gap-3 flex-shrink-0">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm text-zinc-400 hover:text-white border border-[#2a2a2a] hover:border-zinc-600 transition-all"
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
                  : "bg-[#1e1e1e] text-zinc-600 cursor-not-allowed"
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

const inputCls =
  "w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500"
