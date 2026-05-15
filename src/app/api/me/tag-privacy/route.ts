import { NextRequest, NextResponse } from "next/server"
import { requireAuth, getServiceClient } from "@/lib/auth"

// GET   /api/me/tag-privacy   — return { require_tag_approval: boolean }
// PATCH /api/me/tag-privacy   — body: { require_tag_approval: boolean }
//
// When require_tag_approval is true, pending tags asserted against this user
// stay hidden from story_riders_public / claims_public until they approve at
// /me/tags. The default (false) is permissive: pending tags are publicly
// visible and the inbox is a notification + remove-tool, not a gate.

export async function GET() {
  const { user, response } = await requireAuth()
  if (response) return response

  const db = getServiceClient()
  const { data, error } = await db
    .from("profiles")
    .select("require_tag_approval")
    .eq("id", user.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    require_tag_approval: Boolean(data?.require_tag_approval ?? false),
  })
}

export async function PATCH(req: NextRequest) {
  const { user, response } = await requireAuth()
  if (response) return response

  const body = await req.json().catch(() => null)
  const next: unknown = body?.require_tag_approval

  if (typeof next !== "boolean") {
    return NextResponse.json(
      { error: "require_tag_approval must be a boolean" },
      { status: 400 },
    )
  }

  const db = getServiceClient()
  const { error } = await db
    .from("profiles")
    .update({ require_tag_approval: next })
    .eq("id", user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, require_tag_approval: next })
}
