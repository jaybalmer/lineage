"use client"

import { CommunityLink } from "@/components/ui/community-link"
import { RiderAvatar } from "@/components/ui/rider-avatar"
import { eventSlug } from "@/lib/mock-data"
import { useLineageStore } from "@/store/lineage-store"
import type { Event, EventType } from "@/types"

// A rider counts toward an event when they competed, spectated, or organized
// there — the same predicate set the events page uses (events/page.tsx).
const EVENT_PREDICATES = ["competed_at", "spectated_at", "organized_at"] as const

const TYPE_LABEL: Record<EventType, string> = {
  contest: "Contest",
  "film-shoot": "Film shoot",
  trip: "Trip",
  camp: "Camp",
  gathering: "Gathering",
}

function EventAvatarStack({ riderIds }: { riderIds: string[] }) {
  const { catalog } = useLineageStore()
  const shown = riderIds.slice(0, 3)
  const extra = riderIds.length - shown.length
  if (shown.length === 0) return null
  return (
    <div className="flex items-center">
      {shown.map((rid, i) => {
        const person = catalog.people.find((p) => p.id === rid)
        if (!person) return null
        return (
          <div
            key={rid}
            style={{ marginLeft: i === 0 ? 0 : -6 }}
            title={person.display_name}
            className="rounded-full border border-background"
          >
            <RiderAvatar person={person} size="xs" />
          </div>
        )
      })}
      {extra > 0 && (
        <div
          style={{ marginLeft: -6 }}
          className="w-5 h-5 rounded-full bg-border-default border border-border-default flex items-center justify-center text-[8px] text-muted"
        >
          +{extra}
        </div>
      )}
    </div>
  )
}

/**
 * Slim, read-only event card for the community timeline. Lighter than the
 * events-page EventCard (single border, no QuickClaimPopover) so it sits cleanly
 * as a timeline node body. Links to the event page through CommunityLink +
 * eventSlug so the address bar stays slug-based and community-scoped.
 */
export function TimelineEventCard({ event }: { event: Event }) {
  const { catalog } = useLineageStore()
  const place = event.place_id ? catalog.places.find((p) => p.id === event.place_id) : null
  const riderIds = [
    ...new Set(
      catalog.claims
        .filter(
          (c) =>
            c.object_id === event.id &&
            (EVENT_PREDICATES as readonly string[]).includes(c.predicate),
        )
        .map((c) => c.subject_id),
    ),
  ]

  return (
    <CommunityLink href={`/events/${eventSlug(event)}`} className="block mb-4">
      <div className="bg-surface border border-border-default rounded-xl p-4 hover:border-foreground/30 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-foreground text-sm leading-snug truncate">
              {event.name}
            </div>
            <div className="text-xs text-muted mt-0.5">
              <span className="uppercase tracking-widest mr-2">{TYPE_LABEL[event.event_type]}</span>
              {event.year}
              {place && <span> · {place.name}</span>}
            </div>
          </div>
          {riderIds.length > 0 && (
            <div className="shrink-0 flex flex-col items-end gap-1">
              <EventAvatarStack riderIds={riderIds} />
              <div className="text-[10px] text-muted">
                {riderIds.length} rider{riderIds.length !== 1 ? "s" : ""}
              </div>
            </div>
          )}
        </div>
      </div>
    </CommunityLink>
  )
}
