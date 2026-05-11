import { NextRequest, NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { requireEditor, getServiceClient } from "@/lib/auth"
import { nameToSlug } from "@/lib/utils"
import {
  claimApprovedHtml,
  claimDeniedHtml,
  sendClaimEmail,
} from "@/lib/emails/claim-emails"
import type { ClaimRequest, MergePersonResult } from "@/types"

function trackEvent(origin: string, event: string, props: Record<string, unknown>) {
  void fetch(`${origin}/api/track/claim-event`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event, props }),
  }).catch(() => {})
}

function trackError(origin: string, tag: string, payload: Record<string, unknown>) {
  void fetch(`${origin}/api/track/claim-error`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tag, payload }),
  }).catch(() => {})
}

function sumDedupCounts(refs: Record<string, string[]> | null | undefined): number {
  if (!refs) return 0
  let total = 0
  for (const arr of Object.values(refs)) total += Array.isArray(arr) ? arr.length : 0
  return total
}

type Action =
  | { action: "approve" }
  | { action: "deny" }
  | { action: "update_notes"; editor_notes: string | null }

function parseAction(body: unknown): Action | null {
  if (!body || typeof body !== "object") return null
  const b = body as Record<string, unknown>
  if (b.action === "approve") return { action: "approve" }
  if (b.action === "deny") return { action: "deny" }
  if (b.action === "update_notes") {
    const n = b.editor_notes
    if (n === null || typeof n === "string") {
      return { action: "update_notes", editor_notes: n }
    }
  }
  return null
}

