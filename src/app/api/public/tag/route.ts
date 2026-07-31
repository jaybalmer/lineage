import { NextRequest, NextResponse } from "next/server"
import { getServiceClient } from "@/lib/auth"
import {
  readPublicTimeline,
  readEventStack,
  readOrgStack,
  type PublicTimelineEntities,
} from "@/lib/public-timeline-read"
import { insertTagEvent } from "@/lib/tag-events"
import type { Story } from "@/types"
import { sendClaimEmail, claimYourSpotHtml, claimYourSpotText } from "@/lib/emails/claim-emails"
import {
  hashVisitorValue,
  getClientIp,
  isVisitorBlocked,
  checkTagThrottle,
  recordTagThrottle,
} from "@/lib/public-tag"
import type { TagEventMomentRef } from "@/types"

// POST /api/public/tag — PB-010 Phase 4a. The anonymous "I was there" write
// behind the public timeline at /t/{slug}.
//
// Unauthenticated by design: a visitor with no account taps a moment, we mint a
// ghost `people` row keyed on their email, write the claim they implied + a
// paired tag_event (subject = the TIMELINE OWNER, so it lands in the owner's
// existing /me/tags inbox under the Embed source), throttle the request, and
// email them a magic link to claim their spot. The ghost stays unclaimed and
// fully owner-moderatable until the visitor completes the claim (Phase 4b).
//
// Nothing here widens public visibility (D2 = hidden until claimed): the ghost
// has no public timeline, and the owner's timeline only ever reads its OWN
// claims (subject = owner), never the ghost's. The owner sees and can decline
// the tag in /me/tags regardless.

const ALLOWED_ORIGINS = [
  "https://linestry.com",
  "https://lineage.wtf",
  "https://lineage.community",
  "http://localhost:3000",
]

type MomentKind = "place" | "event" | "story"
const MOMENT_KINDS = new Set<MomentKind>(["place", "event", "story"])

function clampStr(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null
  const t = v.trim()
  return t.length === 0 ? null : t.slice(0, max)
}

function resolveOrigin(req: NextRequest): string {
  const reqOrigin = req.headers.get("origin")
  return reqOrigin && ALLOWED_ORIGINS.includes(reqOrigin) ? reqOrigin : "https://linestry.com"
}

/** Generate a sign-in magic link for the visitor email. Returns null when the
 *  admin API or env is unavailable (dev/preview) so the caller no-ops the send.
 *  Phase 4b swaps the redirect target for the claim-completion route. */
