import { NextRequest, NextResponse } from "next/server"
import { requireAuth, getServiceClient } from "@/lib/auth"
import { verificationTierFor, vouchesRequiredForTier } from "@/lib/claim-request-helpers"
import { claimSubmittedHtml, claimSubmittedText, sendClaimEmail } from "@/lib/emails/claim-emails"
import type { Person } from "@/types"

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

function trackEvent(origin: string, event: string, props: Record<string, unknown>) {
  void fetch(`${origin}/api/track/claim-event`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event, props }),
  }).catch(() => {})
}

// ── GET /api/claim-requests?node_id=<id> ──────────────────────────────────────
// Public: returns open claim requests (pending|vouched, not expired) for a
// person node, oldest first. Each row is enriched with the claimant's
// display_name and avatar_url so the vouch surface can render without an
// extra round-trip.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const nodeId = searchParams.get("node_id")
  if (!nodeId) {
    return NextResponse.json({ error: "node_id is required" }, { status: 400 })
  }

  try {
    const db = getServiceClient()
    const { data: rawRequests, error } = await db
      .from("claim_requests")
      .select("*")
      .eq("node_id", nodeId)
      .in("status", ["pending", "vouched"])
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true })

    if (error) {
      console.error("[claim-requests GET]", error)
      return NextResponse.json({ error: "Failed to load" }, { status: 500 })
    }

    // D5: the public vouch surface is member-to-member. Email-first
    // (public_invite) claims have no claimant profile to vouch for, so exclude
    // any row without a claimant_id — they live only in the admin queue.
    const requests = (rawRequests ?? []).filter(
      (r) => r.claim_kind !== "public_invite" && r.claimant_id,
    )

    const claimantIds = Array.from(
      new Set(requests.map((r) => r.claimant_id as string)),
    )
    const profileMap = new Map<string, { display_name: string; avatar_url: string | null }>()
    if (claimantIds.length) {
      const { data: profiles } = await db
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", claimantIds)
      for (const p of profiles ?? []) {
        if (p.id) profileMap.set(p.id, { display_name: p.display_name ?? "Unknown", avatar_url: p.avatar_url ?? null })
      }
    }

    const enriched = requests.map((r) => ({
      ...r,
      claimant: profileMap.get(r.claimant_id as string) ?? { display_name: "Unknown", avatar_url: null },
    }))

    return NextResponse.json(enriched)
  } catch (err) {
    console.error("[claim-requests GET] unexpected:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ── POST /api/claim-requests ──────────────────────────────────────────────────
// Body: { node_id: string, evidence_notes?: string }
// Auth: any authenticated user.
//
// Server-derived: verification_tier (from is_notable/is_deceased + claim count),
// vouches_required (1/3/5), expires_at (now + 30 days), claimant_id (user.id).
export async function POST(req: NextRequest) {
  const { user, response: authResponse } = await requireAuth()
  if (authResponse) return authResponse

  try {
    const body = await req.json() as { node_id?: string; evidence_notes?: string }
    const nodeId = body.node_id?.trim()
    if (!nodeId) {
      return NextResponse.json({ error: "node_id is required" }, { status: 400 })
    }

    const evidenceNotes = body.evidence_notes?.trim() || null
    const db = getServiceClient()

    // Fetch person + claim count in parallel
    const [personRes, claimCountRes] = await Promise.all([
      db.from("people")
        .select("id, display_name, node_status, is_notable, is_deceased")
        .eq("id", nodeId)
        .maybeSingle(),
      // PB-009 Phase 1: read through claims_public so declined tags don't
      // inflate the verification-tier count. Phase 1 has every row as
      // 'approved' so this is currently a no-op; Phase 2+ this matters.
      db.from("claims_public")
        .select("*", { count: "exact", head: true })
        .eq("subject_id", nodeId),
    ])

    const person = personRes.data as Pick<Person, "id" | "display_name" | "node_status" | "is_notable" | "is_deceased"> | null
    if (!person) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 })
    }
    if (person.node_status !== "catalog" && person.node_status !== "unclaimed") {
      return NextResponse.json(
        { error: "This profile is no longer accepting claim requests" },
        { status: 409 },
      )
    }

    // Block duplicate open claims by the same user
    const { data: existing } = await db
      .from("claim_requests")
      .select("id, status, expires_at")
      .eq("node_id", nodeId)
      .eq("claimant_id", user.id)
      .in("status", ["pending", "vouched"])
      .gt("expires_at", new Date().toISOString())
      .maybeSingle()
    if (existing) {
      return NextResponse.json(
        { error: "You already have an open claim on this profile", id: existing.id },
        { status: 409 },
      )
    }

    const claimCount = claimCountRes.count ?? 0
    const tier = verificationTierFor(person, claimCount)
    const vouchesRequired = vouchesRequiredForTier(tier)
    const expiresAt = new Date(Date.now() + THIRTY_DAYS_MS).toISOString()

    const { data: inserted, error: insertError } = await db
      .from("claim_requests")
      .insert({
        claimant_id: user.id,
        node_id: nodeId,
        verification_tier: tier,
        status: "pending",
        vouches_required: vouchesRequired,
        vouches_received: [],
        evidence_notes: evidenceNotes,
        expires_at: expiresAt,
      })
      .select("*")
      .single()

    if (insertError || !inserted) {
      console.error("[claim-requests POST] insert failed:", insertError)
      return NextResponse.json({ error: "Failed to create claim request" }, { status: 500 })
    }

    // Track + email (fire-and-forget; don't fail the request on transport errors)
    const origin = req.headers.get("origin") ?? req.nextUrl.origin
    trackEvent(origin, "claim_requested", {
      claim_request_id: inserted.id,
      node_id: nodeId,
      verification_tier: tier,
      vouches_required: vouchesRequired,
    })

    if (user.email) {
      void sendClaimEmail({
        to: user.email,
        subject: `Your claim on ${person.display_name}`,
        html: claimSubmittedHtml(person.display_name, vouchesRequired),
        text: claimSubmittedText(person.display_name, vouchesRequired),
      })
    }

    return NextResponse.json(inserted)
  } catch (err) {
    console.error("[claim-requests POST] unexpected:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
