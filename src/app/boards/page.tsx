"use client"

import { useState, useMemo } from "react"
import { Nav } from "@/components/ui/nav"
import { boardSlug, orgSlug } from "@/lib/mock-data"
import { AddEntityModal } from "@/components/ui/add-entity-modal"
import { useLineageStore } from "@/store/lineage-store"
import { cn } from "@/lib/utils"
import Link from "next/link"
import type { Board } from "@/types"

type MainTab = "all" | "brands" | "models"

function AvatarStack({ riderIds }: { riderIds: string[] }) {
  const { catalog } = useLineageStore()
  const shown = riderIds.slice(0, 3)
  const extra = riderIds.length - shown.length
  if (shown.length === 0) return null
  return (
    <div className="flex items-center">
      {shown.map((rid, i) => {
        const person = catalog.people.find((p) => p.id === rid)
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
  const { catalog } = useLineageStore()
  const riderIds = [...new Set(
    catalog.claims.filter((c) => c.object_id === board.id && c.predicate === "owned_board").map((c) => c.subject_id)
  )]
  const addedByPerson = board.added_by ? catalog.people.find((p) => p.id === board.added_by) : null
  const isUnverified = board.community_status === "unverified"

  return (
    <Link href={`/boards/${boardSlug(board)}`}>
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
            {isUnverified && addedByPerson && (
              <div className="flex items-center gap-1 mt-1 text-[10px] text-zinc-700">
                <div className="w-3 h-3 rounded-full bg-zinc-800 flex items-center justify-center text-[8px] font-bold">
                  {addedByPerson.display_name[0]}
                </div>
                Added by {addedByPerson.display_name}
              </div>
            )}
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1">
            {isUnverified && (
              <span className="text-[10px] text-amber-600 border border-amber-900/50 rounded px-1.5 py-0.5">unverified</span>
            )}
            {riderIds.length > 0 && (
              <>
                <AvatarStack riderIds={riderIds} />
                <div className="text-[10px] text-zinc-600">
                  {riderIds.length} rider{riderIds.length !== 1 ? "s" : ""}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}

function SectionDivider({ label, count, unit = "board", href }: { label: string; count: number; unit?: string; href?: string }) {
  const nameEl = href ? (
    <Link href={href} className="text-sm font-semibold text-zinc-300 hover:text-blue-400 transition-colors">
      {label}
    </Link>
  ) : (
    <span className="text-sm font-semibold text-zinc-300">{label}</span>
  )

  return (
    <div className="flex items-center gap-3 mb-3">
      <div className="w-7 h-7 rounded bg-[#1e1e1e] border border-[#2a2a2a] flex items-center justify-center text-xs font-bold text-zinc-500 shrink-0">
        {label[0]}
      </div>
      {nameEl}
      <div className="flex-1 h-px bg-[#1e1e1e]" />
      <span className="text-[10px] text-zinc-600">
        {count} {unit}{count !== 1 ? "s" : ""}
      </span>
    </div>
  )
}

function DecadeDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-semibold text-zinc-600 uppercase tracking-widest shrink-0">{label}</span>
      <div className="flex-1 h-px bg-[#1e1e1e]" />
    </div>
  )
}

export default function BoardsPage() {
  const [mainTab, setMainTab] = useState<MainTab>("all")
  const [addOpen, setAddOpen] = useState(false)
  const { catalog } = useLineageStore()

  const allBoards = catalog.boards

  // ── All tab: decade groups ────────────────────────────────────────────────
  const decadeGroups = useMemo(() => {
    const byDecade = new Map<number, Board[]>()
    allBoards.forEach((b) => {
      const decade = Math.floor(b.model_year / 10) * 10
      if (!byDecade.has(decade)) byDecade.set(decade, [])
      byDecade.get(decade)!.push(b)
    })
    return [...byDecade.entries()]
      .sort(([a], [b]) => b - a)
      .map(([decade, boards]) => ({
        label: `${decade}s`,
        boards: [...boards].sort((a, b) => b.model_year - a.model_year),
      }))
  }, [allBoards])

  // ── Brands tab: grouped by brand, alphabetical ────────────────────────────
  const brandGroups = useMemo(() => {
    const byBrand = new Map<string, Board[]>()
    allBoards.forEach((b) => {
      if (!byBrand.has(b.brand)) byBrand.set(b.brand, [])
      byBrand.get(b.brand)!.push(b)
    })
    return [...byBrand.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([brand, boards]) => ({
        brand,
        boards: [...boards].sort((a, b) => b.model_year - a.model_year),
      }))
  }, [allBoards])

  // ── Models tab: grouped by model name, alphabetical ───────────────────────
  const modelGroups = useMemo(() => {
    const byModel = new Map<string, Board[]>()
    allBoards.forEach((b) => {
      if (!byModel.has(b.model)) byModel.set(b.model, [])
      byModel.get(b.model)!.push(b)
    })
    return [...byModel.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([model, boards]) => ({
        model,
        boards: [...boards].sort((a, b) => b.model_year - a.model_year),
      }))
  }, [allBoards])

  const isEmpty = allBoards.length === 0

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Nav />
      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Boards</h1>
            <p className="text-sm text-zinc-500 mt-1">The shapes that shaped the scene</p>
          </div>
          <button
            onClick={() => setAddOpen(true)}
            className="px-4 py-2 rounded-lg bg-blue-600 text-sm font-medium text-white hover:bg-blue-500 transition-all"
          >
            + Add board
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-[#111] border border-[#1e1e1e] rounded-lg p-1 mb-6 w-fit">
          {([
            { key: "all" as MainTab, label: "All" },
            { key: "brands" as MainTab, label: "Brands" },
            { key: "models" as MainTab, label: "Models" },
          ]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setMainTab(key)}
              className={cn(
                "px-4 py-1.5 rounded-md text-sm font-medium transition-all",
                mainTab === key
                  ? "bg-[#2a2a2a] text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {isEmpty ? (
          <div className="text-sm text-zinc-600 text-center py-12 border border-dashed border-[#2a2a2a] rounded-xl">
            No boards found.{" "}
            <button onClick={() => setAddOpen(true)} className="text-blue-500 hover:text-blue-400">Add one.</button>
          </div>
        ) : (
          <>
            {/* ── All tab: by decade ── */}
            {mainTab === "all" && (
              <div className="space-y-8">
                {decadeGroups.map(({ label, boards }) => (
                  <div key={label}>
                    <DecadeDivider label={label} />
                    <div className="space-y-2 mt-3">
                      {boards.map((board) => (
                        <BoardCard key={board.id} board={board} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Brands tab: by brand alphabetically ── */}
            {mainTab === "brands" && (
              <div className="space-y-8">
                {brandGroups.map(({ brand, boards }) => {
                  const org = catalog.orgs.find((o) =>
                    o.name.toLowerCase() === brand.toLowerCase() ||
                    o.name.toLowerCase().startsWith(brand.toLowerCase() + " ")
                  )
                  const href = org ? `/brands/${orgSlug(org)}` : undefined
                  return (
                    <div key={brand}>
                      <SectionDivider label={brand} count={boards.length} unit="model" href={href} />
                      <div className="space-y-2">
                        {boards.map((board) => (
                          <BoardCard key={board.id} board={board} />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* ── Models tab: by model name alphabetically ── */}
            {mainTab === "models" && (
              <div className="space-y-8">
                {modelGroups.map(({ model, boards }) => (
                  <div key={model}>
                    <SectionDivider label={model} count={boards.length} />
                    <div className="space-y-2">
                      {boards.map((board) => (
                        <BoardCard key={board.id} board={board} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {addOpen && (
        <AddEntityModal
          entityType="board"
          onClose={() => setAddOpen(false)}
          onAdded={() => setAddOpen(false)}
        />
      )}
    </div>
  )
}
