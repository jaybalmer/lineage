import { NextRequest, NextResponse } from "next/server"
import { requireEditor, getServiceClient } from "@/lib/auth"

// FNRad show + episode authoring (editor self-serve). The member catalog route
// (/api/catalog/entity) whitelists the old org/event types and rejects 'media' /
// 'episode', and has no episode-linkage fields, so creating a show or an episode
// needed direct SQL. This editor-only route closes that gap.
//
// POST /api/admin/show-episode (requireEditor)
//   { kind: 'show',    name, description?, logo_url?, community_slug? }
//   { kind: 'episode', show_org_id, name, start_date, year?, episode_number?,
//                      media_url?, description?, community_slug? }
//
// Inserts the catalog row (server-generated text id, matching the mixed-type
// catalog id convention) AND the matching community junction so the new show /
// episode shows in the community lists. Dedup on name (case-insensitive) returns
// the existing id with 409.

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function s(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null
  const t = v.trim()
  return t ? t.slice(0, max) : null
}

function optInt(v: unknown, min: number, max: number): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v !== "" ? Number(v) : NaN
  if (!Number.isFinite(n)) return null
  const i = Math.trunc(n)
  return i < min || i > max ? null : i
}

function ilikeExact(value: string): string {
  return value.replace(/([%_\\])/g, "\\$1")
}

export async function POST(req: NextRequest) {
  const { user, response } = await requireEditor()
  if (response) return response

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  const kind = body?.kind
  if (kind !== "show" && kind !== "episode") {
    return NextResponse.json({ error: "kind must be 'show' or 'episode'" }, { status: 400 })
  }

  const db = getServiceClient()
  const communitySlug = s(body?.community_slug, 80) ?? "snowboarding"
  const { data: comm } = await db.from("communities").select("id").eq("slug", communitySlug).maybeSingle()
  const communityId = (comm as { id: string } | null)?.id ?? null

  if (kind === "show") {
    const name = s(body?.name, 160)
    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 })

    const { data: dupe } = await db.from("orgs").select("id").ilike("name", ilikeExact(name)).limit(1)
    if (dupe?.[0]?.id) {
      return NextResponse.json({ error: "An org with that name already exists.", existing_id: dupe[0].id }, { status: 409 })
    }

    const id = genId("org")
    const { error } = await db.from("orgs").insert({
      id, name, org_type: "media",
      description: s(body?.description, 2000),
      logo_url: s(body?.logo_url, 2048),
      community_status: "verified",
      added_by: user.id,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (communityId) {
      await db.from("community_orgs").upsert({ community_id: communityId, org_id: id }, { onConflict: "community_id,org_id" })
    }
    return NextResponse.json({ ok: true, id }, { status: 201 })
  }

  // kind === 'episode'
  const showOrgId = s(body?.show_org_id, 80)
  const name = s(body?.name, 200)
  if (!showOrgId) return NextResponse.json({ error: "show_org_id is required" }, { status: 400 })
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 })

  const { data: show } = await db.from("orgs").select("id").eq("id", showOrgId).maybeSingle()
  if (!show) return NextResponse.json({ error: "Show not found" }, { status: 404 })

  // Dedup an episode within the same show by name.
  const { data: dupe } = await db
    .from("events").select("id").eq("show_org_id", showOrgId).ilike("name", ilikeExact(name)).limit(1)
  if (dupe?.[0]?.id) {
    return NextResponse.json({ error: "That episode already exists for this show.", existing_id: dupe[0].id }, { status: 409 })
  }

  // Normalize a bare year start_date to Jan 1 (mirrors /api/catalog/entity).
  const rawStart = s(body?.start_date, 32)
  const startDate = rawStart && /^\d{4}$/.test(rawStart) ? `${rawStart}-01-01` : rawStart
  const year = optInt(body?.year, 1950, 2100) ?? (rawStart ? optInt(rawStart.slice(0, 4), 1950, 2100) : null)

  const id = genId("evt")
  const { error } = await db.from("events").insert({
    id, name, event_type: "episode",
    show_org_id: showOrgId,
    start_date: startDate,
    year,
    episode_number: optInt(body?.episode_number, 0, 100000),
    media_url: s(body?.media_url, 2048),
    description: s(body?.description, 2000),
    community_status: "verified",
    added_by: user.id,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (communityId) {
    await db.from("community_events").upsert({ community_id: communityId, event_id: id }, { onConflict: "community_id,event_id" })
  }
  return NextResponse.json({ ok: true, id }, { status: 201 })
}
