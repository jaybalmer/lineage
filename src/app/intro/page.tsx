import { redirect } from "next/navigation"

// /intro used to be a standalone pre-signup slideshow that handed off to the
// wizard at /onboarding. The two merged into a single story (the pitch beats
// and the two questions are now one flow), so this route only survives as a
// redirect: the link is in the wild, in emails and posts, and must keep
// landing somewhere sensible.
//
// The from=intro tag is preserved so the existing PostHog funnel can still tell
// an /intro arrival apart from a direct one.

export default function IntroPage() {
  redirect("/onboarding?from=intro")
}
