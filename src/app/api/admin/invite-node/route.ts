import { NextRequest, NextResponse } from "next/server"
import { requireEditor, getServiceClient } from "@/lib/auth"
import { verificationTierFor, vouchesRequiredForTier } from "@/lib/claim-request-helpers"
import { applyNodeInvite } from "@/lib/node-invite"
import type { Person } from "@/types"

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

function trackEvent(origin: string, event: string, props: Record<string, unknown>) {
  void fetch(`${origin}/api/track/claim-event`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event, props }),
  }).catch(() => {})
}

// GET /api/admin/invite-node?q=<name> — editor node search for the /admin/claims
// proactive-invite panel. Returns up to 10 invitable (catalog/unclaimed) nodes
// matching the query by name, with any existing invite_email so the panel can
// show an already-invited state. Editor-gated; there is no public people search.
export async function GET(req: NextRequest) {
  const { response } = await requireEditor()
  if (response) return response

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim()
  if (q.length < 2) return NextResponse.json([])

  const db = getServiceClient()
  const { data, error } = await db
    .from("people")
    .select("id, display_name, node_status, invite_email")
    .in("node_status", ["catalog", "unclaimed"])
    .ilike("display_name", `%${q}%`)
    .order("display_name", { ascending: true })
    .limit(10)
  if (error) {
    console.error("[invite-node GET] search failed:", error)
    return NextResponse.json({ error: "Search failed" }, { status: 500 })
  }
  return NextResponse.json(data ?? [])
}

// POST /api/admin/invite-node — node-claim-by-admin-invite, editor-initiated.
//
// The proactive twin of POST /api/public/claim-node: instead of waiting for a
// visitor to submit their own email on the person page, an editor sends the
// invite directly given an email. It inserts an already-approved public_invite
// claim_request (status_reason='admin_invited') so admin-invite-complete binds
// it at signup exactly like a visitor claim an editor approved, then runs the
// shared applyNodeInvite steps (stamp invite_email, flip catalog -> unclaimed,
// send the account-creating magic link).
//
// Body: { node_id, email }. Editor-gated. Eligible nodes are catalog/unclaimed
// only. Re-send to the SAME email is allowed (reuses the existing approved row);
// changing the invited email on an already-invited node is not supported here.
export async function POST(req: NextRequest) {
  const { user, response } = await requireEditor()
  if (response) return response

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const body = (raw ?? {}) as { node_id?: unknown; email?: unknown }
  const nodeId = typeof body.node_id === "string" ? body.node_id.trim() : ""
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
  if (!nodeId) {
    return NextResponse.json({ error: "node_id is required" }, { status: 400 })
  }
  if (!email || !email.includes("@") || email.length < 3) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 })
  }

  const db = getServiceClient()

  const [personRes, claimCountRes] = await Promise.all([
    db
      .from("people")
      .select("id, display_name, node_status, is_notable, is_deceased, invite_email")
      .eq("id", nodeId)
      .maybeSingle(),
    db.from("claims_public").select("*", { count: "exact", head: true }).eq("subject_id", nodeId),
  ])

  const person = personRes.data as
    | (Pick<Person, "id" | "display_name" | "node_status" | "is_notable" | "is_deceased"> & {
        invite_email: string | null
      })
    | null
  if (!person) {
    return NextResponse.json({ error: "Node not found" }, { status: 404 })
  }
  if (person.node_status !== "catalog" && person.node_status !== "unclaimed") {
    return NextResponse.json(
      { error: "This profile is not eligible for an invite (already claimed)." },
      { status: 409 },
    )
  }
  // Re-send only to the same email. Changing the invited email is out of scope.
  if (person.invite_email && person.invite_email.toLowerCase() !== email) {
    return NextResponse.json(
      {
        error: `This node is already invited to ${person.invite_email}. Changing the email is not supported here.`,
      },
      { status: 409 },
    )
  }

  const origin = req.headers.get("origin") ?? req.nextUrl.origin
  const nowIso = new Date().toISOString()

  // Reuse an existing approved public_invite row for the same email (re-send)
  // instead of stacking duplicates in the queue history.
  const { data: existingClaim } = await db
    .from("claim_requests")
    .select("id")
    .eq("node_id", nodeId)
    .eq("claim_kind", "public_invite")
    .eq("claimant_email", email)
    .eq("status", "approved")
    .maybeSingle()

  if (!existingClaim) {
    const claimCount = claimCountRes.count ?? 0
    const tier = verificationTierFor(person, claimCount)
    const { error: insErr } = await db.from("claim_requests").insert({
      claim_kind: "public_invite",
      claimant_id: null,
      claimant_email: email,
      node_id: nodeId,
      verification_tier: tier,
      status: "approved",
      status_reason: "admin_invited",
      // Stored for shape parity; vouches do not apply to public_invite claims.
      vouches_required: vouchesRequiredForTier(tier),
      vouches_received: [],
      evidence_notes: null,
      expires_at: new Date(Date.now() + THIRTY_DAYS_MS).toISOString(),
      resolved_at: nowIso,
      resolved_by: user.id,
    })
    if (insErr) {
      console.error("[invite-node] claim insert failed:", insErr)
      return NextResponse.json({ error: "Could not create the invite." }, { status: 500 })
    }
  }

  const invite = await applyNodeInvite(db, { nodeId, email, origin })
  if (!invite.ok) {
    return NextResponse.json({ error: "Node not found" }, { status: 404 })
  }

  trackEvent(origin, "claim_node_invited", {
    node_id: nodeId,
    surface: "editor",
    resend: !!existingClaim,
  })

  return NextResponse.json({ ok: true, invited_email: email, person_name: invite.personName })
}
