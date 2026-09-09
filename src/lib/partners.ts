import type { Org } from "@/types"

/** The commercial tier. 'curated' is editorial quality; 'founding' is a paying
 *  presenting partner and is the only tier that earns the featured slot on the
 *  brands index and the landing card. See
 *  features/presenting-partner-surfacing-brief.md D1. */
export function isPresentingPartner(org: Org): boolean {
  return org.curation_tier === "founding"
}

/** Every presenting partner in a given set, deduped by id and name-sorted for
 *  stable order. The catalog can transiently carry the same org twice (a
 *  double-fetch duplicates rows; see BUG-189), so dedupe here or the featured
 *  section would render two cards with the same React key. */
export function presentingPartners(orgs: Org[]): Org[] {
  const seen = new Set<string>()
  const unique: Org[] = []
  for (const org of orgs) {
    if (!isPresentingPartner(org) || seen.has(org.id)) continue
    seen.add(org.id)
    unique.push(org)
  }
  return unique.sort((a, b) => a.name.localeCompare(b.name))
}

/** The single partner the landing page features (D9). Null when there is none,
 *  which is the correct state until an org is set to 'founding' in /admin/brand. */
export function primaryPresentingPartner(orgs: Org[]): Org | null {
  return presentingPartners(orgs)[0] ?? null
}

/** Eyebrow copy for a partner surface. partner_label is admin-editable and
 *  founding-gated; this is the fallback when it is empty. */
export function partnerEyebrow(org: Org): string {
  return org.partner_label?.trim() || "Presenting Partner"
}