async function generateClaimLink(
  db: ReturnType<typeof getServiceClient>,
  email: string,
  origin: string,
): Promise<string | null> {
  try {
    const { data, error } = await db.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${origin}/auth/complete` },
    })
    if (error || !data?.properties?.action_link) {
      console.error("[public-tag] generateLink failed:", error?.message ?? error)
      return null
    }
    return data.properties.action_link
  } catch (err) {
    console.error("[public-tag] generateLink threw:", err)
    return null
  }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const slug = clampStr(body.slug, 80)
  const moment = (body.moment ?? {}) as { kind?: unknown; id?: unknown }
  const kind = clampStr(moment.kind, 16) as MomentKind | null
  const momentId = clampStr(moment.id, 80)
  const name = clampStr(body.name, 120)
  const emailRaw = clampStr(body.email, 200)
  const role = clampStr(body.role, 16) // spectator | competitor | organizer (rider = legacy competitor)
  const eventId = clampStr(body.eventId, 80) // event-linked story: the event to co-tag
  const note = clampStr(body.note, 500)

  if (!slug || !kind || !MOMENT_KINDS.has(kind) || !momentId) {
    return NextResponse.json({ error: "slug and a valid moment are required" }, { status: 400 })
  }
  if (!name) {
    return NextResponse.json({ error: "Your name is required" }, { status: 400 })
  }
  if (!emailRaw || !emailRaw.includes("@") || emailRaw.length < 3) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 })
  }
  const email = emailRaw.toLowerCase()

  // Resolve the slug across the shared /t/ namespace in the same order as the
  // /t/[slug] page: profile first, then episode (event) owner, then show (org)
  // owner. Disabled/unknown → 404, leaking nothing. (The event/org legs were
  // missing until the podcast pass: IWasThere renders on episode/show stacks,
  // so every submission from those pages 404ed here.)
  const timeline = await readPublicTimeline(slug)
  let surface: {
    ownerKind: "profile" | "event" | "org"
    owner: { id: string; display_name: string }
    stories: Story[]
    entities: PublicTimelineEntities
    momentValid: boolean
  } | null = null
  if (timeline) {
    // Validate the moment is actually on this owner's public surface. Stories
    // come through payload.stories; place/event come through the owner's public
    // claims (the payload carries them even though the timeline UI hides
    // place/event cards — they surface only as curated Stack entries, which is
    // where these tags originate). This is the guard against tagging an
    // arbitrary id.
    surface = {
      ownerKind: "profile",
      owner: timeline.owner,
      stories: timeline.stories,
      entities: timeline.entities,
      momentValid:
        kind === "story"
          ? timeline.stories.some((s) => s.id === momentId)
          : timeline.claims.some(
              (c) => c.object_type === kind && c.object_id === momentId,
            ),
    }
  } else {
    const episode = await readEventStack({ slug, requireEnabled: true })
    const stack = episode ?? (await readOrgStack({ slug, requireEnabled: true }))
    if (stack) {
      // For a curated owner the public surface IS the stack: the moment must be
      // one of its entries of the claimed kind.
      surface = {
        ownerKind: episode ? "event" : "org",
        owner: stack.owner,
        stories: stack.stories,
        entities: stack.entities,
        momentValid: stack.entries.some(
          (en) => en.entry_type === kind && en.refId === momentId,
        ),
      }
    }
  }
  if (!surface) {
    return NextResponse.json({ error: "Timeline not found" }, { status: 404 })
  }
  if (!surface.momentValid) {
    return NextResponse.json({ error: "That moment is not on this timeline" }, { status: 400 })
  }
  const { ownerKind, owner } = surface

  const db = getServiceClient()
  const emailHash = hashVisitorValue(email)
  const ipHash = hashVisitorValue(getClientIp(req))

  // Abuse gate, before any write.
  if (await isVisitorBlocked(db, { emailHash, ipHash, ownerId: owner.id })) {
    return NextResponse.json(
      { error: "We could not process that right now.", reason: "blocked" },
      { status: 429 },
    )
  }
  const throttled = await checkTagThrottle(db, { emailHash, ipHash, ownerId: owner.id })
  if (throttled) {
    return NextResponse.json(
      {
        error: "You have marked a lot of spots today. Try again tomorrow.",
        reason: "rate_limited",
      },
      { status: 429 },
    )
  }

  // ── Accounted-email guard (podcast pass, B3) ────────────────────────────────
  // An email that already belongs to a Linestry account must not mint a ghost
  // twin: the member IS the person, and a duplicate ghost splits them on the
  // graph (Jay marking "I was there" on his own episode was creating a second
  // Jay). Send them to the app instead, where the write lands under their real
  // identity. Soft-fail-open: if the admin listing errors we proceed as before
  // rather than block a legitimate anonymous visitor.
  if (await emailHasAccount(db, email)) {
    return NextResponse.json(
      {
        error:
          "This email already has a Linestry account. Sign in and add this moment from the app, so it lands on your real timeline.",
        reason: "has_account",
      },
      { status: 409 },
    )
  }

  // ── Ghost upsert (one per visitor email among unclaimed nodes) ──────────────
  let ghostId: string
  const { data: existingGhost } = await db
    .from("people")
    .select("id")
    .eq("invite_email", email)
    .eq("node_status", "unclaimed")
    .limit(1)
    .maybeSingle()
  if (existingGhost?.id) {
    ghostId = existingGhost.id as string
  } else {
    ghostId = crypto.randomUUID()
    const { error: ghostErr } = await db.from("people").insert({
      id: ghostId,
      display_name: name,
      community_status: "unverified",
      node_status: "unclaimed",
      invite_email: email,
      invited_by: null,
    })
    if (ghostErr) {
      console.error("[public-tag] ghost insert failed:", ghostErr.message)
      return NextResponse.json({ error: "Could not save your mark. Try again." }, { status: 500 })
    }
  }

  // ── Moment → claim shape (brief §5) ─────────────────────────────────────────
  // place              → ghost rode_at place
  // event              → ghost {role}_at event (spectator|competitor|organizer)
  // story (no event)   → ghost rode_with the person behind the story: the
  //                      timeline owner on a profile page, the story AUTHOR on
  //                      an episode/show page (the curated owner is not a person)
  // story + event role → ghost {role}_at the linked event, moment_ref carries
  //                      BOTH story_id and event_id (tagged on story AND event)
  const story = kind === "story" ? surface.stories.find((s) => s.id === momentId) ?? null : null
  let predicate: string
  let objectId: string
  let objectType: string
  let visitorRole: string
  const momentRefBase: TagEventMomentRef = {}
  if (kind === "place") {
    predicate = "rode_at"
    objectType = "place"
    objectId = momentId
    visitorRole = "rider"
    momentRefBase.place_id = momentId
  } else if (kind === "event") {
    const r = roleForEvent(role)
    predicate = r.predicate
    objectType = "event"
    objectId = momentId
    visitorRole = r.role
    momentRefBase.event_id = momentId
  } else {
    // An eventId is only honoured when it is genuinely linked to this story on
    // the owner's surface (the story's own linked event or a community-added
    // one) — otherwise it is a tampering attempt, not a real co-tag.
    const eventLinked =
      !!eventId && !!story &&
      (story.linked_event_id === eventId ||
        (story.community_events ?? []).some((ce) => ce.event_id === eventId)) &&
      !!surface.entities.events[eventId]
    if (eventId && !eventLinked) {
      return NextResponse.json({ error: "That event is not linked to this story" }, { status: 400 })
    }
    if (eventLinked) {
      const r = roleForEvent(role)
      predicate = r.predicate
      objectType = "event"
      objectId = eventId!
      visitorRole = r.role
      momentRefBase.story_id = momentId
      momentRefBase.event_id = eventId!
    } else {
      // Co-presence target: the profile owner, or on a curated (episode/show)
      // surface the story's author, since the owner there is an event/org, not a
      // person a ghost can have ridden with.
      const personTarget = ownerKind === "profile" ? owner.id : story?.author_id ?? null
      if (!personTarget) {
        return NextResponse.json({ error: "That story has no one to connect to" }, { status: 400 })
      }
      predicate = "rode_with"
      objectType = "person"
      objectId = personTarget
      visitorRole = "rider"
      momentRefBase.story_id = momentId
    }
  }

  // Label + claim-link email are shared by the fresh-mark and repeat-mark paths.
  const momentLabel =
    kind === "story" && objectType === "event"
      ? surface.entities.events[objectId]?.name ?? "this event"
      : labelForMoment(kind, momentId, {
          stories: surface.stories,
          entities: surface.entities,
          ownerName: owner.display_name,
        })
  const sendLinkEmail = async () => {
    const origin = resolveOrigin(req)
    const link = await generateClaimLink(db, email, origin)
    if (link) {
      await sendClaimEmail({
        to: email,
        subject:
          ownerKind === "profile"
            ? `Claim your spot on ${owner.display_name}'s timeline`
            : `Claim your spot at ${owner.display_name}`,
        html: claimYourSpotHtml({ ownerName: owner.display_name, momentLabel, link }),
        text: claimYourSpotText({ ownerName: owner.display_name, momentLabel, link }),
      })
    }
  }

  // ── Repeat-mark dedupe (podcast pass, B3) ───────────────────────────────────
  // The same visitor marking the same moment again must not stack duplicate
  // claims. Re-send the claim link (they likely lost the email), still count the
  // attempt against the throttle so this path cannot become an email cannon, and
  // report success.
  const { data: dupClaim } = await db
    .from("claims")
    .select("id")
    .eq("subject_id", ghostId)
    .eq("predicate", predicate)
    .eq("object_id", objectId)
    .limit(1)
    .maybeSingle()
  if (dupClaim) {
    await recordTagThrottle(db, { emailHash, ipHash, ownerId: owner.id })
    await sendLinkEmail()
    return NextResponse.json({ ok: true, momentLabel, already: true })
  }

  // The claim is the ghost's future timeline data (becomes theirs on claim).
  const claimId = crypto.randomUUID()
  const { error: claimErr } = await db.from("claims").insert({
    id: claimId,
    subject_id: ghostId,
    subject_type: "person",
    predicate,
    object_id: objectId,
    object_type: objectType,
    confidence: "self-reported",
    visibility: "public",
    // Anonymous self-claim: the ghost asserts its own presence. asserted_by is
    // text-typed and not FK-enforced (it already carries orphan values), so the
    // ghost id is a valid, honest asserter here and satisfies the NOT NULL.
    asserted_by: ghostId,
    note,
    created_at: new Date().toISOString(),
  })
  if (claimErr) {
    console.error("[public-tag] claim insert failed:", claimErr.message)
    return NextResponse.json({ error: "Could not save your mark. Try again." }, { status: 500 })
  }

  // Paired tag_event: the subject must be a PERSON (the inbox at /me/tags is
  // person-keyed): on a profile surface that is the owner; on an episode/show
  // surface it is the implicated person when there is one (the rode_with story
  // author), else the ghost itself (a pure self-assertion: "I was at this
  // event" implicates nobody else, and the ghost-subject pairing keeps the
  // moderation cascade + claim_id linkage intact). The anonymous visitor lives
  // in asserter_visitor_record (hashed). insertTagEvent derives status=pending,
  // display_state=anonymous_aggregate, expires_at=+7d.
  const tagSubjectId =
    ownerKind === "profile" ? owner.id : objectType === "person" ? objectId : ghostId
  const tagEventId = await insertTagEvent(db, {
    source: "public_timeline_embed",
    asserterId: null,
    subjectId: tagSubjectId,
    predicate,
    momentRef: { ...momentRefBase, claim_id: claimId },
    asserterVisitorRecord: {
      name,
      email_hash: emailHash,
      ip_hash: ipHash,
      visitor_role: visitorRole,
    },
  })
  if (tagEventId) {
    // FK the claim to its tag_event so the deletion cascade can find it.
    await db.from("claims").update({ tag_event_id: tagEventId }).eq("id", claimId)
  } else {
    console.error("[public-tag] tag_event pairing failed for claim", claimId)
  }

  // Count this tag against the daily limits now that it has landed.
  await recordTagThrottle(db, { emailHash, ipHash, ownerId: owner.id })

  // ── Claim-your-spot email (best-effort) ─────────────────────────────────────
  await sendLinkEmail()

  return NextResponse.json({ ok: true, momentLabel })
}

