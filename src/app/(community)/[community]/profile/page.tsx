import { redirect } from "next/navigation"
import { ownProfilePath } from "@/lib/profile-redirect"

// The in-community profile URL is now a thin redirect to the unified,
// owner-aware /people/[id] page. The viewer's own /people page renders owner
// mode (full timeline toolkit, claims unfiltered by visibility); everyone else
// gets the read-only public view. The old URL keeps working for existing links
// and nav muscle memory. (Profile Unification Phase 2.)
export default async function ProfileRedirect() {
  redirect(await ownProfilePath())
}
