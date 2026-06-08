import { createClient, SupabaseClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase-server"

export function getServiceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Idempotently insert a minimal profile row for an auth user that doesn't
// already have one. Guards the orphan-auth-user case where signup was abandoned
// between magic-link click and onboarding completion — without this, every
// auth-gated surface (/api/me, /me/tags, etc.) silently fails for that user.
// Existing rows are untouched; onboarding fills the real fields via UPDATE.
//
// profiles.display_name is NOT NULL, so the placeholder mirrors the fallback
// in /auth/complete: email local-part, else "Rider".
export async function ensureProfile(userId: string, email?: string): Promise<void> {
  const placeholderName = email?.split("@")[0] || "Rider"
  const db = getServiceClient()
  const { error } = await db
    .from("profiles")
    .upsert(
      { id: userId, display_name: placeholderName, privacy_level: "public" },
      { onConflict: "id", ignoreDuplicates: true }
    )
  if (error) {
    console.error("ensureProfile failed:", { userId, error })
  }
}

/** Verify the caller has a valid session. Returns { user } on success or { response } with a 401. */
export async function requireAuth(): Promise<
  | { user: { id: string; email?: string }; response: null }
  | { user: null; response: NextResponse }
> {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      user: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  await ensureProfile(user.id, user.email)

  return { user, response: null }
}

/** Verify the caller has a valid session AND is_editor = true in their membership row. */
export async function requireEditor(): Promise<
  | { user: { id: string; email?: string }; profile: Record<string, unknown>; response: null }
  | { user: null; profile: null; response: NextResponse }
> {
  const { user, response } = await requireAuth()
  if (response) return { user: null, profile: null, response }

  const db = getServiceClient()
  const { data: profile } = await db
    .from("profiles")
    .select("is_editor, membership_tier")
    .eq("id", user.id)
    .single()

  const isEditor = profile?.is_editor || profile?.membership_tier === "founding"
  if (!isEditor) {
    return {
      user: null,
      profile: null,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    }
  }

  return { user, profile, response: null }
}

/**
 * PB-009 Phase 3 — tightened gate for moderation surfaces.
 *
 * Unlike requireEditor() (founding OR is_editor), this helper requires
 * is_editor=true. Founding membership alone does NOT grant moderation
 * access. Used by /admin/tag-queue, /admin/asserters/[id], and the
 * /api/admin/tag-events/* + /api/admin/asserters/* route families. Keep
 * requireEditor() in place for the existing claim-request UI; those
 * surfaces are intentionally open to founding members.
 */
export async function requireModerator(): Promise<
  | { user: { id: string; email?: string }; profile: Record<string, unknown>; response: null }
  | { user: null; profile: null; response: NextResponse }
> {
  const { user, response } = await requireAuth()
  if (response) return { user: null, profile: null, response }

  const db = getServiceClient()
  const { data: profile } = await db
    .from("profiles")
    .select("is_editor, membership_tier")
    .eq("id", user.id)
    .single()

  if (!profile?.is_editor) {
    return {
      user: null,
      profile: null,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    }
  }

  return { user, profile, response: null }
}

/**
 * Server-component gate for the /admin/* page tree (see src/app/admin/layout.tsx).
 *
 * Mirrors requireEditor()'s authority check (is_editor OR founding) but
 * redirect()s instead of returning a JSON response, so it can be awaited from a
 * layout/page Server Component. Non-editors never receive any admin HTML/JS.
 * Anonymous visitors are sent to sign-in; signed-in non-editors are sent home.
 *
 * This is the page-visibility boundary only. The per-route API handlers keep
 * their own finer-grained checks (requireEditor for the dataset/membership
 * editor, requireModerator for tag-queue / activity / asserters), so authority
 * to mutate is still enforced server-side at the data layer.
 */
export async function requireEditorPage(): Promise<void> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/signin")

  const db = getServiceClient()
  const { data: profile } = await db
    .from("profiles")
    .select("is_editor, membership_tier")
    .eq("id", user.id)
    .single()

  const isEditor = profile?.is_editor || profile?.membership_tier === "founding"
  if (!isEditor) redirect("/")
}
