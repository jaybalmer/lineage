"use client"

import { use, useState, useEffect } from "react"
import { Nav } from "@/components/ui/nav"
import { PEOPLE, CLAIMS, getPersonById } from "@/lib/mock-data"
import { ConnectionThread } from "@/components/feed/connection-thread"
import { useLineageStore, getAllClaims } from "@/store/lineage-store"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import { notFound } from "next/navigation"
import type { Claim, Person } from "@/types"

export default function ConnectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const {
    activePersonId,
    profileOverride,
    sessionClaims,
    dbClaims,
    deletedClaimIds,
    claimOverrides,
  } = useLineageStore()

  const mockIds = new Set(PEOPLE.map((p) => p.id))

  // Person B (the other rider)
  const basePerson = getPersonById(id)
  const [realPerson, setRealPerson] = useState<Person | null>(null)
  const [personBClaims, setPersonBClaims] = useState<Claim[]>([])

  useEffect(() => {
    if (mockIds.has(id)) return
    supabase
      .from("profiles")
      .select("id, display_name, birth_year, riding_since, privacy_level, bio, home_resort_id")
      .eq("id", id)
      .single()
      .then(({ data }) => {
        if (data) {
          setRealPerson({
            id: data.id,
            display_name: data.display_name,
            birth_year: data.birth_year ?? undefined,
            riding_since: data.riding_since ?? undefined,
            privacy_level: data.privacy_level as "public",
            bio: data.bio ?? undefined,
            home_resort_id: data.home_resort_id ?? undefined,
          })
        }
      })
    supabase
      .from("claims")
      .select("*")
      .eq("subject_id", id)
      .eq("visibility", "public")
      .then(({ data }) => setPersonBClaims((data ?? []) as Claim[]))
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!basePerson && !realPerson && mockIds.has(id)) notFound()

  const personB = realPerson ?? basePerson

  if (!personB) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <Nav />
        <div className="max-w-3xl mx-auto px-4 py-16 text-center text-zinc-600">Loading…</div>
      </div>
    )
  }

  // Current user (personA)
  const baseCurrentUser = getPersonById(activePersonId)
  const personA = { ...(baseCurrentUser ?? {}), ...profileOverride } as Person

  // Claims for both sides
  const allClaims = getAllClaims(
    sessionClaims,
    dbClaims,
    deletedClaimIds,
    claimOverrides,
    activePersonId
  )
  const claimsA = allClaims.filter((c) => c.subject_id === activePersonId)
  const claimsB = mockIds.has(id)
    ? CLAIMS.filter((c) => c.subject_id === id)
    : personBClaims

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Nav />
      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Breadcrumb */}
        <div className="text-xs text-zinc-600 mb-6">
          <Link href="/connections" className="hover:text-zinc-400">
            Connections
          </Link>
          <span className="mx-2">/</span>
          <span className="text-zinc-400">{personB.display_name}</span>
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
