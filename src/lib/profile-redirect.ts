import { createServerSupabaseClient } from "@/lib/supabase-server"

/**
 * Server-side: the path to the signed-in viewer's own unified profile,
 * `/people/{id}`. The destination (`src/app/people/[id]/page.tsx`) renders owner
 * mode for the viewer and canonicalizes the id to the name slug via
 * `useCanonicalPath`, so we redirect to the stable id here and let the page swap
 * the address bar to `/people/{slug}` with no reload.
 *
 * Anonymous callers get `/people` (the public riders directory), matching the
 * old `ProfilePage` anon behaviour. `/me/*` is proxy-gated to `/onboarding`
 * before reaching the `/me/timeline` redirect, so the anon branch only ever
 * fires for the public `/{community}/profile` route.
 */
export async function ownProfilePath(): Promise<string> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user ? `/people/${user.id}` : "/people"
}
