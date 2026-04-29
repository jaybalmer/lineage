import { createClient, SupabaseClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"

export function getServiceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
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
