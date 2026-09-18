// Partner campaign config (FNRad Surface Reconciliation brief).
//
// A hand-edited map keyed by orgs.public_slug. When a founding-tier media org
// has an entry here, its brand page swaps the generic "Were you part of the
// {brand} story?" contribute module for a campaign module (kicker, headline,
// this week's challenge, links back to the listener hub and the podcast). FNRad
// is the first and only row today.
//
// Deliberately a constants file, not schema: there is no campaigns table and no
// admin field, the same call fnrad.ts made. A jsonb column for one row three
// months before the season closes is not worth a migration.

import {
  FNRAD_HUB_HREF,
  FNRAD_LISTEN_HREF,
  FNRAD_CHALLENGE,
  FNRAD_SHOW_SLUG,
  addStoryAboutHref,
  hasChallengeGuest,
} from "@/lib/fnrad"

export interface PartnerCampaign {
  /** Uppercase eyebrow, brand colour. e.g. "Season 12 · Presented by Linestry" */
  kicker: string
  /** Wordmark-font heading. */
  headline: string
  /** One muted sentence under the heading. */
  body: string
  /** Internal link back to the campaign front door (the listener hub). */
  hubHref: string
  hubLabel: string
  /** External link to the podcast itself. */
  listenHref: string
  listenLabel: string
  /** This week's challenge, or null when no guest is configured (no row, no
   *  empty state). Resolved from FNRAD_CHALLENGE at module load. */
  challenge: { guestName: string; href: string; episodeLabel: string | null } | null
}

/** Keyed by orgs.public_slug. Hand-edited; FNRad is the first row. */
export const PARTNER_CAMPAIGNS: Record<string, PartnerCampaign> = {
  [FNRAD_SHOW_SLUG]: {
    kicker: "Season 12 · Presented by Linestry",
    headline: "The final season is on. Help write it down.",
    body: "Every rider, hill, board and contest named on the show gets a home here. Add your half of the story.",
    hubHref: FNRAD_HUB_HREF,
    hubLabel: "Season 12 on Linestry",
    listenHref: FNRAD_LISTEN_HREF,
    listenLabel: "Listen to the podcast",
    challenge: hasChallengeGuest(FNRAD_CHALLENGE.guestId)
      ? {
          guestName: FNRAD_CHALLENGE.guestName,
          href: addStoryAboutHref(FNRAD_CHALLENGE.guestId),
          episodeLabel: FNRAD_CHALLENGE.episodeLabel,
        }
      : null,
  },
}

/** The campaign for an org, or null when the org's slug has no entry. */
export function campaignForOrg(org: { public_slug?: string | null }): PartnerCampaign | null {
  return org.public_slug ? PARTNER_CAMPAIGNS[org.public_slug] ?? null : null
}
