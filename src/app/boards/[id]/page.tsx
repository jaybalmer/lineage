"use client"

import { use } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Nav } from "@/components/ui/nav"
import { BOARDS, CLAIMS, ORGS, getPersonById, getBoardBySlug, boardSlug, orgSlug } from "@/lib/mock-data"
import { formatDateRange } from "@/lib/utils"

export default function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  // Accept both slug (Burton_Custom_2003) and legacy id (b1)
  const board = BOARDS.find((b) => b.id === id) ?? getBoardBySlug(id)
  if (!board) notFound()

  // Riders who owned this board
  const ownedClaims = CLAIMS.filter(
    (c) => c.object_id === board.id && c.predicate === "owned_board"
  )
  const riderIds = [...new Set(ownedClaims.map((c) => c.subject_id))]

  // Other models by same brand
  const samesBrand = BOARDS.filter(
    (b) => b.brand === board.brand && b.id !== board.id
  ).sort((a, b) => b.model_year - a.model_year)

  // Find org for this brand
  const brandOrg = ORGS.find(
    (o) => o.name.toLowerCase().startsWith(board.brand.toLowerCase())
  )

  const initials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Breadcrumb */}
        <div className="text-xs text-zinc-600 mb-6">
          <Link href="/boards" className="hover:text-zinc-400">Boards</Link>
          <span className="mx-2">/</span>
          {brandOrg ? (
            <>
              <Link href={`/orgs/${orgSlug(brandOrg)}`} className="hover:text-zinc-400">{board.brand}</Link>
              <span className="mx-2">/</span>
            </>
          ) : (
            <>
              <span className="text-zinc-600">{board.brand}</span>
              <span className="mx-2">/</span>
            </>
          )}
          <span className="text-zinc-400">{board.model}</span>
        </div>

        {/* Header */}
        <div className="bg-surface border border-border-default rounded-xl p-6 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-zinc-600 uppercase tracking-widest">Snowboard</span>
                {board.shape && (
                  <span className="text-xs text-zinc-700">· {board.shape}</span>
                )}
              </div>
              <h1 className="text-2xl font-bold text-foreground">
                {board.brand} {board.model}
              </h1>
              <p className="text-zinc-500 text-sm mt-1">{board.model_year}</p>
            </div>
            <div className="text-4xl shrink-0">🏂</div>
          </div>

          <div className="mt-5 flex gap-6">
            <div>
              <div className="font-bold text-foreground text-xl">{riderIds.length}</div>
              <div className="text-zinc-600 text-xs">riders</div>
            </div>
            {board.shape && (
              <>
                <div className="w-px bg-border-default" />
                <div>
                  <div className="font-bold text-foreground text-base capitalize">{board.shape.replace("-", " ")}</div>
                  <div className="text-zinc-600 text-xs">shape</div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-6">
          {/* Riders list */}
          <div>
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">
              Riders who owned this board
            </h2>
            {riderIds.length === 0 ? (
              <div className="text-sm text-zinc-600 py-8 text-center border border-dashed border-border-default rounded-xl">
                No riders documented yet.
              </div>
            ) : (
              <div className="space-y-2">
                {riderIds.map((rid) => {
                  const person = getPersonById(rid)
                  if (!person) return null
                  const claim = ownedClaims.find((c) => c.subject_id === rid)
                  return (
                    <Link key={rid} href={`/riders/${rid}`}>
                      <div className="flex items-center gap-3 px-4 py-3 bg-surface border border-border-default rounded-xl hover:border-border-default transition-all group">
                        <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold text-foreground shrink-0">
                          {initials(person.display_name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground group-hover:text-blue-300 transition-colors">
                            {person.display_name}
                          </div>
                          {person.birth_year && (
                            <div className="text-xs text-zinc-600">b. {person.birth_year}</div>
                          )}
                        </div>
                        {claim && (
                          <div className="text-xs text-zinc-500 shrink-0">
                            {formatDateRange(claim.start_date, claim.end_date)}
                          </div>
                        )}
                        {claim?.confidence === "documented" && (
                          <div className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/40 shrink-0">
                            doc
                          </div>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Brand link */}
            {brandOrg && (
              <div className="bg-surface border border-border-default rounded-xl p-4">
                <div className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-3">Brand</div>
                <Link href={`/orgs/${orgSlug(brandOrg)}`}>
                  <div className="flex items-center gap-2 hover:text-blue-300 transition-colors">
                    <div className="w-7 h-7 rounded bg-surface-active border border-border-default flex items-center justify-center text-xs font-bold text-zinc-500">
                      {brandOrg.name[0]}
                    </div>
                    <div>
                      <div className="text-sm text-foreground">{brandOrg.name}</div>
                      {brandOrg.founded_year && (
                        <div className="text-[11px] text-zinc-600">est. {brandOrg.founded_year}</div>
                      )}
                    </div>
                  </div>
                </Link>
              </div>
            )}

            {/* Other models */}
            {samesBrand.length > 0 && (
              <div className="bg-surface border border-border-default rounded-xl p-4">
                <div className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-3">
                  Other {board.brand} models
                </div>
                <div className="space-y-2">
                  {samesBrand.slice(0, 6).map((b) => {
                    const ownerCount = CLAIMS.filter(
                      (c) => c.object_id === b.id && c.predicate === "owned_board"
                    ).length
                    return (
                      <Link key={b.id} href={`/boards/${boardSlug(b)}`}>
                        <div className="flex items-center justify-between py-1.5 hover:text-blue-300 transition-colors group">
                          <div>
                            <div className="text-sm text-foreground group-hover:text-blue-300">{b.model}</div>
                            <div className="text-[11px] text-zinc-600">'{String(b.model_year).slice(2)}</div>
                          </div>
                          {ownerCount > 0 && (
                            <div className="text-[10px] text-zinc-600">{ownerCount} rider{ownerCount !== 1 ? "s" : ""}</div>
                          )}
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="bg-surface border border-border-default rounded-xl p-4">
              <div className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-2">Add to profile</div>
              <p className="text-xs text-zinc-600 mb-3">Did you ride this board?</p>
              <Link href="/profile">
                <button className="w-full px-3 py-2 bg-blue-600 rounded-lg text-xs text-foreground font-medium hover:bg-blue-500 transition-colors">
                  + Add to my profile
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
