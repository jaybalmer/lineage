"use client"

import { use, useState, useEffect } from "react"
import { Nav } from "@/components/ui/nav"
import { CLAIMS, getPersonById } from "@/lib/mock-data"
import { ConnectionThread } from "@/components/feed/connection-thread"
import { useLineageStore, getAllClaims } from "@/store/lineage-store"
import { supabase } from "@/lib/supabase"
import { CommunityLink } from "@/components/ui/community-link"
import { BrandMark } from "@/components/ui/brand-mark"
import { nameToSlug } from "@/lib/utils"
import { notFound } from "next/navigation"
import type { Claim, Person } from "@/types"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-/i

export default function ConnectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const {
    activePersonId,
    profileOverride,
    sessionClaims,
    dbClaims,
    deletedClaimIds,
    claimOverrides,
    catalog,
    catalogLoaded,
    userEntities,
  } = useLineageStore()

  const allPeople = [...catalog.people, ...(userEntities.people ?? [])]

  // ── Resolve person B (the other rider) from slug, UUID, or mock short-ID ──
  // Mirrors /people/[id]: resolve through the loaded catalog rather than a
  // direct profiles fetch. The old direct `.single()` left the page stuck on
  // "Loading…" forever whenever it returned nothing (RLS, a slug instead of a
  // UUID, or a missing row), which is BUG-001b.
  const isUuid = UUID_RE.test(id)
  const resolvedPersonB: Person | null = catalogLoaded
    ? (isUuid
        ? (allPeople.find((p) => p.id === id) ?? getPersonById(id) ?? null)
        : (allPeople.find((p) => nameToSlug(p.display_name) === id) ??
           allPeople.find((p) => p.id === id) ??
           getPersonById(id) ??
           null))
    : null
  const resolvedId = resolvedPersonB?.id ?? id

  // Person B's public claims — real users read through claims_public; mock
  // people fall back to seed CLAIMS below.
  const [dbClaimsB, setDbClaimsB] = useState<Claim[]>([])
  useEffect(() => {
    if (!catalogLoaded || !resolvedId || !UUID_RE.test(resolvedId)) return
    // PB-009 Phase 1: connection detail public read through claims_public.
    supabase
      .from("claims_public")
      .select("*")
      .eq("subject_id", resolvedId)
      .eq("visibility", "public")
      .then(({ data }) => setDbClaimsB((data ?? []) as Claim[]))
  }, [catalogLoaded, resolvedId])

  // Wait for the catalog to hydrate before deciding the person is missing.
  if (!catalogLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-accent"><BrandMark size={30} /></div>
      </div>
    )
  }

  if (!resolvedPersonB) notFound()

  const personB = resolvedPersonB

  // Current user (person A) — resolve from catalog + local profile override.
  // display_name is guaranteed so ConnectionThread's avatar (getInitials) never
  // throws on an anonymous or freshly-signed-in viewer with no profile yet.
  const baseCurrentUser =
    allPeople.find((p) => p.id === activePersonId) ?? getPersonById(activePersonId)
  const personA = {
    ...(baseCurrentUser ?? {}),
    ...profileOverride,
    id: activePersonId ?? "",
    display_name: profileOverride.display_name ?? baseCurrentUser?.display_name ?? "You",
  } as Person

  // Claims for both sides
  const allClaims = getAllClaims(
    sessionClaims,
    dbClaims,
    deletedClaimIds,
    claimOverrides,
    activePersonId
  )
  const claimsA = allClaims.filter((c) => c.subject_id === activePersonId)
  const claimsB = UUID_RE.test(resolvedId)
    ? dbClaimsB
    : CLAIMS.filter((c) => c.subject_id === resolvedId)

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Breadcrumb */}
        <div className="text-xs text-muted mb-6">
          <CommunityLink href="/connections" className="hover:text-foreground">
            Connections
          </CommunityLink>
          <span className="mx-2">/</span>
          <span className="text-muted">{personB.display_name}</span>
        </div>

        <ConnectionThread
          personA={personA}
          personB={personB}
          claimsA={claimsA}
          claimsB={claimsB}
        />
      </div>
    </div>
  )
}
