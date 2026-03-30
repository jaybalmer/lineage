import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

interface ConfirmEntry {
  name: string
  person_id?: string   // if matched — skip creation
  placement?: number
  division?: string
  skip?: boolean
}

interface RequestBody {
  entries: ConfirmEntry[]
  event_id?: string
  create_claims: boolean
  added_by: string
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

function generateId() {
  // crypto.randomUUID() is available in the Node.js/Edge runtime
  return crypto.randomUUID()
}

export async function POST(req: NextRequest) {
  const body = await req.json() as RequestBody
  const { entries, event_id, create_claims, added_by } = body

  if (!entries || entries.length === 0) {
    return NextResponse.json({ error: "entries is required" }, { status: 400 })
  }

  const client = getAdminClient()
  if (!client) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not configured" },
      { status: 500 }
    )
  }

  const active = entries.filter((e) => !e.skip)

  // ── 1. Create new people ──────────────────────────────────────────────────
  const toCreate = active.filter((e) => !e.person_id)
  let created = 0
  const createdMap = new Map<string, string>() // name → new person_id

  if (toCreate.length > 0) {
    const newRows = toCreate.map((e) => ({
      id: generateId(),
      display_name: e.name,
      community_status: "unverified",
      added_by: added_by || null,
    }))

    const { error } = await client.from("people").insert(newRows)
    if (error) {
      return NextResponse.json({ error: `Failed to create people: ${error.message}` }, { status: 400 })
    }

    created = newRows.length
    for (let i = 0; i < toCreate.length; i++) {
      createdMap.set(toCreate[i].name, newRows[i].id)
    }
  }

  // ── 2. Optionally check for existing claims to avoid duplicates ───────────
  let existingClaimPersonIds = new Set<string>()
  if (create_claims && event_id) {
    const { data: existingClaims } = await client
      .from("claims")
      .select("subject_id")
      .eq("predicate", "competed_at")
      .eq("object_id", event_id)

    existingClaimPersonIds = new Set((existingClaims ?? []).map((c) => c.subject_id as string))
  }

  // ── 3. Optionally create competed_at claims ───────────────────────────────
  let claimsCreated = 0

  if (create_claims && event_id) {
    // Get event year for start_date
    const { data: eventData } = await client
      .from("events")
      .select("year")
      .eq("id", event_id)
      .single()

    const startDate = eventData?.year ? `${eventData.year}-01-01` : null

    const claimRows = active
      .filter((e) => {
        const pid = e.person_id ?? createdMap.get(e.name)
        return pid && !existingClaimPersonIds.has(pid)
      })
      .map((e) => {
        const subjectId = e.person_id ?? createdMap.get(e.name)!
        return {
          id: generateId(),
          subject_id: subjectId,
          predicate: "competed_at",
          object_id: event_id,
          start_date: startDate,
          confidence: "documented",
          visibility: "public",
          result: e.placement != null ? String(e.placement) : null,
          division: e.division ?? null,
          note: "Imported via Results Scanner",
        }
      })

    if (claimRows.length > 0) {
      const { error } = await client.from("claims").insert(claimRows)
      if (error) {
        return NextResponse.json(
          { error: `People created but claims failed: ${error.message}`, created },
          { status: 400 }
        )
      }
      claimsCreated = claimRows.length
    }
  }

  const matched = active.filter((e) => e.person_id).length

  return NextResponse.json({ created, matched, claims: claimsCreated })
}
