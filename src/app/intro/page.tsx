import type { Metadata } from "next"
import { IntroSlideshow } from "@/components/onboarding/intro-slideshow"

// Public, chromeless pre-signup slideshow (brief D1). A static top-level route
// wins over the (community)/[community] dynamic route, matching /equity, /word,
// and /founding. No proxy change is needed; the proxy only gates
// /[community]/timeline and /me/*.

export const metadata: Metadata = {
  title: "Welcome to Linestry",
  description:
    "A living, community-authored history of snowboarding. See how your stories connect before you start your timeline.",
}

export default function IntroPage() {
  return <IntroSlideshow />
}
