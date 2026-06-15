import { NextRequest, NextResponse } from "next/server"
import { requireAuth, getServiceClient } from "@/lib/auth"
import { awardContributionTokens } from "@/lib/tokens"
import { str, optStr } from "@/app/api/claims/validation"

// POST /api/catalog/entity
//
// Member-facing catalog creation (token-system brief §5.5, decision D9).
// The AddEntityModal flow has always been reachable by every member, but its
// store actions posted to /api/admin, which is requireEditor-gated, so a
// plain member's optimistic add 403ed server-side and rolled back with a
// failure toast. This route is the member-allowed path for the three
// creatable types (plus event_series, which is only reachable inline from
// event creation). It deliberately does NOT relax /api/admin: that route
// allows broad table operations; this one whitelists types and fields.
//
// Dedup guard: an exact name match (case-insensitive) within the type blocks
// with 409 and returns the existing id. Editor tooling at /admin remains the
// backstop for near-duplicates.
//
// Award: +2 contribution tokens (contribution_entity) for place/board/event/org,
// under the daily content cap. Series creation rides along with its event
// and earns nothing on its own.

type CreatableType = "place" | "board" | "event" | "event_series" | "org"

const PLACE_TYPES = new Set(["resort", "shop", "zone", "city", "venue"])
const EVENT_TYPES = new Set(["contest", "film-shoot", "trip", "camp", "gathering"])
const SERIES_FREQUENCIES = new Set(["annual", "tour", "irregular"])
const ORG_TYPES = new Set(["brand", "shop", "team", "magazine", "event-series"])
const BRAND_CATEGORIES = new Set([
  "board_brand", "outerwear", "bindings", "boots", "retailer", "media", "other",
])

function optInt(v: unknown, min: number, max: number): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v !== "" ? Number(v) : NaN
  if (!Number.isFinite(n)) return null
  const i = Math.trunc(n)
  if (i < min || i > max) return null
  return i
}

/** Escape ilike wildcards so the dedup probe is an exact, case-insensitive match. */
function ilikeExact(value: string): string {
  return value.replace(/([%_\\])/g, "\\$1")
}

