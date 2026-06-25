"use client"

// PB-010 Phase 2: the decoupled public-timeline renderer.
//
// Fed an already-resolved payload (see src/lib/public-timeline-read.ts), this
// renders the owner's claims + stories as a read-only, decade-grouped timeline.
// It has ZERO store dependency (acceptance §5): every entity name/thumbnail is
// joined from payload.entities, not from useLineageStore. The in-app
// FeedView/StoryCard/PostCard are store-coupled and so are deliberately NOT
// reused; this mirrors their layout with presentational, read-only cards.
//
// The payload types are imported type-only so this client bundle never pulls in
// the server-only read module.

import type { Claim, EntityType, Story, Predicate } from "@/types"
import type {
  PublicTimelinePayload,
  PublicTimelineEntities,
  PublicTimelineOwner,
} from "@/lib/public-timeline-read"
import { cn, PREDICATE_LABELS, formatDateRange } from "@/lib/utils"
import { groupRodeAtCompanions } from "@/lib/companion-grouping"
import { dateToSortNum, groupByDecade } from "@/lib/timeline-grouping"
import { EntityGraphic } from "@/components/public-timeline/entity-graphic"
import { IWasThere } from "@/components/public-timeline/i-was-there"
import { StoryMedia } from "@/components/public-timeline/story-media"

type FeedItem =
  | { kind: "claim"; claim: Claim; sortDate: number }
  | { kind: "story"; story: Story; sortDate: number }

// Timeline node colour, keyed to predicate category (mirrors FeedView).
function nodeColor(item: FeedItem): string {
  if (item.kind === "story") return "bg-violet-600"
  const p = item.claim.predicate
  if (p === "owned_board") return "bg-emerald-700"
  if (p === "rode_at" || p === "worked_at") return "bg-teal-700"
  if (p === "rode_with" || p === "shot_by" || p === "coached_by") return "bg-violet-700"
  if (p === "competed_at" || p === "spectated_at" || p === "organized_at") return "bg-amber-700"
  if (p === "sponsored_by" || p === "part_of_team" || p === "fan_of") return "bg-zinc-500"
  return "bg-zinc-600"
}

// Within the same date: boards, then places, people, events, orgs, stories.
function predicateRank(item: FeedItem): number {
  if (item.kind === "story") return 8
  const p = item.claim.predicate
  if (p === "owned_board") return 0
  if (p === "rode_at" || p === "worked_at") return 2
  if (p === "rode_with" || p === "shot_by" || p === "coached_by") return 3
  if (p === "competed_at" || p === "spectated_at" || p === "organized_at") return 4
  if (p === "sponsored_by" || p === "part_of_team" || p === "fan_of") return 5
  return 6
}

// Left border accent by predicate group (mirrors PostCard).
function accentClass(predicate: Predicate): string {
  if (predicate === "rode_at" || predicate === "worked_at") return "border-teal-700"
  if (predicate === "owned_board") return "border-emerald-700"
  if (predicate === "rode_with" || predicate === "shot_by" || predicate === "coached_by") return "border-violet-700"
  if (predicate === "competed_at" || predicate === "spectated_at" || predicate === "organized_at") return "border-amber-700"
  return "border-zinc-600"
}

function formatStoryDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" })
}

// Place and event claim cards are excluded from the public timeline (owner
// decision: keep the public surface story-first). It is also a correctness
// guard: many place/event refs are mock or local-only catalog ids that exist
// in the browser store but not in the DB, so they cannot resolve server-side.
const HIDDEN_CLAIM_OBJECT_TYPES = new Set<EntityType>(["place", "event"])

// True when a claim's object actually resolved in the payload, so we never
// render an "Unknown" card if a person/board/org id is ever missing.
function claimObjectResolves(claim: Claim, entities: PublicTimelineEntities): boolean {
  const id = claim.object_id
  switch (claim.object_type) {
    case "person": return !!entities.people[id]
    case "board":  return !!entities.boards[id]
    case "org":    return !!entities.orgs[id]
    case "place":  return !!entities.places[id]
    case "event":  return !!entities.events[id]
    default:       return false
  }
}

// ── Claim card (read-only, store-free) ───────────────────────────────────────

