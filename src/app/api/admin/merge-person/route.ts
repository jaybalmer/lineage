import { NextRequest, NextResponse } from "next/server"
import { requireEditor, getServiceClient } from "@/lib/auth"

// POST /api/admin/merge-person — editor-initiated "fold this ghost into that
// person" merge, the self-serve front end for public.merge_person_into.
//
// Body: { ghost_id, canonical_id, canonical_kind: 'people'|'profiles',
//         confirm_name, dry_run }.
//
// dry_run defaults to true: the RPC runs the real write path then rolls it back
// via its DRYRN savepoint and returns the exact repoint/dedup counts, writing
// nothing. A commit (dry_run:false) additionally requires confirm_name to
// string-equal the ghost's current display_name, so the destructive fold can
// never fire on a mis-typed id. The route also refuses a self-merge and a ghost
// that is already a claimed account; the RPC re-checks both.
//
// Returns the RPC's jsonb verbatim on success.

export async function POST(req: NextRequest) {
  const { user, response } = await requireEditor()
  if (response) return response

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const body = (raw ?? {}) as {
    ghost_id?: unknown
    canonical_id?: unknown
    canonical_kind?: unknown
    confirm_name?: unknown
    dry_run?: unknown
  }

  const ghostId = typeof body.ghost_id === "string" ? body.ghost_id.trim() : ""
  const canonicalId = typeof body.canonical_id === "string" ? body.canonical_id.trim() : ""
  const canonicalKind = body.canonical_kind === "people" || body.canonical_kind === "profiles"
    ? body.canonical_kind
    : ""
  const confirmName = typeof body.confirm_name === "string" ? body.confirm_name.trim() : ""
  // Safety default: anything other than an explicit false is a dry run.
  const dryRun = body.dry_run !== false

  if (!ghostId) return NextResponse.json({ error: "ghost_id is required" }, { status: 400 })
  if (!canonicalId) return NextResponse.json({ error: "canonical_id is required" }, { status: 400 })
  if (!canonicalKind) {
    return NextResponse.json({ error: "canonical_kind must be 'people' or 'profiles'" }, { status: 400 })
  }
  if (ghostId === canonicalId) {
    return NextResponse.json({ error: "ghost and canonical are the same id" }, { status: 400 })
  }

  const db = getServiceClient()

  // Load the ghost to validate it is a genuine, unclaimed people node and to
  // check the typed confirmation against its real name.
  const { data: ghostRow, error: ghostErr } = await db
    .from("people")
    .select("id, display_name, node_status, claimed_by")
    .eq("id", ghostId)
    .maybeSingle()
  if (ghostErr) {
    console.error("[merge-person] ghost lookup failed:", ghostErr)
    return NextResponse.json({ error: "Ghost lookup failed" }, { status: 500 })
  }
  const ghost = ghostRow as
    | { id: string; display_name: string; node_status: string; claimed_by: string | null }
    | null
  if (!ghost) return NextResponse.json({ error: "Ghost node not found" }, { status: 404 })
  if (ghost.claimed_by) {
    return NextResponse.json(
      { error: "That node is a claimed account, not a ghost. It cannot be merged away." },
      { status: 409 },
    )
  }

  // A commit requires the typed name to match exactly; a dry run does not, so an
  // editor can preview the counts before committing to the name check.
  if (!dryRun && confirmName !== ghost.display_name) {
    return NextResponse.json(
      { error: `Type the ghost's exact name to confirm: "${ghost.display_name}"` },
      { status: 400 },
    )
  }

  const { data, error } = await db.rpc("merge_person_into", {
    p_ghost_id: ghostId,
    p_canonical_id: canonicalId,
    p_canonical_kind: canonicalKind,
    p_admin_id: user.id,
    p_dry_run: dryRun,
    p_note: `admin_merge by ${user.id}`,
  })
  if (error) {
    // The RPC's guards surface as messages (ghost_is_claimed_account,
    // canonical_row_missing, non_uuid_*, ghost_equals_canonical, ...). Return as
    // a 400 so the panel can show the reason.
    console.error("[merge-person] merge_person_into failed:", error)
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(data)
}
