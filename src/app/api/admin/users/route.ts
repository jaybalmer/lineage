import { NextResponse } from "next/server"
import { requireEditor, getServiceClient } from "@/lib/auth"

// ─── GET /api/admin/users ── list all profiles for the archive admin surface ──
//
// Mirrors GET /api/admin/memberships (requireEditor gate, service-role read,
// emails joined from auth.users) but returns the archive fields instead of the
// full membership/token payload. Used by /admin/users.
export async function GET() {
  const { response } = await requireEditor()
  if (response) return response

  const client = getServiceClient()

  const { data: profiles, error } = await client
    .from("profiles")
    .select("id, display_name, membership_tier, created_at, is_archived, archived_at")
    .order("created_at", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: { users }, error: authErr } = await client.auth.admin.listUsers({ perPage: 1000 })
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 500 })

  const emailById = Object.fromEntries(users.map((u) => [u.id, u.email ?? ""]))

  // Acquisition ("Came from"), joined in JS like the email join above rather than a
  // PostgREST embed, matching this file's existing pattern. A member with no row
  // (signed up before attribution shipped) simply gets nulls -> "Unknown" in the UI.
  const { data: acq } = await client
    .from("acquisition")
    .select("profile_id, first_source, first_campaign, first_ref")
  const acqById = Object.fromEntries(
    (acq ?? []).map((a) => [a.profile_id as string, a]),
  )

  const members = (profiles ?? []).map((p) => {
    const a = acqById[p.id]
    return {
      ...p,
      email: emailById[p.id] ?? "",
      first_source: a?.first_source ?? null,
      first_campaign: a?.first_campaign ?? null,
      first_ref: a?.first_ref ?? null,
    }
  })

  return NextResponse.json({ members })
}
