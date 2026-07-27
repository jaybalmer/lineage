import { NextRequest, NextResponse } from "next/server"
import { requireAuth, getServiceClient } from "@/lib/auth"

// PATCH /api/me/profile-curation
//   body: { profile_statement?: string | null, profile_milestones?: { year, label }[] }
//
// The server-side gate for the Curated Member Profile (D8). These two fields are
// the paid differentiator, so the write is rejected for free-tier callers even
// though the UI already hides the editor: the perk has to be real, not merely
// hidden. The gate reads the caller's live membership_tier server-side. A free
// caller's existing fields are left untouched (403, no write).
//
// Statement + milestones only; every other profile field keeps its existing
// write path (the Edit Profile modal's direct profiles update). Kept in one
// reviewable route rather than an RLS policy so the tier check is legible.

const STATEMENT_MAX = 600
const MILESTONE_LABEL_MAX = 120
const MAX_MILESTONES = 20
const PAID_TIERS = new Set(["annual", "lifetime", "founding"])

type Milestone = { year: number; label: string }

/** Validate + normalize the milestones array, or return null when malformed.
 *  Drops rows without a sane year or a non-empty label, clamps counts + text,
 *  and sorts ascending by year so the spine renders in order. */
function cleanMilestones(value: unknown): Milestone[] | null {
  if (value == null) return []
  if (!Array.isArray(value)) return null
  const out: Milestone[] = []
  for (const raw of value) {
    if (typeof raw !== "object" || raw === null) continue
    const r = raw as Record<string, unknown>
    const year = typeof r.year === "number" ? Math.trunc(r.year) : parseInt(String(r.year), 10)
    const label = typeof r.label === "string" ? r.label.trim() : ""
    if (!Number.isFinite(year) || year < 1900 || year > 2100) continue
    if (!label) continue
    out.push({ year, label: label.slice(0, MILESTONE_LABEL_MAX) })
    if (out.length >= MAX_MILESTONES) break
  }
  out.sort((a, b) => a.year - b.year)
  return out
}

export async function PATCH(req: NextRequest) {
  const { user, response } = await requireAuth()
  if (response) return response

  const db = getServiceClient()

  // Live-tier gate: only annual|lifetime|founding may write the curated fields.
  const { data: profile, error: readErr } = await db
    .from("profiles")
    .select("membership_tier")
    .eq("id", user.id)
    .single()
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 })

  const tier = (profile?.membership_tier ?? "free") as string
  if (!PAID_TIERS.has(tier)) {
    return NextResponse.json(
      { error: "A curated member page is a membership benefit." },
      { status: 403 },
    )
  }

  const body = await req.json().catch(() => null)
  const update: { profile_statement?: string | null; profile_milestones?: Milestone[] } = {}

  if ("profile_statement" in (body ?? {})) {
    const raw = body.profile_statement
    if (raw != null && typeof raw !== "string") {
      return NextResponse.json({ error: "profile_statement must be a string" }, { status: 400 })
    }
    const trimmed = typeof raw === "string" ? raw.trim().slice(0, STATEMENT_MAX) : ""
    update.profile_statement = trimmed || null
  }

  if ("profile_milestones" in (body ?? {})) {
    const cleaned = cleanMilestones(body.profile_milestones)
    if (cleaned === null) {
      return NextResponse.json({ error: "profile_milestones must be an array" }, { status: 400 })
    }
    update.profile_milestones = cleaned
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
  }

  const { error } = await db.from("profiles").update(update).eq("id", user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, ...update })
}
