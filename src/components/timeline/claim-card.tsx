"use client"

import { useState } from "react"
import type { Claim } from "@/types"
import { ConfidenceBadge, UnverifiedBadge } from "@/components/ui/badge"
import { PREDICATE_ICONS, PREDICATE_LABELS, formatDateRange } from "@/lib/utils"
import { getEntityName } from "@/lib/mock-data"
import { useLineageStore } from "@/store/lineage-store"
import { EditClaimModal } from "@/components/ui/edit-claim-modal"
import Link from "next/link"

const PLACE_PREDICATES = ["rode_at", "worked_at", "competed_at"]
const ORG_PREDICATES = ["sponsored_by", "part_of_team", "shot_by", "coached_by"]

function entityHref(id: string, type: string) {
  if (type === "place") return `/places/${id}`
  if (type === "person") return `/riders/${id}`
  if (type === "org") return `/orgs/${id}`
  if (type === "board") return `/boards/${id}`
  if (type === "event") return `/events/${id}`
  return "#"
}

export function ClaimCard({ claim, isOwn }: { claim: Claim; isOwn?: boolean }) {
  const { userEntities, removeClaim } = useLineageStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const icon = PREDICATE_ICONS[claim.predicate] ?? "•"
  const label = PREDICATE_LABELS[claim.predicate] ?? claim.predicate
  const dateRange = formatDateRange(claim.start_date, claim.end_date)
  const href = entityHref(claim.object_id, claim.object_type)

  const isLinked = true // all entity types now have detail pages

  // Check if the referenced entity is user-created and unverified
  const allUserEntities = [
    ...userEntities.places,
    ...userEntities.boards,
    ...userEntities.orgs,
  ]
  const userEntity = allUserEntities.find((e) => e.id === claim.object_id)
  const isUnverified = userEntity?.community_status === "unverified"

  // For user-created entities, build the name from what we have
  const entityName = userEntity
    ? ("brand" in userEntity
        ? `${userEntity.brand} ${userEntity.model} '${String(userEntity.model_year).slice(2)}`
        : userEntity.name)
    : getEntityName(claim.object_id, claim.object_type)

  return (
    <>
      {editing && (
        <EditClaimModal
          claim={claim}
          entityName={entityName}
          onClose={() => setEditing(false)}
        />
      )}

      <div className="relative pl-10 pb-5 timeline-line last:pb-0 group">
        {/* Icon dot */}
        <div className="absolute left-0 top-1 w-8 h-8 rounded-full bg-[#1c1c1c] border border-[#2a2a2a] flex items-center justify-center text-sm z-10">
          {icon}
        </div>

        <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-4 hover:border-[#2a2a2a] transition-colors">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-zinc-500">{label}</span>
                {isLinked ? (
                  <Link
                    href={href}
                    className="font-medium text-white hover:text-blue-400 transition-colors truncate"
                  >
                    {entityName}
                  </Link>
                ) : (
                  <span className="font-medium text-white truncate">{entityName}</span>
                )}
              </div>

              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <span className="text-xs text-zinc-500">{dateRange}</span>
                <ConfidenceBadge level={claim.confidence} />
                {isUnverified && <UnverifiedBadge />}
                {claim.sources && claim.sources.length > 0 && (
                  <span className="text-[10px] text-zinc-600 flex items-center gap-1">
                    📎 {claim.sources.length} source{claim.sources.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {claim.note && (
                <p className="mt-2 text-xs text-zinc-500 leading-relaxed">{claim.note}</p>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {claim.visibility === "private" && (
                <span className="text-xs text-zinc-700" title="Private">🔒</span>
              )}
              {claim.visibility === "shared" && (
                <span className="text-xs text-zinc-600" title="Shared">👥</span>
              )}

              {/* Edit/delete menu — only shown on own timeline */}
              {isOwn && (
                <div className="relative">
                  <button
                    onClick={() => { setMenuOpen((o) => !o); setConfirmDelete(false) }}
                    className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded text-zinc-600 hover:text-white hover:bg-[#2a2a2a] transition-all text-sm"
                    title="Options"
                  >
                    ⋯
                  </button>

                  {menuOpen && (
                    <>
                      {/* Click-away backdrop */}
                      <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                      <div className="absolute right-0 top-7 z-20 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl overflow-hidden w-36">
                        {!confirmDelete ? (
                          <>
                            <button
                              onClick={() => { setMenuOpen(false); setEditing(true) }}
                              className="w-full text-left px-4 py-2.5 text-xs text-zinc-300 hover:bg-[#222] hover:text-white transition-colors flex items-center gap-2"
                            >
                              <span>✏️</span> Edit
                            </button>
                            <button
                              onClick={() => setConfirmDelete(true)}
                              className="w-full text-left px-4 py-2.5 text-xs text-red-400 hover:bg-[#222] hover:text-red-300 transition-colors flex items-center gap-2"
                            >
                              <span>🗑</span> Delete
                            </button>
                          </>
                        ) : (
                          <div className="px-3 py-3">
                            <p className="text-xs text-zinc-400 mb-2">Remove this claim?</p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setConfirmDelete(false)}
                                className="flex-1 px-2 py-1.5 text-xs rounded border border-[#2a2a2a] text-zinc-500 hover:text-white transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => { removeClaim(claim.id); setMenuOpen(false) }}
                                className="flex-1 px-2 py-1.5 text-xs rounded bg-red-900 text-red-200 hover:bg-red-800 transition-colors font-medium"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
