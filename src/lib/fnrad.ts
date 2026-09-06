// FNRad Listener Landing (features/fnrad-listener-landing-brief.md).
//
// One tiny constants module for the FNRad campaign. No reads, no schema: the
// hub, the challenge card and the episode-page surfaces all point at the values
// here so the campaign is configured in one place a non-engineer can edit.

/** The FNRad show's public_slug (orgs.public_slug, org_type='media'). Confirmed
 *  in Supabase on 2026-09-06: the row is `fnrad_podcast`, not `fnrad`. If the
 *  show is ever re-slugged, change this one line. See the brief's prerequisite 3
 *  and risk 1: a wrong value silently drops the hub's episode list, so the hub
 *  degrades gracefully (D3) rather than 404ing. */
export const FNRAD_SHOW_SLUG = "fnrad_podcast"

/** Ref code the hub's own CTAs carry, and the code the /r route should mint for
 *  the spoken URL once features/funnel-attribution-brief.md ships. Inert today:
 *  it is just a query string on an href (T7). */
export const FNRAD_HUB_REF = "fnrad"

/** Per-episode ref code pattern, e.g. fnrad-s12e04. Season is not derivable from
 *  data (AUDIT-4), so this is a helper for minting codes by hand, not a read of
 *  anything. Same pattern the attribution brief's worked example uses (F23). */
export function fnradEpisodeRef(season: number, episode: number): string {
  return `fnrad-s${season}e${String(episode).padStart(2, "0")}`
}

/** Where the challenge's "Add your story about {guest}" goes: the guest's page.
 *
 *  That page is the universal correct destination for every auth state. Signed
 *  out, the signup-intent handoff (PR #234) already renders a direct
 *  "Add your story about {First}" link there that carries an add-story intent
 *  through signup (its T2.2), and replays it into a pre-tagged composer on
 *  arrival (its T5). Signed in, the page already shows the pre-tagged
 *  "Add story about {First}" button (F43).
 *
 *  Deliberately NOT short-circuited to /auth/signin here (T7b's optional path):
 *  the challenge card is a server component on public pages that does not know
 *  the viewer's auth state, and /auth/signin does not forward an already
 *  signed-in member, so a signin href would strand signed-in members. Routing
 *  everyone through the guest's page lets that page do the right thing per auth
 *  state. */
export function addStoryAboutHref(guestId: string): string {
  return `/people/${guestId}`
}

/** True when a guestId is a real configured value rather than the shipped
 *  placeholder. A placeholder resolves to nobody, which under D5 render state 3
 *  means no challenge card anywhere. */
export function hasChallengeGuest(guestId: string): boolean {
  return Boolean(guestId) && !guestId.startsWith("<")
}

/** This week's challenge spotlight (D5). Hand-edited. The schema stores nothing
 *  about it, deliberately: there is no challenges table and this brief is not
 *  adding one (section 14 follow-up 2 is where that changes if it earns it).
 *
 *  guestId is the ONLY required field. It is a person or profile id and it is
 *  what BOTH surfaces resolve for the spotlight: the hub and the public episode
 *  page. A null / placeholder guestId means no challenge card anywhere, with no
 *  empty state (D5 render state 3).
 *
 *  Set 2026-09-06 to Ingemar Backman's verified people.id (uuid-shaped, no
 *  profiles row so tags are permissive). Both section 0 pre-flights pass for it.
 *
 *  episodeSlug and episodeLabel are OPTIONAL and arrive later, when the S12 E01
 *  page exists. episodeSlug is the episode's `public_slug`, NOT its id, because
 *  the only thing it feeds is the /t/{slug} href (Appendix A
 *  [challenge-action-hub-secondary]). episodeLabel is what the
 *  [challenge-kicker-hub] line prints. Both the kicker and the secondary link
 *  are hidden when episodeSlug is null; turning them on later is an edit to
 *  these two lines and a deploy (D5 state 2, A8b). */
export const FNRAD_CHALLENGE = {
  guestId: "fbf34ae7-f056-4457-ad90-3be67adac0f1", // Ingemar Backman (people.id)
  guestName: "Ingemar Backman", // display fallback if the node is unreadable
  episodeSlug: null as string | null, // OPTIONAL. The episode's public_slug. Fill in later.
  episodeLabel: null as string | null, // OPTIONAL. e.g. "FNRad S12 E01"
} as const