function PublicClaimCard({
  claim, companionIds, entities,
}: {
  claim: Claim
  companionIds: string[]
  entities: PublicTimelineEntities
}) {
  const type = claim.object_type
  const id = claim.object_id

  const board  = type === "board"  ? entities.boards[id]  : undefined
  const place  = type === "place"  ? entities.places[id]  : undefined
  const org    = type === "org"    ? entities.orgs[id]    : undefined
  const event  = type === "event"  ? entities.events[id]  : undefined
  const person = type === "person" ? entities.people[id]  : undefined

  const displayName =
    board  ? `${board.brand} ${board.model}` :
    place  ? place.name :
    org    ? org.name :
    event  ? event.name :
    person ? person.display_name :
    "Unknown"

  const subtitle = (() => {
    if (board) {
      const parts: string[] = []
      if (board.model_year) parts.push(`'${String(board.model_year).slice(2)}`)
      if (board.shape)      parts.push(board.shape.replace(/-/g, " "))
      return parts.join(" · ")
    }
    if (place) return [place.region, place.country].filter(Boolean).join(", ")
    if (org)   return [
      org.brand_category?.replace(/_/g, " ") ?? org.org_type,
      org.founded_year ? `Est. ${org.founded_year}` : null,
    ].filter(Boolean).join(" · ")
    if (event) return event.event_type?.replace(/-/g, " ") ?? ""
    return ""
  })()

  const badge = (() => {
    if (type === "board")  return { label: "Snowboard", cls: "text-emerald-700" }
    if (type === "place")  return { label: place?.place_type ?? "Place", cls: "text-teal-700" }
    if (type === "event")  return { label: event?.event_type?.replace(/-/g, " ") ?? "Event", cls: "text-amber-700" }
    if (type === "person") return { label: "Rider", cls: "text-violet-700" }
    return { label: org?.org_type ?? "Org", cls: "text-muted" }
  })()

  const imageUrl = board?.image_url ?? org?.logo_url ?? place?.image_url ?? event?.image_url ?? undefined
  const eventYear = event?.year ?? (parseInt(event?.start_date?.slice(0, 4) ?? "0") || undefined)

  const predicateLabel = PREDICATE_LABELS[claim.predicate] ?? claim.predicate
  const dateRange = formatDateRange(claim.start_date, claim.end_date)

  const companionNames = companionIds
    .map((cid) => entities.people[cid]?.display_name)
    .filter((n): n is string => !!n)

  return (
    <div className={cn("postcard bg-surface border-2 rounded-xl p-5 mb-4", accentClass(claim.predicate))}>
      {/* Entity visual block */}
      <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border-default">
        <div className="flex-shrink-0">
          <EntityGraphic type={type as EntityType} name={displayName} year={eventYear} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="font-bold text-foreground text-base leading-snug truncate">{displayName}</p>
              {subtitle && <p className="text-xs text-muted mt-0.5 capitalize">{subtitle}</p>}
            </div>
            <span className={cn("text-[10px] uppercase tracking-widest font-medium shrink-0 capitalize mt-0.5", badge.cls)}>
              {badge.label}
            </span>
          </div>
        </div>
        {imageUrl && (
          <div className="w-14 h-14 rounded-lg overflow-hidden border border-border-default flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt={displayName} className="w-full h-full object-cover" />
          </div>
        )}
      </div>

      {/* Metadata row */}
      <div className="flex items-center gap-2 flex-wrap min-w-0">
        <span className="text-[10px] uppercase tracking-widest font-semibold text-muted bg-surface-hover border border-border-default rounded px-1.5 py-0.5">
          {predicateLabel}
        </span>
        {dateRange && <span className="text-xs text-muted">{dateRange}</span>}
        {claim.division && <span className="text-xs text-muted">{claim.division}</span>}
        {claim.result && <span className="text-xs font-semibold text-amber-700">{claim.result}</span>}
      </div>

      {/* Note */}
      {claim.note && (
        <p className="mt-3 text-sm text-muted leading-relaxed border-t border-border-default pt-3">
          {claim.note}
        </p>
      )}

      {/* Companions folded in from rode_with */}
      {companionNames.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border-default flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-muted uppercase tracking-widest shrink-0">With</span>
          <span className="text-[11px] text-muted">
            {companionNames.slice(0, 4).join(", ")}
            {companionNames.length > 4 ? ` +${companionNames.length - 4} more` : ""}
          </span>
        </div>
      )}
    </div>
  )
}

