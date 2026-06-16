// PB-010 Phase 4a — abuse control + hashing for the anonymous public tag endpoint.
//
// The "I was there" button on /t/{slug} is an UNAUTHENTICATED write, so this
// module is the gate in front of it. It reuses the PB-009 tag_throttle and
// tag_blocklist tables (no new schema): a rolling daily counter per email/owner
// and per ip, plus a blocklist check. We never store the raw email or ip — only
// an HMAC hash, which is also what the tag_blocklist cascade trigger matches on
// (->>'email_hash' / ->>'ip_hash').

import crypto from "crypto"
import type { NextRequest } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"

// ── Starting thresholds (brief §8 D1, confirmed) ────────────────────────────
// Config constants, tune freely. Email is scoped per owner (you can mark a few
// moments on one person's timeline); ip is global across owners.
export const TAG_LIMIT_EMAIL_PER_OWNER_PER_DAY = 3
export const TAG_LIMIT_IP_PER_DAY = 8

// ── Hashing ──────────────────────────────────────────────────────────────────
// HMAC-SHA256 keyed off the service-role secret (same derivation as
// email-pref-token.ts) so the hash is deterministic for matching but not a
// plain digest anyone could rainbow-table from a guessed email.

function signingKey(): string {
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
  return crypto.createHash("sha256").update(`public-tag:${base}`).digest("hex")
}

/** Stable hash of a normalized visitor value (email or ip). Lowercased + trimmed. */
export function hashVisitorValue(value: string): string {
  return crypto
    .createHmac("sha256", signingKey())
    .update(value.trim().toLowerCase())
    .digest("hex")
}

/** Best-effort client ip from the proxy headers Vercel sets. Never throws;
 *  falls back to a constant so throttling still groups unknown-ip traffic. */
export function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for")
  if (fwd) {
    const first = fwd.split(",")[0]?.trim()
    if (first) return first
  }
  return req.headers.get("x-real-ip")?.trim() || "0.0.0.0"
}

// ── Blocklist ──────────────────────────────────────────────────────────────
// Reject up front if this visitor's email or ip is blocked, either globally or
// for this specific owner. block_kind='user' rows key on a profile id and never
// match an anonymous visitor, so we only look at email/ip kinds here.

export async function isVisitorBlocked(
  db: SupabaseClient,
  args: { emailHash: string; ipHash: string; ownerId: string },
): Promise<boolean> {
  const { data, error } = await db
    .from("tag_blocklist")
    .select("id, scope, subject_id")
    .in("block_kind", ["email", "ip"])
    .in("blocked_party", [args.emailHash, args.ipHash])
  if (error) {
    // Fail open on a transient read error (mirrors isAsserterGloballyBlocked):
    // a missed block costs one tag; refusing every write during a blip is worse.
    console.error("[public-tag] blocklist check failed:", error.message)
    return false
  }
  return ((data ?? []) as { scope: string; subject_id: string | null }[]).some(
    (r) => r.scope === "global" || (r.scope === "subject" && r.subject_id === args.ownerId),
  )
}

// ── Throttle ────────────────────────────────────────────────────────────────

function dayWindowStart(): string {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

interface CounterRow { id: string; tag_count: number }

async function readCounter(
  db: SupabaseClient,
  args: { actorKind: "email" | "ip"; actorKey: string; layer: string; ownerId: string | null; windowStart: string },
): Promise<CounterRow | null> {
  let q = db
    .from("tag_throttle")
    .select("id, tag_count")
    .eq("actor_kind", args.actorKind)
    .eq("actor_key", args.actorKey)
    .eq("layer", args.layer)
    .eq("window_start", args.windowStart)
  q = args.ownerId === null ? q.is("scope_owner_id", null) : q.eq("scope_owner_id", args.ownerId)
  const { data } = await q.limit(1).maybeSingle()
  return (data as CounterRow | null) ?? null
}

export type ThrottleReason = "email_limit" | "ip_limit"

/** Read-only pre-check. Returns the reason a tag is over-limit, or null when ok. */
export async function checkTagThrottle(
  db: SupabaseClient,
  args: { emailHash: string; ipHash: string; ownerId: string },
): Promise<ThrottleReason | null> {
  const windowStart = dayWindowStart()
  const [emailRow, ipRow] = await Promise.all([
    readCounter(db, { actorKind: "email", actorKey: args.emailHash, layer: "L1_email", ownerId: args.ownerId, windowStart }),
    readCounter(db, { actorKind: "ip", actorKey: args.ipHash, layer: "L2_ip", ownerId: null, windowStart }),
  ])
  if ((emailRow?.tag_count ?? 0) >= TAG_LIMIT_EMAIL_PER_OWNER_PER_DAY) return "email_limit"
  if ((ipRow?.tag_count ?? 0) >= TAG_LIMIT_IP_PER_DAY) return "ip_limit"
  return null
}

/** Increment both daily counters after a tag lands. Read-or-insert then bump.
 *  A small race here can let a request or two slip past the cap; acceptable for
 *  an abuse throttle at this volume. Best-effort: never throws. */
export async function recordTagThrottle(
  db: SupabaseClient,
  args: { emailHash: string; ipHash: string; ownerId: string },
): Promise<void> {
  const windowStart = dayWindowStart()
  await Promise.all([
    bump(db, { actorKind: "email", actorKey: args.emailHash, layer: "L1_email", ownerId: args.ownerId, windowStart }),
    bump(db, { actorKind: "ip", actorKey: args.ipHash, layer: "L2_ip", ownerId: null, windowStart }),
  ])
}

async function bump(
  db: SupabaseClient,
  args: { actorKind: "email" | "ip"; actorKey: string; layer: string; ownerId: string | null; windowStart: string },
): Promise<void> {
  const existing = await readCounter(db, args)
  if (existing) {
    const { error } = await db
      .from("tag_throttle")
      .update({ tag_count: existing.tag_count + 1 })
      .eq("id", existing.id)
    if (error) console.error("[public-tag] throttle bump failed:", error.message)
    return
  }
  const { error } = await db.from("tag_throttle").insert({
    actor_kind: args.actorKind,
    actor_key: args.actorKey,
    scope_owner_id: args.ownerId,
    layer: args.layer,
    window_start: args.windowStart,
    tag_count: 1,
  })
  if (error) console.error("[public-tag] throttle insert failed:", error.message)
}
