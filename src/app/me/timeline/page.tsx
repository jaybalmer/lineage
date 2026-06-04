import ProfilePage from "@/app/(community)/[community]/profile/page"

// /me/timeline is the canonical global-scope URL for the viewer's full timeline
// (PB-011 Phase 3A). The profile page already renders the viewer's entire
// cross-community timeline and redirects anonymous users on its own, so we render
// it directly rather than duplicate it. The in-community Timeline lens and the
// avatar "My Timeline" item still resolve to /{slug}/profile.
export default function MeTimelinePage() {
  return <ProfilePage />
}
