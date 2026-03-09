"use client"

import { use } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Nav } from "@/components/ui/nav"
import { ORGS, BOARDS, CLAIMS, getPersonById, PEOPLE, getOrgBySlug, boardSlug } from "@/lib/mock-data"
import { formatDateRange } from "@/lib/utils"

const ORG_TYPE_LABEL: Record<string, string> = {
  brand: "Brand",
  shop: "Shop",
  team: "Team / Crew",
  magazine: "Media / Magazine",
  "event-series": "Event Series",
}

const BRAND_CAT_LABEL: Record<string, string> = {
  board_brand: "Board Brand",
  outerwear: "Outerwear",
  bindings: "Bindings",
  boots: "Boots",
  retailer: "Retailer",
  media: "Media",
  other: "Other",
}

export default function OrgPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  // Accept both slug (Burton_Snowboards) and legacy id (o1)
  const org = ORGS.find((o) => o.id === id) ?? getOrgBySlug(id)
  if (!org) notFound()

  // People sponsored by this org
  const sponsorClaims = CLAIMS.filter(
    (c) => c.object_id === org.id && c.predicate === "sponsored_by"
  )
  // People who worked at this org
  const workClaims = CLAIMS.filter(
    (c) => c.object_id === org.id && c.predicate === "worked_at"
  )
  // Team members
  const teamClaims = CLAIMS.filter(
    (c) => c.object_id === org.id && c.predicate === "part_of_team"
  )

  // Board models by this brand
  const orgBoards = BOARDS.filter(
    (b) => b.brand.toLowerCase() === org.name.toLowerCase() ||
      // Also match by first word of org name (e.g. "Burton Snowboards" → "Burton")
      b.brand.toLowerCase() === org.name.split(" ")[0].toLowerCase()
  )

  // All connected people (deduped)
  const allClaims = [...sponsorClaims, ...workClaims, ...teamClaims]
  const riderIds = [...new Set(allClaims.map((c) => c.subject_id))]

  // Group riders who owned boards by this brand
  const boardOwnerClaims = CLAIMS.filter(
    (c) =>
      c.predicate === "owned_board" &&
      orgBoards.some((b) => b.id === c.object_id)
  )
  const boardRiderIds = [...new Set(boardOwnerClaims.map((c) => c.subject_id))]
  const allConnectedIds = [...new Set([...riderIds, ...boardRiderIds])]

  const isBoard = org.brand_category === "board_brand"

  const initials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <Nav />
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Breadcrumb */}
        <div className="text-xs text-zinc-600 mb-6">
          <Link href="/boards" className="hover:text-zinc-400">Boards</Link>
          <span className="mx-2">/</span>
          <span className="text-zinc-400">{org.name}</span>
        </div>

        {/* Header */}
        <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-6 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-zinc-600 uppercase tracking-widest">
                  {org.brand_category ? BRAND_CAT_LABEL[org.brand_category] : ORG_TYPE_LABEL[org.org_type]}
                </span>
                {org.founded_year && (
                  <span className="text-xs text-zinc-700">· est. {org.founded_year}</span>
                )}
              </div>
              <h1 className="text-2xl font-bold text-white">{org.name}</h1>
              {org.country && (
                <p className="text-zinc-500 text-sm mt-1">{org.country}</p>
              )}
              {org.website && (
                <a
                  href={org.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:text-blue-400 mt-1 block"
                >
                  {org.website.replace(/^https?:\/\//, "")} ↗
                </a>
              )}
            </div>
            <div className="w-12 h-12 rounded-lg bg-[#1e1e1e] border border-[#2a2a2a] flex items-center justify-center text-lg font-bold text-zinc-500 shrink-0">
              {org.name[0]}
            </div>
          </div>

          <div className="mt-5 flex gap-6 text-sm">
            <div>
              <div className="font-bold text-white text-xl">{allConnectedIds.length}</div>
              <div className="text-zinc-600 text-xs">connected riders</div>
            </div>
            {sponsorClaims.length > 0 && (
              <>
                <div className="w-px bg-[#2a2a2a]" />
                <div>
                  <div className="font-bold text-white text-xl">{[...new Set(sponsorClaims.map(c => c.subject_id))].length}</div>
                  <div className="text-zinc-600 text-xs">sponsored</div>
                </div>
              </>
            )}
            {isBoard && orgBoards.length > 0 && (
              <>
                <div className="w-px bg-[#2a2a2a]" />
                <div>
                  <div className="font-bold text-white text-xl">{orgBoards.length}</div>
                  <div className="text-zinc-600 text-xs">board models</div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-6">
          {/* Main */}
          <div className="space-y-6">

            {/* Sponsored riders */}
            {sponsorClaims.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Sponsored riders</h2>
                <div className="space-y-1.5">
                  {[...new Set(sponsorClaims.map(c => c.subject_id))].map((rid) => {
                    const person = getPersonById(rid)
                    if (!person) return null
                    const claim = sponsorClaims.find((c) => c.subject_id === rid)
                    return (
                      <Link key={rid} href={`/riders/${rid}`}>
                        <div className="flex items-center gap-3 px-3 py-2.5 bg-[#111] border border-[#1e1e1e] rounded-lg hover:border-[#2a2a2a] transition-all group">
                          <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-300 shrink-0">
                            {initials(person.display_name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-white group-hover:text-blue-300 transition-colors truncate">{person.display_name}</div>
                          </div>
                          {claim && (
                            <div className="text-xs text-zinc-600 shrink-0">
                              {formatDateRange(claim.start_date, claim.end_date)}
                            </div>
                          )}
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </section>
            )}

            {/* Team members */}
            {teamClaims.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Team members</h2>
                <div className="space-y-1.5">
                  {[...new Set(teamClaims.map(c => c.subject_id))].map((rid) => {
                    const person = getPersonById(rid)
                    if (!person) return null
                    const claim = teamClaims.find((c) => c.subject_id === rid)
                    return (
                      <Link key={rid} href={`/riders/${rid}`}>
                        <div className="flex items-center gap-3 px-3 py-2.5 bg-[#111] border border-[#1e1e1e] rounded-lg hover:border-[#2a2a2a] transition-all group">
                          <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-300 shrink-0">
                            {initials(person.display_name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-white group-hover:text-blue-300 transition-colors">{person.display_name}</div>
                          </div>
                          {claim && (
                            <div className="text-xs text-zinc-600 shrink-0">
                              {formatDateRange(claim.start_date, claim.end_date)}
                            </div>
                          )}
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </section>
            )}

            {/* Board models (if board brand) */}
            {isBoard && orgBoards.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Board models</h2>
                <div className="grid grid-cols-2 gap-2">
                  {orgBoards.map((board) => {
                    const ownerCount = boardOwnerClaims.filter((c) => c.object_id === board.id).length
                    return (
                      <Link key={board.id} href={`/boards/${boardSlug(board)}`}>
                        <div className="flex items-start gap-3 px-3 py-2.5 bg-[#111] border border-[#1e1e1e] rounded-lg hover:border-[#2a2a2a] transition-all group">
                          <div className="text-base">🏂</div>
                          <div className="min-w-0">
                            <div className="text-sm text-white group-hover:text-blue-300 transition-colors">{board.model}</div>
                            <div className="text-[11px] text-zinc-600">'{String(board.model_year).slice(2)} · {board.shape ?? "–"}</div>
                            {ownerCount > 0 && (
                              <div className="text-[10px] text-zinc-700">{ownerCount} rider{ownerCount !== 1 ? "s" : ""}</div>
                            )}
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </section>
            )}

            {/* Riders who owned boards by this brand */}
            {isBoard && boardRiderIds.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Riders who owned {org.name.split(" ")[0]} boards</h2>
                <div className="flex flex-wrap gap-2">
                  {boardRiderIds.map((rid) => {
                    const person = getPersonById(rid)
                    if (!person) return null
                    return (
                      <Link key={rid} href={`/riders/${rid}`}>
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#111] border border-[#1e1e1e] rounded-full hover:border-[#2a2a2a] transition-all group">
                          <div className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-[9px] font-bold text-zinc-400">
                            {person.display_name[0]}
                          </div>
                          <span className="text-xs text-zinc-400 group-hover:text-white transition-colors">{person.display_name}</span>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </section>
            )}

            {allConnectedIds.length === 0 && (
              <div className="text-sm text-zinc-600 py-8 text-center">
                No riders documented for this org yet.
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-4">
              <div className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-3">Quick facts</div>
              <div className="space-y-2 text-sm">
                {org.founded_year && (
                  <div className="flex justify-between">
                    <span className="text-zinc-600">Founded</span>
                    <span className="text-zinc-300">{org.founded_year}</span>
                  </div>
                )}
                {org.country && (
                  <div className="flex justify-between">
                    <span className="text-zinc-600">Country</span>
                    <span className="text-zinc-300">{org.country}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-zinc-600">Type</span>
                  <span className="text-zinc-300">
                    {org.brand_category ? BRAND_CAT_LABEL[org.brand_category] : ORG_TYPE_LABEL[org.org_type]}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-4">
              <div className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-2">Add to profile</div>
              <p className="text-xs text-zinc-600 mb-3">Sponsored? Part of the team? Rode their gear?</p>
              <Link href="/profile">
                <button className="w-full px-3 py-2 bg-blue-600 rounded-lg text-xs text-white font-medium hover:bg-blue-500 transition-colors">
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
