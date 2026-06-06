import type { Person, Place, Board, Org, Event, EventSeries } from "@/types"
import { nameToSlug } from "./utils"
import { boardSlug, orgSlug, placeSlug, eventSlug, seriesSlug } from "./mock-data"

type PersonLike = Pick<Person, "id" | "display_name">

/** Name-based slug for a person, e.g. "Jay Balmer" → "jay_balmer". */
export function personSlug(person: Pick<Person, "display_name">): string {
  return nameToSlug(person.display_name ?? "")
}

/**
 * Canonical href for a person. Returns the name-based slug URL only when that
 * slug maps to exactly one person in `people` (and that person is the subject);
 * otherwise falls back to the stable id so two people who share a name never
 * resolve onto each other. `/people/*` is top-level — wrap with a plain Link.
 */
export function personHref(person: PersonLike, people: PersonLike[]): string {
  const slug = personSlug(person)
  if (!slug) return `/people/${person.id}`
  const matches = people.filter((p) => nameToSlug(p.display_name ?? "") === slug)
  const uniqueToSubject = matches.length === 1 && matches[0].id === person.id
  return uniqueToSubject ? `/people/${slug}` : `/people/${person.id}`
}

/** As personHref, but resolves the person from `people` by id first. */
export function personHrefById(id: string, people: PersonLike[]): string {
  const person = people.find((p) => p.id === id)
  return person ? personHref(person, people) : `/people/${id}`
}

type CatalogLike = {
  people: Person[]
  places: Place[]
  boards: Board[]
  orgs: Org[]
  events: Event[]
  eventSeries: EventSeries[]
}

/**
 * Canonical href for any catalog entity, resolved against the live catalog
 * (not just mock data) so real Supabase entities get name-based slug URLs.
 * Falls back to an id-based URL when the entity isn't found yet.
 *
 * Community-scoped segments (place/board/event/org) are returned WITHOUT the
 * community prefix — wrap the result in <CommunityLink> as the rest of the app
 * does. Person URLs are top-level and need no prefix.
 */
export function entityHref(id: string, type: string, catalog: CatalogLike): string {
  switch (type) {
    case "person":
      return personHrefById(id, catalog.people)
    case "place": {
      const place = catalog.places.find((p) => p.id === id)
      return place ? `/places/${placeSlug(place)}` : `/places/${id}`
    }
    case "board": {
      const board = catalog.boards.find((b) => b.id === id)
      return board ? `/boards/${boardSlug(board)}` : `/boards/${id}`
    }
    case "org": {
      const org = catalog.orgs.find((o) => o.id === id)
      return org ? `/brands/${orgSlug(org)}` : `/brands/${id}`
    }
    case "event": {
      const event = catalog.events.find((e) => e.id === id)
      if (event) return `/events/${eventSlug(event)}`
      const series = catalog.eventSeries.find((s) => s.id === id)
      return series ? `/events/${seriesSlug(series)}` : `/events/${id}`
    }
    default:
      return "#"
  }
}