export async function POST(req: NextRequest) {
  const { user, response } = await requireAuth()
  if (response) return response

  let body: { type?: unknown; data?: unknown }
  try {
    body = await req.json() as { type?: unknown; data?: unknown }
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })
  }

  const type = body.type as CreatableType
  if (!["place", "board", "event", "event_series", "org"].includes(type)) {
    return NextResponse.json(
      { ok: false, error: "type must be place, board, event, event_series, or org" },
      { status: 400 },
    )
  }
  const data = (body.data ?? {}) as Record<string, unknown>

  const id = str(data.id, 80)
  if (!id) {
    return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 })
  }

  const db = getServiceClient()

  // ── Per-type validation, dedup probe, and whitelisted insert payload ──────
  let table: string
  let row: Record<string, unknown>
  let duplicateId: string | null = null

  if (type === "place") {
    const name = str(data.name, 160)
    if (!name) return NextResponse.json({ ok: false, error: "name is required" }, { status: 400 })
    const placeType = optStr(data.place_type, 24) ?? "resort"
    if (!PLACE_TYPES.has(placeType)) {
      return NextResponse.json({ ok: false, error: "Unknown place_type" }, { status: 400 })
    }
    const { data: existing } = await db
      .from("places").select("id").ilike("name", ilikeExact(name)).limit(1)
    duplicateId = existing?.[0]?.id ?? null
    table = "places"
    row = {
      id, name, place_type: placeType,
      region: optStr(data.region, 120),
      country: optStr(data.country, 120),
      website: optStr(data.website, 300),
      description: optStr(data.description, 2000),
      first_snowboard_year: optInt(data.first_snowboard_year, 1900, 2100),
      community_status: "unverified",
      added_by: user.id,
    }
  } else if (type === "board") {
    const brand = str(data.brand, 120)
    const model = str(data.model, 160)
    if (!brand || !model) {
      return NextResponse.json({ ok: false, error: "brand and model are required" }, { status: 400 })
    }
    const modelYear = optInt(data.model_year, 1960, 2100)
    let probe = db.from("boards").select("id")
      .ilike("brand", ilikeExact(brand)).ilike("model", ilikeExact(model))
    if (modelYear !== null) probe = probe.eq("model_year", modelYear)
    const { data: existing } = await probe.limit(1)
    duplicateId = existing?.[0]?.id ?? null
    table = "boards"
    row = {
      id, brand, model, model_year: modelYear,
      shape: optStr(data.shape, 60),
      external_ref: optStr(data.external_ref, 300),
      community_status: "unverified",
      added_by: user.id,
    }
  } else if (type === "event") {
    const name = str(data.name, 200)
    if (!name) return NextResponse.json({ ok: false, error: "name is required" }, { status: 400 })
    const eventType = optStr(data.event_type, 24) ?? "gathering"
    if (!EVENT_TYPES.has(eventType)) {
      return NextResponse.json({ ok: false, error: "Unknown event_type" }, { status: 400 })
    }
    const year = optInt(data.year, 1950, 2100)
    let probe = db.from("events").select("id").ilike("name", ilikeExact(name))
    if (year !== null) probe = probe.eq("year", year)
    const { data: existing } = await probe.limit(1)
    duplicateId = existing?.[0]?.id ?? null
    // Normalise start_date: a bare year becomes Jan 1 (mirrors the store's
    // old /api/admin payload so the events table keeps one date shape).
    const rawStart = optStr(data.start_date, 32)
    const startDate = rawStart && /^\d{4}$/.test(rawStart) ? `${rawStart}-01-01` : rawStart
    table = "events"
    row = {
      id, name, event_type: eventType, year,
      start_date: startDate,
      end_date: optStr(data.end_date, 32),
      series_id: optStr(data.series_id, 80),
      place_id: optStr(data.place_id, 80),
      description: optStr(data.description, 2000),
      community_status: "unverified",
      added_by: user.id,
    }
  } else if (type === "org") {
    const name = str(data.name, 160)
    if (!name) return NextResponse.json({ ok: false, error: "name is required" }, { status: 400 })
    const orgType = optStr(data.org_type, 24) ?? "brand"
    if (!ORG_TYPES.has(orgType)) {
      return NextResponse.json({ ok: false, error: "Unknown org_type" }, { status: 400 })
    }
    const brandCategory = optStr(data.brand_category, 24)
    if (brandCategory !== null && !BRAND_CATEGORIES.has(brandCategory)) {
      return NextResponse.json({ ok: false, error: "Unknown brand_category" }, { status: 400 })
    }
    const { data: existing } = await db
      .from("orgs").select("id").ilike("name", ilikeExact(name)).limit(1)
    duplicateId = existing?.[0]?.id ?? null
    table = "orgs"
    row = {
      id, name, org_type: orgType,
      brand_category: brandCategory,
      founded_year: optInt(data.founded_year, 1900, 2100),
      country: optStr(data.country, 120),
      website: optStr(data.website, 300),
      description: optStr(data.description, 2000),
      community_status: "unverified",
      added_by: user.id,
    }
  } else {
    const name = str(data.name, 200)
    if (!name) return NextResponse.json({ ok: false, error: "name is required" }, { status: 400 })
    const frequency = optStr(data.frequency, 24) ?? "annual"
    if (!SERIES_FREQUENCIES.has(frequency)) {
      return NextResponse.json({ ok: false, error: "Unknown frequency" }, { status: 400 })
    }
    const { data: existing } = await db
      .from("event_series").select("id").ilike("name", ilikeExact(name)).limit(1)
    duplicateId = existing?.[0]?.id ?? null
    table = "event_series"
    row = {
      id, name, frequency,
      place_id: optStr(data.place_id, 80),
      start_year: optInt(data.start_year, 1950, 2100),
      description: optStr(data.description, 2000),
    }
  }

  if (duplicateId) {
    return NextResponse.json(
      { ok: false, error: "That one is already in the catalog.", existing_id: duplicateId },
      { status: 409 },
    )
  }

  const { error: insertError } = await db.from(table).insert(row)
  if (insertError) {
    const status = insertError.code === "23505" ? 409 : 400
    console.error(`[api/catalog/entity] ${table} insert failed:`, insertError)
    return NextResponse.json({ ok: false, error: insertError.message }, { status })
  }

  // Token earning (brief §5.1): a new reusable catalog node is +2, under the
  // daily content cap. Series earn nothing (they ride along with an event).
  if (type !== "event_series") {
    await awardContributionTokens(db, user.id, 2, "contribution_entity")
  }

  return NextResponse.json({ ok: true, id }, { status: 201 })
}