// ── Story card (read-only, store-free) ───────────────────────────────────────

const CHIP = "inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full"

function PublicStoryCard({ story, entities, owner }: { story: Story; entities: PublicTimelineEntities; owner: PublicTimelineOwner }) {
  const linkedPlace = story.linked_place_id ? entities.places[story.linked_place_id] : undefined
  const linkedEvent = story.linked_event_id ? entities.events[story.linked_event_id] : undefined
  const linkedOrg   = story.linked_org_id   ? entities.orgs[story.linked_org_id]     : undefined
  const linkedBoards = (story.board_ids ?? []).map((id) => entities.boards[id]).filter(Boolean)
  const taggedRiders = (story.rider_ids ?? []).map((id) => entities.people[id]).filter(Boolean)
  const communityPlaces = (story.community_places ?? [])
    .filter((cp) => cp.place_id !== story.linked_place_id)
    .map((cp) => entities.places[cp.place_id]).filter(Boolean)
  const communityEvents = (story.community_events ?? [])
    .filter((ce) => ce.event_id !== story.linked_event_id)
    .map((ce) => entities.events[ce.event_id]).filter(Boolean)
  const communityOrgs = (story.community_orgs ?? [])
    .filter((co) => co.org_id !== story.linked_org_id)
    .map((co) => entities.orgs[co.org_id]).filter(Boolean)

  const hasLinks = linkedPlace || linkedEvent || linkedOrg || linkedBoards.length > 0 ||
    taggedRiders.length > 0 || communityPlaces.length > 0 || communityEvents.length > 0 ||
    communityOrgs.length > 0

  return (
    <div className="postcard bg-surface border-2 border-violet-700 rounded-xl p-5 mb-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          {story.author?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={story.author.avatar_url} alt={story.author.display_name} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-violet-600">
              {(story.author?.display_name ?? "?")[0].toUpperCase()}
            </div>
          )}
          <span className="text-xs font-medium text-muted truncate">{story.author?.display_name ?? "Rider"}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] uppercase tracking-widest font-semibold text-muted bg-surface-hover border border-border-default rounded px-1.5 py-0.5">Story</span>
          <span className="text-xs text-muted">{formatStoryDate(story.story_date)}</span>
        </div>
      </div>

      {story.title && <h3 className="font-bold text-foreground text-base leading-snug mb-2">{story.title}</h3>}
      {story.body && <p className="text-sm text-muted leading-relaxed mb-3 whitespace-pre-wrap">{story.body}</p>}

      <StoryMedia story={story} />

      {hasLinks && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {linkedPlace && (
            <span className={cn(CHIP, "bg-teal-500/10 border border-teal-500/20 text-teal-600")}>
              <span className="w-2 h-2 rounded-full bg-teal-600 flex-shrink-0" /> {linkedPlace.name}
            </span>
          )}
          {communityPlaces.map((p) => p && (
            <span key={`cp-${p.id}`} className={cn(CHIP, "bg-teal-500/10 border border-teal-500/20 text-teal-600")}>
              <span className="w-2 h-2 rounded-full bg-teal-600 flex-shrink-0" /> {p.name}
            </span>
          ))}
          {linkedEvent && (
            <span className={cn(CHIP, "bg-amber-500/10 border border-amber-500/20 text-amber-600")}>
              <span className="w-2 h-2 rounded-full bg-amber-600 flex-shrink-0" /> {linkedEvent.name}
            </span>
          )}
          {communityEvents.map((e) => e && (
            <span key={`ce-${e.id}`} className={cn(CHIP, "bg-amber-500/10 border border-amber-500/20 text-amber-600")}>
              <span className="w-2 h-2 rounded-full bg-amber-600 flex-shrink-0" /> {e.name}
            </span>
          ))}
          {linkedOrg && (
            <span className={cn(CHIP, "bg-cyan-500/10 border border-cyan-500/20 text-cyan-600")}>
              <span className="w-2 h-2 rounded-full bg-cyan-600 flex-shrink-0" /> {linkedOrg.name}
            </span>
          )}
          {communityOrgs.map((o) => o && (
            <span key={`co-${o.id}`} className={cn(CHIP, "bg-cyan-500/10 border border-cyan-500/20 text-cyan-600")}>
              <span className="w-2 h-2 rounded-full bg-cyan-600 flex-shrink-0" /> {o.name}
            </span>
          ))}
          {linkedBoards.map((b) => b && (
            <span key={b.id} className={cn(CHIP, "bg-emerald-500/10 border border-emerald-500/20 text-emerald-600")}>
              🏂 {b.brand} {b.model} &apos;{String(b.model_year ?? "").slice(2)}
            </span>
          ))}
          {taggedRiders.map((r) => r && (
            <span key={r.id} className={cn(CHIP, "bg-violet-500/10 border border-violet-500/20 text-violet-600")}>
              👤 {r.display_name}
            </span>
          ))}
        </div>
      )}

      {/* PB-010 Phase 4: tag-to-claim affordance. Event-linked stories offer
          spectator / competitor / organizer, tagged on the story + the event. */}
      <IWasThere
        ownerSlug={owner.slug}
        ownerName={owner.display_name}
        moment={{ kind: "story", id: story.id }}
        linkedEvent={linkedEvent && story.linked_event_id
          ? { id: story.linked_event_id, name: linkedEvent.name }
          : undefined}
        variant="inline"
      />
    </div>
  )
}

