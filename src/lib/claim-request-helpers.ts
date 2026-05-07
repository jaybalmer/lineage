import type { ClaimRequest, Person, VerificationTier } from "@/types"

export function vouchesRequiredForTier(tier: VerificationTier): 1 | 3 | 5 {
  switch (tier) {
    case "protected": return 5
    case "elevated":  return 3
    case "standard":  return 1
  }
}

/**
 * Derive the verification tier for a person node. The tier governs how many
 * vouches a claim needs before an editor can approve it.
 *
 *   protected: notable / deceased riders, OR anyone with >= 25 claims attached
 *   elevated:  riders with 5..24 claims
 *   standard:  everyone else
 */
export function verificationTierFor(
  person: Pick<Person, "is_notable" | "is_deceased">,
  claimCount: number,
): VerificationTier {
  if (person.is_notable || person.is_deceased) return "protected"
  if (claimCount >= 25) return "protected"
  if (claimCount >= 5)  return "elevated"
  return "standard"
}

export function pluralize(n: number, singular: string, plural: string): string {
  return n === 1 ? singular : plural
}

/** A claim request is "open" if it's still accepting vouches and hasn't expired. */
export function isClaimRequestOpen(req: Pick<ClaimRequest, "status" | "expires_at">): boolean {
  if (req.status !== "pending" && req.status !== "vouched") return false
  return new Date(req.expires_at).getTime() > Date.now()
}

/** Check whether the given user already has an open claim for this person. */
export function userHasOpenClaim(reqs: ClaimRequest[], userId: string): boolean {
  return reqs.some((r) => r.claimant_id === userId && isClaimRequestOpen(r))
}
