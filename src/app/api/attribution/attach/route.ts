import { NextRequest, NextResponse } from "next/server"
import { requireAuth, getServiceClient } from "@/lib/auth"

// POST /api/attribution/attach — the durable first-touch write (brief T7, D10).
//
// Fire-and-forget by contract: it ALWAYS returns { ok: true } with 200, even on a
// write failure, so it can never affect what the signup flow does next. requireAuth
// also guarantees a profiles row exists (ensureProfile), which the acquisition FK
// needs. The client is not trusted: every value is re-sanitised here.
//
// first_* is write-once. A plain Supabase upsert REPLACES the row on conflict,
// which would let a later sign-in overwrite first-touch, so this inserts and, on a
// 23505 unique violation, updates ONLY the last_* columns. Immutability is enforced
// at the DB access level, not just in the client helper.

const TAG = /[^a-z0-9_.-]/g

function tag(v: unknown): string | null {
  if (typeof v !== "string") return null
  const c = v.toLowerCase().trim().replace(TAG, "").slice(0, 64)
  return c.length ? c : null
}

// referrer (origin-only already) and landing_path legitimately carry "/" and ".",
// so they get a looser bound: trim, drop control chars (code < 32 or DEL), cap length.
function loose(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null
  let c = ""
  for (const ch of v.trim()) {
    const code = ch.charCodeAt(0)
    if (code >= 32 && code !== 127) c += ch
    if (c.length >= max) break
  }
  return c.length ? c : null
}

function iso(v: unknown): string | null {
  if (typeof v !== "string") return null
  const ms = Date.parse(v)
  return Number.isNaN(ms) ? null : new Date(ms).toISOString()
}

interface Touch {
  source?: unknown; medium?: unknown; campaign?: unknown; content?: unknown
  term?: unknown; ref?: unknown; referrer?: unknown; landing_path?: unknown; at?: unknown
}

export async function POST(req: NextRequest) {
  const { user, response } = await requireAuth()
  if (response) return response

  try {
    const body = (await req.json().catch(() => null)) as { first?: Touch; last?: Touch } | null
    const first = (body?.first ?? {}) as Touch
    const last = (body?.last ?? {}) as Touch

    const db = getServiceClient()
    const nowIso = new Date().toISOString()

    const row = {
      profile_id: user.id,
      first_source: tag(first.source),
      first_medium: tag(first.medium),
      first_campaign: tag(first.campaign),
      first_content: tag(first.content),
      first_term: tag(first.term),
      first_ref: tag(first.ref),
      first_referrer: loose(first.referrer, 200),
      first_landing_path: loose(first.landing_path, 200),
      first_seen_at: iso(first.at),
      last_source: tag(last.source),
      last_medium: tag(last.medium),
      last_campaign: tag(last.campaign),
      last_ref: tag(last.ref),
      last_seen_at: iso(last.at),
      created_at: nowIso,
      updated_at: nowIso,
    }

    const { error: insertErr } = await db.from("acquisition").insert(row)
    if (insertErr) {
      // 23505 = row already exists. Update ONLY the last_* columns so first-touch
      // stays immutable at the database level.
      if ((insertErr as { code?: string }).code === "23505") {
        await db
          .from("acquisition")
          .update({
            last_source: row.last_source,
            last_medium: row.last_medium,
            last_campaign: row.last_campaign,
            last_ref: row.last_ref,
            last_seen_at: row.last_seen_at,
            updated_at: nowIso,
          })
          .eq("profile_id", user.id)
      } else {
        console.error("[attribution/attach] insert failed:", insertErr.message)
      }
    }
  } catch (err) {
    console.error("[attribution/attach] threw:", err)
  }

  // Never affects the caller (D10).
  return NextResponse.json({ ok: true })
}
