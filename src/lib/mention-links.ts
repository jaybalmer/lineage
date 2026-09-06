// FNRad Listener Landing (features/fnrad-listener-landing-brief.md), T3.
//
// One shared "given a mention subject type and id, where does it link" helper,
// used by both readShowHub (the hub episode names) and the public episode page
// mention chips (T4), so the two can never drift on how a name links out.
//
// Paths are emitted BARE and community-scoped: the proxy 301s /places/... to the
// active community, which is what lets the chromeless /t/ pages link into the app
// (F19). This mirrors stackHref (F18) plus the org case; do NOT refactor
// stackHref to call it (out of scope, item 12).

import { placeSlug, eventSlug, boardSlug, orgSlug } from "@/lib/mock-data"
import type { MentionSubjectType } from "@/types"
import type { PublicTimelineEntities } from "@/lib/public-timeline-read"

export function mentionHref(
  type: MentionSubjectType,
  id: string,
  entities: PublicTimelineEntities,
): string | null {
  if (type === "person") return `/people/${id}`
  if (type === "place") {
    const place = entities.places[id]
    return `/places/${place ? placeSlug({ name: place.name } as never) : id}`
  }
  if (type === "event") {
    const event = entities.events[id]
    return `/events/${event ? eventSlug({ name: event.name }) : id}`
  }
  if (type === "board") {
    const board = entities.boards[id]
    return `/boards/${
      board
        ? boardSlug({ brand: board.brand, model: board.model, model_year: board.model_year } as never)
        : id
    }`
  }
  if (type === "org") {
    const org = entities.orgs[id]
    return org ? `/brands/${orgSlug({ name: org.name } as never)}` : null
  }
  return null
}