// ── Renderer ─────────────────────────────────────────────────────────────────

export function PublicTimeline({ payload }: { payload: PublicTimelinePayload }) {
  const { entities } = payload

  // Fold companion rode_with rows into their matching rode_at (same as FeedView)
  // so a rode_with fanned out from a hidden rode_at is absorbed, not surfaced.
  const { claims: groupedClaims, companionMap } = groupRodeAtCompanions(payload.claims)

  // Story-first: drop place/event claim cards and any claim whose object did
  // not resolve, so the timeline never shows an "Unknown" card.
  const visibleClaims = groupedClaims.filter(
    (c) => !HIDDEN_CLAIM_OBJECT_TYPES.has(c.object_type) && claimObjectResolves(c, entities),
  )

  const items: FeedItem[] = [
    ...visibleClaims.map((claim) => ({ kind: "claim" as const, claim, sortDate: dateToSortNum(claim.start_date) })),
    ...payload.stories.map((story) => ({ kind: "story" as const, story, sortDate: dateToSortNum(story.story_date) })),
  ].sort((a, b) => {
    if (a.sortDate !== b.sortDate) return b.sortDate - a.sortDate
    return predicateRank(a) - predicateRank(b)
  })

  const grouped = groupByDecade(items)
  const decades = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  if (decades.length === 0) {
    return (
      <div className="text-center text-muted py-16">
        <div className="text-3xl mb-3">🏂</div>
        <div className="text-sm">This timeline is just getting started.</div>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Continuous vertical timeline line */}
      <div className="absolute left-[12px] top-6 bottom-6 w-2 bg-border-default rounded-full" />

      {decades.map((decade) => (
        <div key={decade} className="mb-8">
          <div className="pl-9 mb-4 flex items-center gap-3">
            <span className="text-3xl text-foreground" style={{ fontFamily: "var(--font-display)" }}>{decade}</span>
            <div className="flex-1 h-px bg-surface-active" />
            <span className="text-xs text-muted">{grouped[decade].length} entries</span>
          </div>

          <div>
            {grouped[decade].map((item) => {
              const key = item.kind === "claim" ? item.claim.id : `story-${item.story.id}`
              return (
                <div key={key} className="relative pl-9">
                  <div className={cn("absolute left-[7px] top-[20px] w-[22px] h-[22px] rounded-full border-[3px] border-background z-10", nodeColor(item))} />
                  {item.kind === "claim" ? (
                    <PublicClaimCard
                      claim={item.claim}
                      companionIds={companionMap.get(item.claim.id) ?? []}
                      entities={entities}
                    />
                  ) : (
                    <PublicStoryCard story={item.story} entities={entities} owner={payload.owner} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