/** Map the visitor's chosen event role to its predicate. "rider" is the legacy
 *  competitor value from the pre-roles client. Unknown / null → spectator. */
function roleForEvent(role: string | null): { predicate: string; role: string } {
  switch (role) {
    case "competitor":
    case "rider":
      return { predicate: "competed_at", role: "competitor" }
    case "organizer":
      return { predicate: "organized_at", role: "organizer" }
    default:
      return { predicate: "spectated_at", role: "spectator" }
  }
}

/** Human label for the moment, for the email + the marked-state card. Works for
 *  any owner kind: the caller passes the surface's stories/entities/name. */
function labelForMoment(
  kind: MomentKind,
  id: string,
  s: { stories: Story[]; entities: PublicTimelineEntities; ownerName: string },
): string {
  if (kind === "place") return s.entities.places[id]?.name ?? "this spot"
  if (kind === "event") return s.entities.events[id]?.name ?? "this event"
  const story = s.stories.find((st) => st.id === id)
  return story?.title?.trim() || `a story on ${s.ownerName}'s timeline`
}

/** True when the email belongs to an existing auth account. Pages through the
 *  admin user listing (the same scan the magic-link route uses; there is no
 *  by-email admin lookup and profiles carries no email column). Errors return
 *  false so a transient admin-API blip never blocks a legitimate anonymous
 *  visitor; the guard is best-effort dedupe, not a security boundary. */
async function emailHasAccount(
  db: ReturnType<typeof getServiceClient>,
  email: string,
): Promise<boolean> {
  try {
    for (let page = 1; page <= 10; page++) {
      const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 })
      if (error) return false
      if (data.users.some((u) => u.email?.toLowerCase() === email)) return true
      if (data.users.length < 1000) return false
    }
  } catch (err) {
    console.error("[public-tag] emailHasAccount scan failed:", err)
  }
  return false
}
