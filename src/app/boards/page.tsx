"use client"

import { useState, useMemo } from "react"
import { Nav } from "@/components/ui/nav"
import { BOARDS, CLAIMS, getPersonById } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import Link from "next/link"
import type { Board } from "@/types"

type ShapeFilter = "all" | "twin" | "directional" | "powder" | "directional-twin"

const SHAPE_FILTERS: { value: ShapeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "twin", label: "Twin" },
  { value: "directional", label: "Directional" },
  { value: "powder", label: "Powder" },
  { value: "directional-twin", label: "Directional-twin" },
]

function getRiderIds(boardId: string): string[] {
  return [
    ...new Set(
      CLAIMS.filter((c) => c.object_id === boardId && c.predicate === "owned_board").map(
        (c) => c.subject_id
      )
    ),
  ]
}

function AvatarStack({ riderIds }: { riderIds: string[] }) {
  const shown = riderIds.slice(0, 3)
  const extra = riderIds.length - shown.length
  if (shown.length === 0) return null
  return (
    <div className="flex items-center">
      {shown.map((rid, i) => {
        const person = getPersonById(rid)
        if (!person) return null
        return (
          <div
            key={rid}
            style={{ marginLeft: i === 0 ? 0 : -6 }}
            className="w-5 h-5 rounded-full bg-blue-600 border border-[#111] flex items-center justify-center text-[8px] font-bold text-white"
            title={person.display_name}
          >
            {person.display_name[0]}
          </div>
        )
      })}
      {extra > 0 && (
        <div
          style={{ marginLeft: -6 }}
          className="w-5 h-5 rounded-full bg-[#2a2a2a] border border-[#111] flex items-center justify-center text-[8px] text-zinc-400"
        >
          +{extra}
        </div>
      )}
    </div>
  )
}

function BoardCard({ board }: { board: Board }) {
  const riderIds = getRiderIds(board.id)

  return (
    <Link href={`/boards/${board.id}`}>
      <div className="bg-[#111] border border-[#1e1e1e] border-l-2 border-l-emerald-700 rounded-xl p-4 hover:border-[#2a2a2a] transition-colors">
        <div className="flex items-center gap-3">
          <span className="text-xl shrink-0">🏂</span>
          <div className="min-w-0 flex-1">
            <div className="font-medium text-white text-sm leading-snug">
              {board.brand} {board.model}
            </div>
            <div className="text-xs text-zinc-500 mt-0.5">
              &apos;{String(board.model_year).slice(2)}
              {board.shape && (
                <span className="text-zinc-700 capitalize">
                  {" "}· {board.shape.replace("-", " ")}
                </span>
              )}
            </div>
          </div>
          {riderIds.length > 0 && (
            <div className="shrink-0 flex flex-col items-end gap-1">
              <AvatarStack riderIds={riderIds} />
              <div className="text-[10px] text-zinc-600">
                {riderIds.length} rider{riderIds.length !== 1 ? "s" : ""}
              </div>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

export default function BoardsPage() {
  const [filter, setFilter] = useState<ShapeFilter>("all")

  const filteredBoards = useMemo(
    () => (filter === "all" ? BOARDS : BOARDS.filter((b) => b.shape === filter)),
    [filter]
  )

  const brands = useMemo(
    () => [...new Set(filteredBoards.map((b) => b.brand))].sort(),
    [filteredBoards]
  )

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Nav />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-white">Boards</h1>
          <p className="text-sm text-zinc-500 mt-1">The shapes that shaped the scene</p>
        </div>

        {/* Shape filter chips */}
        <div className="flex flex-wrap gap-2 mb-8">
          {SHAPE_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                filter === value
                  ? "bg-white text-black border-white"
                  : "bg-transparent text-zinc-500 border-[#2a2a2a] hover:border-zinc-500 hover:text-zinc-300"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Brand groups */}
        <div className="space-y-8">
          {brands.length === 0 ? (
            <div className="text-sm text-zinc-600 text-center py-12 border border-dashed border-[#2a2a2a] rounded-xl">
              No boards found for this filter
            </div>
          ) : (
            brands.map((brand) => {
              const brandBoards = filteredBoards
                .filter((b) => b.brand === brand)
                .sort((a, b) => b.model_year - a.model_year)

              return (
                <div key={brand}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-7 h-7 rounded bg-[#1e1e1e] border border-[#2a2a2a] flex items-center justify-center text-xs font-bold text-zinc-500 shrink-0">
                      {brand[0]}
                    </div>
                    <h2 className="text-sm font-semibold text-zinc-300">{brand}</h2>
                    <div className="flex-1 h-px bg-[#1e1e1e]" />
                    <span className="text-[10px] text-zinc-600">
                      {brandBoards.length} model{brandBoards.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {brandBoards.map((board) => (
                      <BoardCard key={board.id} board={board} />
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
