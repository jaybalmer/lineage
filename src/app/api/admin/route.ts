import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

const ALLOWED_TABLES = new Set(["events", "boards", "places", "orgs", "event_series", "event_brands", "event_series_brands"])

const TABLE_MAP: Record<string, string> = {
  events: "events",
  boards: "boards",
  places: "places",
  orgs: "orgs",
  eventSeries: "event_series",
  event_series: "event_series",
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function POST(req: NextRequest) {
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

  const client = getAdminClient()
  if (!client) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not configured — add it to your environment variables" },
      { status: 500 }
    )
  }

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
