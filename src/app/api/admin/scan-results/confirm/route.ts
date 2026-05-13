import { NextRequest, NextResponse } from "next/server"
import { requireEditor, getServiceClient } from "@/lib/auth"
import { insertTagEvent } from "@/lib/tag-events"

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

function generateId() {
  // crypto.randomUUID() is available in the Node.js/Edge runtime
  return crypto.randomUUID()
}

export async function POST(req: NextRequest) {
  const { user, response } = await requireEditor()
  if (response) return response

  const body = await req.json() as RequestBody
  const { entries, event_id, create_claims } = body

  // Use authenticated user's ID instead of trusting request body
  const added_by = user.id

  if (!entries || entries.length === 0) {
    return NextResponse.json({ error: "entries is required" }, { status: 400 })
  }

  const client = getServiceClient()

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
      node_status: "unclaimed",
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
  // PB-009 Phase 1: dedup against claims_public so a previously-declined
  // competed_at row doesn't block re-creation. Phase 1 has every row as
  // 'approved' so this is currently identical to reading the table. Phase 2+
  // we revisit — a declined claim might mean "person said this wasn't them",
  // in which case re-creating is undesirable.
  let existingClaimPersonIds = new Set<string>()
  if (create_claims && event_id) {
    const { data: existingClaims } = await client
      .from("claims_public")
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

      // PB-009 Phase 1: pair each editor-asserted competed_at claim with a
      // tag_event. source='editor' lands as 'approved' in Phase 1, same as
      // 'member', but Phase 2's editor queue distinguishes the source for
      // analytics and Phase 5's protected-tier co-sign routing relies on it.
      // Failures are logged but do not 500 — the claim rows are saved and the
      // _public view falls back to "treat NULL tag_event_id as approved".
      let pairFailures = 0
      for (const row of claimRows) {
        const tagEventId = await insertTagEvent(client, {
          source: "editor",
          asserterId: added_by,
          subjectId: row.subject_id,
          predicate: row.predicate,
          momentRef: { claim_id: row.id },
        })
        if (!tagEventId) { pairFailures += 1; continue }
        const { error: updateErr } = await client
          .from("claims")
          .update({ tag_event_id: tagEventId })
          .eq("id", row.id)
        if (updateErr) {
          console.error("[scan-results/confirm] claims.tag_event_id update failed:", updateErr.message)
          pairFailures += 1
        }
      }
      if (pairFailures > 0) {
        console.error(`[scan-results/confirm] ${pairFailures}/${claimRows.length} tag_event pairings failed`)
      }
    }
  }

  const matched = active.filter((e) => e.person_id).length

  return NextResponse.json({ created, matched, claims: claimsCreated })
}
