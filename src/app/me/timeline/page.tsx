import { redirect } from "next/navigation"
import { ownProfilePath } from "@/lib/profile-redirect"

// /me/timeline is the global-scope alias for the viewer's own timeline. It now
// redirects to the unified owner-aware /people/[id] page rather than rendering a
// second copy of the profile. The proxy gates /me/* to /onboarding when signed
// out, so this resolver always runs for an authenticated viewer.
// (Profile Unification Phase 2.)
export default async function MeTimelineRedirect() {
  redirect(await ownProfilePath())
}
