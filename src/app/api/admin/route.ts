import { NextRequest, NextResponse } from "next/server"
import { requireEditor, getServiceClient } from "@/lib/auth"
import { logTagActions } from "@/lib/tag-action-log"

const ALLOWED_TABLES = new Set(["events", "boards", "places", "orgs", "event_series", "event_brands", "event_series_brands", "claims", "people"])

const TABLE_MAP: Record<string, string> = {
  events: "events",
  boards: "boards",
  places: "places",
  orgs: "orgs",
  eventSeries: "event_series",
  event_series: "event_series",
}

export async function POST(req: NextRequest) {
  const { response } = await requireEditor()
  if (response) return response

  const body = await req.json() as {
    operation: "insert" | "update" | "delete" | "replace_junction"
    table: string
    data?: Record<string, unknown>
    id?: string
    /** replace_junction: column name for the "owner" side (e.g. "event_id") */
    fk_column?: string
    /** replace_junction: the owner id value */
    fk_value?: string
    /** replace_junction: rows to insert after deleting existing ones */
    rows?: Record<string, unknown>[]
  }

  const { operation, table, data, id, fk_column, fk_value, rows } = body

  const resolvedTable = TABLE_MAP[table] ?? table
  if (!ALLOWED_TABLES.has(resolvedTable)) {
    return NextResponse.json({ error: `Table "${table}" not allowed` }, { status: 400 })
  }

  const client = getServiceClient()

  if (operation === "insert") {
    if (!data) return NextResponse.json({ error: "data required for insert" }, { status: 400 })
    const { error } = await client.from(resolvedTable).insert(data)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  } else if (operation === "update") {
    if (!data || !id) return NextResponse.json({ error: "data and id required for update" }, { status: 400 })
    const { error } = await client.from(resolvedTable).update(data).eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  } else if (operation === "delete") {
    if (!id) return NextResponse.json({ error: "id required for delete" }, { status: 400 })

    // PB-009 Phase 3 (Q10): when deleting a claim, mirror the story-DELETE
    // lifecycle from PR #9. Find paired tag_events, flip to disabled,
    // auto-close open reports as resolved_moment_destroyed, log each.
    //
    // Two paths converge here: the FK on claims.tag_event_id points at the
    // FIRST paired tag_event (per pairClaimTagEvents); the rest of the
    // per-person paired rows for multi-person claims live keyed by
    // moment_ref->>claim_id. Union both shapes.
    if (resolvedTable === "claims") {
      const { data: claimRow } = await client
        .from("claims")
        .select("id, tag_event_id")
        .eq("id", id)
        .maybeSingle()
      const firstTagEventId = (claimRow as { tag_event_id?: string | null } | null)?.tag_event_id ?? null

      const { data: paired } = await client
        .from("tag_events")
        .select("id, asserter_id, status")
        .or(
          firstTagEventId
            ? `id.eq.${firstTagEventId},moment_ref->>claim_id.eq.${id}`
            : `moment_ref->>claim_id.eq.${id}`,
        )

      const toDisable = ((paired ?? []) as { id: string; asserter_id: string | null; status: string }[])
        .filter((t) => t.status === "pending" || t.status === "approved")

      if (toDisable.length > 0) {
        const tagIds = toDisable.map((t) => t.id)
        await client
          .from("tag_events")
          .update({
            status:                   "disabled",
            decision_at:              new Date().toISOString(),
            decision_reason_category: "lifecycle_destroyed",
          })
          .in("id", tagIds)

        // Auto-close open tag_reports → resolved_moment_destroyed
        await client
          .from("tag_reports")
          .update({ status: "resolved_moment_destroyed", reviewed_at: new Date().toISOString() })
          .in("tag_event_id", tagIds)
          .eq("status", "open")

        await logTagActions(client, toDisable.map((t) => ({
          tagEventId:     t.id,
          asserterId:     t.asserter_id,
          actorId:        null,
          actorRole:      "system" as const,
          action:         "lifecycle_disable" as const,
          priorStatus:    t.status as "pending" | "approved",
          newStatus:      "disabled" as const,
          reasonCategory: "lifecycle_destroyed" as const,
        })))
      }
    }

    const { error } = await client.from(resolvedTable).delete().eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  } else if (operation === "replace_junction") {
    if (!fk_column || !fk_value) return NextResponse.json({ error: "fk_column and fk_value required for replace_junction" }, { status: 400 })
    // Delete existing rows for this entity
    const { error: delErr } = await client.from(resolvedTable).delete().eq(fk_column, fk_value)
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 })
    // Insert new rows (if any)
    if (rows && rows.length > 0) {
      const { error: insErr } = await client.from(resolvedTable).insert(rows)
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 })
    }
  } else {
    return NextResponse.json({ error: `Unknown operation: ${operation}` }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
