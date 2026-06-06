"use client"

import { useMemo } from "react"
import type { Person } from "@/types"
import { nameToSlug } from "./utils"
import { useLineageStore } from "@/store/lineage-store"

type PersonLike = Pick<Person, "id" | "display_name">

/**
 * Returns a stable resolver that builds a name-based person href
 * (e.g. /people/jay_balmer) from either a person object or an id.
 *
 * Resolves ids against the live catalog and emits the slug only when it maps
 * to exactly one person, falling back to the stable id for colliding names.
 * The slug→count map is precomputed once per catalog change so rendering a
 * full directory stays linear.
 */
export function usePersonHref(): (personOrId: PersonLike | string) => string {
  const people = useLineageStore((s) => s.catalog.people)
  return useMemo(() => {
    const counts = new Map<string, number>()
    const byId = new Map<string, PersonLike>()
    for (const p of people) {
      byId.set(p.id, p)
      const slug = nameToSlug(p.display_name ?? "")
      if (slug) counts.set(slug, (counts.get(slug) ?? 0) + 1)
    }
    return (personOrId: PersonLike | string): string => {
      const person = typeof personOrId === "string" ? byId.get(personOrId) : personOrId
      if (!person) return `/people/${typeof personOrId === "string" ? personOrId : ""}`
      const slug = nameToSlug(person.display_name ?? "")
      return slug && counts.get(slug) === 1 ? `/people/${slug}` : `/people/${person.id}`
    }
  }, [people])
}