// ── PATCH /api/claim-requests/[id] ────────────────────────────────────────────
// Admin-only. Body is one of:
//   { action: "approve" }
//   { action: "deny" }
//   { action: "update_notes", editor_notes: string | null }
//
// Approve path (PB-008 Phase 2 Session 3):
//   Delegates to public.merge_person() — a single Postgres transaction that
//   flips claim status, repoints every people-referencing FK from the ghost
//   row to the claimant's canonical row (Path B) or claims the ghost in
//   place (Path A), auto-denies competing pending claims, writes merge_log,
//   and (Path B) hard-deletes the ghost. Idempotent: re-clicking or two
//   simultaneous calls both resolve to noop=true via the FOR UPDATE lock on
//   the claim_requests row inside the RPC.
//
// After a non-noop success, revalidateTag("person-redirects", { expire: 0 })
// flushes the proxy's alias map so the merged URL redirects immediately.
// Two-arg form is required by Next 16; updateTag() is Server-Action-only
// and would 500 in a Route Handler.
//
// Deny + update_notes paths are unchanged from Session 2 — simple field
// writes with a race guard on status.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { user, response: authResponse } = await requireEditor()
  if (authResponse) return authResponse

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const action = parseAction(raw)
  if (!action) {
    return NextResponse.json(
      { error: "action must be one of: approve, deny, update_notes" },
      { status: 400 },
    )
  }

  const db = getServiceClient()

  const { data: existing, error: fetchError } = await db
    .from("claim_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle()
  if (fetchError) {
    console.error("[admin claim PATCH] fetch failed:", fetchError)
    return NextResponse.json({ error: "Failed to load claim request" }, { status: 500 })
  }
  if (!existing) {
    return NextResponse.json({ error: "Claim request not found" }, { status: 404 })
  }

  const current = existing as ClaimRequest
  const origin = req.headers.get("origin") ?? req.nextUrl.origin
  const nowIso = new Date().toISOString()

  // ── update_notes is a simple field write; no transition ──
  if (action.action === "update_notes") {
    const { data: updated, error } = await db
      .from("claim_requests")
      .update({
        editor_notes: action.editor_notes,
        updated_at: nowIso,
      })
      .eq("id", id)
      .select("*")
      .single()
    if (error || !updated) {
      console.error("[admin claim PATCH update_notes]", error)
      return NextResponse.json({ error: "Failed to update notes" }, { status: 500 })
    }
    return NextResponse.json(updated)
  }

  // ── approve / deny: status transition ──
  if (current.status !== "pending" && current.status !== "vouched") {
    return NextResponse.json(
      { error: `Claim is already ${current.status}; cannot ${action.action}` },
      { status: 409 },
    )
  }

  // ── APPROVE path: route everything through public.merge_person() ─────────
  // The RPC handles status flip, FK repoint, ghost delete, merge_log write,
  // alias inserts, and competing-claim auto-deny — all in one transaction.
  // Idempotent + concurrent-safe: the FOR UPDATE lock on claim_requests
  // inside the RPC serialises racing approvers; the loser falls through the
  // idempotency check and returns noop=true.
  if (action.action === "approve") {
    const { data: rpcData, error: rpcError } = await db.rpc("merge_person", {
      p_claim_request_id: id,
      p_admin_id: user.id,
    })

    if (rpcError) {
      const msg = rpcError.message ?? ""
      if (msg.includes("canonical_row_lookup_ambiguous")) {
        trackError(origin, "canonical_row_lookup_ambiguous", {
          claim_request_id: id, claimant_id: current.claimant_id, node_id: current.node_id,
        })
        return NextResponse.json(
          { error: "Claimant has multiple candidate canonical rows — manual admin review required." },
          { status: 409 },
        )
      }
      if (msg.includes("path_b_unavailable_non_uuid_ghost_id") || msg.includes("path_b_unavailable_non_uuid_canonical_id")) {
        trackError(origin, "fk_repoint_orphan", {
          claim_request_id: id, node_id: current.node_id, reason: "non_uuid_id",
        })
        return NextResponse.json(
          { error: "This person's id is not in UUID format; merge cannot run safely until the id is migrated." },
          { status: 409 },
        )
      }
      if (msg.includes("merge_idempotency_check_failed")) {
        trackError(origin, "merge_idempotency_check_failed", {
          claim_request_id: id, message: msg,
        })
        return NextResponse.json(
          { error: "Merge state inconsistent — escalate." },
          { status: 500 },
        )
      }
      if (msg.includes("claim_request_not_actionable") || msg.includes("claim_request_not_found") || msg.includes("ghost_row_missing")) {
        return NextResponse.json({ error: msg }, { status: 409 })
      }
      console.error("[admin claim PATCH approve rpc]", rpcError)
      trackError(origin, "merge_partial_failure", { claim_request_id: id, message: msg })
      return NextResponse.json({ error: "Merge failed" }, { status: 500 })
    }

    const result = rpcData as MergePersonResult

    // Cache-bust the redirect map ONLY if a real merge happened. Noop replays
    // don't change the alias surface, so we skip the revalidate to avoid a
    // thundering-herd of refreshes when admins double-click approve.
    if (!result.noop) {
      revalidateTag("person-redirects", { expire: 0 })
    }

    trackEvent(origin, "claim_approved", {
      claim_request_id: id,
      path: result.path,
      noop: result.noop,
      ghost_id: result.ghost_id,
      canonical_id: result.canonical_id,
      references_repointed: result.references_repointed,
      deduplicated: sumDedupCounts(result.references_deduplicated),
      alias_rewrites: result.alias_rewrites,
      claim_requests_auto_denied: result.claim_requests_auto_denied,
    })

    // Re-load the (now resolved) claim_request so the response matches the
    // pre-RPC shape clients expect.
    const { data: resolved, error: reloadErr } = await db
      .from("claim_requests")
      .select("*")
      .eq("id", id)
      .single()
    if (reloadErr || !resolved) {
      console.error("[admin claim PATCH approve reload]", reloadErr)
      return NextResponse.json({ error: "Approved but failed to reload" }, { status: 500 })
    }

    // Email claimant — skipped on noop replays so we don't double-send.
    if (!result.noop) {
      try {
        const [{ data: claimantUser }, { data: person }] = await Promise.all([
          db.auth.admin.getUserById(current.claimant_id),
          db.from("people").select("display_name").eq("id", result.canonical_id).maybeSingle(),
        ])
        const email = claimantUser.user?.email
        const personName = person?.display_name ?? "your profile"
        if (email) {
          const profileLink = `${origin}/people/${nameToSlug(personName) || result.canonical_id}`
          void sendClaimEmail({
            to: email,
            subject: `Your claim was approved`,
            html: claimApprovedHtml(personName, profileLink),
          })
        }
      } catch (err) {
        console.error("[admin claim PATCH approve email]", err)
      }
    }

    return NextResponse.json(resolved)
  }

  // ── DENY path: simple status flip (no merge) ─────────────────────────────
  const { data: updated, error: updateError } = await db
    .from("claim_requests")
    .update({
      status: "denied",
      status_reason: "editor_denied",
      resolved_at: nowIso,
      resolved_by: user.id,
      updated_at: nowIso,
    })
    .eq("id", id)
    .eq("status", current.status) // race guard against another editor
    .select("*")
    .single()

  if (updateError || !updated) {
    console.error("[admin claim PATCH deny]", updateError)
    return NextResponse.json(
      { error: "Status changed in another session; please refresh" },
      { status: 409 },
    )
  }

  trackEvent(origin, "claim_status_changed", {
    claim_request_id: id,
    from: current.status,
    to: "denied",
    reason: "editor_denied",
  })

  try {
    const [{ data: claimantUser }, { data: person }] = await Promise.all([
      db.auth.admin.getUserById(current.claimant_id),
      db.from("people").select("display_name").eq("id", current.node_id).maybeSingle(),
    ])
    const email = claimantUser.user?.email
    const personName = person?.display_name ?? "your profile"
    if (email) {
      void sendClaimEmail({
        to: email,
        subject: `About your claim on ${personName}`,
        html: claimDeniedHtml(personName, updated.editor_notes ?? null),
      })
    }
  } catch (err) {
    console.error("[admin claim PATCH deny email/lookup]", err)
  }

  return NextResponse.json(updated)
}
