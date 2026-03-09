"use client"

import Link from "next/link"
import { useLineageStore } from "@/store/lineage-store"
import { getEntityName, getBoardById, getPlaceById, boardSlug, placeSlug } from "@/lib/mock-data"
import type { Person, Claim } from "@/types"

interface StartCardProps {
  person: Person
  claims: Claim[]
}

function yearOf(dateStr?: string): number {
  if (!dateStr) return Infinity
  const y = parseInt(dateStr.substring(0, 4))
  return isNaN(y) ? Infinity : y
}

export function StartCard({ person, claims }: StartCardProps) {
  const { userEntities } = useLineageStore()

  if (!person.riding_since) return null

  // Resolve entity name from userEntities first, then mock data
  function resolveEntityName(id: string, type: string): string {
    // Check user-created entities
    const allUserEntities = [
      ...userEntities.places,
      ...userEntities.boards,
      ...userEntities.orgs,
      ...userEntities.events,
    ]
    const ue = allUserEntities.find((e) => e.id === id)
    if (ue) {
      if ("brand" in ue) return `${(ue as { brand: string; model: string }).brand} ${(ue as { brand: string; model: string }).model}`
      if ("name" in ue) return (ue as { name: string }).name
    }
    return getEntityName(id, type as Parameters<typeof getEntityName>[1])
  }

  // Earliest owned_board claim
  const firstBoardClaim = claims
    .filter((c) => c.predicate === "owned_board")
    .sort((a, b) => yearOf(a.start_date) - yearOf(b.start_date))[0] ?? null

  // Earliest rode_at claim
  const firstPlaceClaim = claims
    .filter((c) => c.predicate === "rode_at" && c.object_type === "place")
    .sort((a, b) => yearOf(a.start_date) - yearOf(b.start_date))[0] ?? null

  // Get richer detail for the board (brand + model) using mock lookup
  const boardDetail = firstBoardClaim ? getBoardById(firstBoardClaim.object_id) : null
  const placeDetail = firstPlaceClaim ? getPlaceById(firstPlaceClaim.object_id) : null

  const boardName = boardDetail
    ? `${boardDetail.brand} ${boardDetail.model}`
    : firstBoardClaim
    ? resolveEntityName(firstBoardClaim.object_id, firstBoardClaim.object_type)
    : null

  const placeName = placeDetail?.name
    ?? (firstPlaceClaim ? resolveEntityName(firstPlaceClaim.object_id, firstPlaceClaim.object_type) : null)

  return (
    <div className="bg-[#111] border border-[#1e1e1e] border-l-2 border-l-zinc-500 rounded-xl p-4 mb-4">
      <div className="flex items-start gap-3">
        <span className="text-lg shrink-0 mt-0.5">🏂</span>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">Origin</div>
          <div className="font-semibold text-white text-sm leading-snug">
            Started snowboarding in {person.riding_since}
          </div>

          {(boardName || placeName) && (
            <div className="mt-3 space-y-2">
              {boardName && firstBoardClaim && (
                <div className="flex items-center gap-2.5">
                  <span className="text-[10px] text-zinc-600 w-[72px] shrink-0 leading-none">First board</span>
                  <Link href={boardDetail ? `/boards/${boardSlug(boardDetail)}` : `/boards/${firstBoardClaim.object_id}`}>
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-zinc-300 hover:border-zinc-500 hover:text-white transition-all">
                      🏂 {boardName}
                      {boardDetail && (
                        <span className="text-zinc-600">
                          &nbsp;&apos;{String(boardDetail.model_year).slice(2)}
                        </span>
                      )}
                    </span>
                  </Link>
                </div>
              )}
              {placeName && firstPlaceClaim && (
                <div className="flex items-center gap-2.5">
                  <span className="text-[10px] text-zinc-600 w-[72px] shrink-0 leading-none">First mountain</span>
                  <Link href={(() => { const p = getPlaceById(firstPlaceClaim.object_id); return p ? `/places/${placeSlug(p)}` : `/places/${firstPlaceClaim.object_id}` })()}>
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-zinc-300 hover:border-zinc-500 hover:text-white transition-all">
                      🏔 {placeName}
                    </span>
                  </Link>
                </div>
              )}
            </div>
          )}

          {!boardName && !placeName && (
            <p className="text-xs text-zinc-600 mt-2">
              Add your first board and mountain to complete your origin story.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
