import { getServiceClient } from "@/lib/auth"
import { nameToSlug } from "@/lib/utils"
import type { PersonRedirectEntry, PersonRedirectMap, PersonRedirectReason } from "@/types"

/**
 * Build the alias-to-canonical map used by the redirect middleware.
 *
 * Sources:
 *   1. people.merged_from_id        old_id  -> { canonical people row }
 *   2. profiles.merged_from_id      old_id  -> { canonical profile row }
 *   3. person_slug_aliases          alias   -> { canonical person row }
 *
 * The map is keyed by anything that could appear in a /people/<segment> URL
 * (an old uuid or an old slug). Values include the canonical id and slug so
 * the middleware can rebuild the destination URL without an extra query.
 *
 * Chains are collapsed: if A points at B and B points at C, A is rewritten
 * to point at C directly. The depth guard caps walks at five hops to keep
 * a malformed dataset from looping forever.
 */
export async function buildPersonRedirectMap(): Promise<PersonRedirectMap> {
  const supabase = getServiceClient()
  const map: PersonRedirectMap = {}

  // 1. People rows that absorbed an older record.
  const { data: mergedPeople } = await supabase
    .from("people")
    .select("id, display_name, merged_from_id")
    .not("merged_from_id", "is", null)

  for (const row of mergedPeople ?? []) {
    if (!row.merged_from_id || !row.id) continue
    map[row.merged_from_id] = {
      to_id: row.id,
      to_slug: nameToSlug(row.display_name ?? ""),
      reason: "merged",
    }
  }

  // 2. Profile rows that absorbed an older record (claimed-then-merged path).
  const { data: mergedProfiles } = await supabase
    .from("profiles")
    .select("id, display_name, merged_from_id")
    .not("merged_from_id", "is", null)

  for (const row of mergedProfiles ?? []) {
    if (!row.merged_from_id || !row.id) continue
    map[row.merged_from_id] = {
      to_id: row.id,
      to_slug: nameToSlug(row.display_name ?? ""),
      reason: "merged",
    }
  }

  // 3. Slug aliases (reslug after claim, or manual). Resolve the canonical
  //    display_name in a single batched lookup against people + profiles.
  const { data: aliases } = await supabase
    .from("person_slug_aliases")
    .select("alias, person_id, reason")

  if (aliases?.length) {
    const personIds = Array.from(new Set(aliases.map((a) => a.person_id).filter(Boolean)))
    const [{ data: peopleSlice }, { data: profilesSlice }] = await Promise.all([
      supabase.from("people").select("id, display_name").in("id", personIds),
      supabase.from("profiles").select("id, display_name").in("id", personIds),
    ])

    const nameById = new Map<string, string>()
    for (const row of peopleSlice ?? []) {
      if (row.id) nameById.set(row.id, row.display_name ?? "")
    }
    for (const row of profilesSlice ?? []) {
      if (row.id) nameById.set(row.id, row.display_name ?? "")
    }

    for (const a of aliases) {
      if (!a.alias || !a.person_id) continue
      const display = nameById.get(a.person_id)
      if (!display) continue
      map[a.alias] = {
        to_id: a.person_id,
        to_slug: nameToSlug(display),
        reason: ((a.reason ?? "manual") as PersonRedirectReason),
      }
    }
  }

  // 4. Collapse alias chains.
  for (const key of Object.keys(map)) {
    let current: PersonRedirectEntry = map[key]
    let hops = 0
    while (current.to_id !== key && map[current.to_id] && hops < 5) {
      current = map[current.to_id]
      hops++
    }
    map[key] = current
  }

  return map
}
