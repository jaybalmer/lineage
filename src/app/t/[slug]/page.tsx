import { cache } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PublicProfileView } from "@/components/public-timeline/public-profile-view"
import { PublicEpisodeView } from "@/components/public-timeline/public-episode-view"
import { PublicShowView } from "@/components/public-timeline/public-show-view"
import { readPublicTimeline, readPublicStack, readEventStack, readOrgStack } from "@/lib/public-timeline-read"

// PB-010 Phase 2: the chromeless public timeline at /t/[slug].
//
// Server component (no AppNav — it sits outside the (community) group, like
// /word) so the share preview, metadata, and timeline content are all in the
// initial HTML. The resolve-and-read lives in one helper shared with the public
// API and the OG route; cache() dedupes the read across generateMetadata + the
// page body within a single request.
//
// The /t/{slug} namespace is shared (FNRad): resolve a profile first, then an
// episode (event) owner, then a show (org) owner.

const getPayload = cache((slug: string) => readPublicTimeline(slug))
const getEpisode = cache((slug: string) => readEventStack({ slug, requireEnabled: true }))
const getShow = cache((slug: string) => readOrgStack({ slug, requireEnabled: true }))

function locationLine(region: string | null, country: string | null): string {
  return [region, country].filter(Boolean).join(", ")
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params
  const payload = await getPayload(slug)
  if (!payload) {
    // Not a profile slug: try an episode owner, then a show (org) owner.
    const episode = await getEpisode(slug)
    if (!episode) {
      const show = await getShow(slug)
      if (!show) {
        return { title: "Timeline not found · Linestry", robots: { index: false, follow: false } }
      }
      const { owner } = show
      const bits = [
        `${owner.display_name} on Linestry`,
        owner.bio ? owner.bio.split("\n")[0].slice(0, 100) : null,
        show.episodes.length ? `${show.episodes.length} episode${show.episodes.length === 1 ? "" : "s"}` : null,
      ].filter(Boolean)
      const description = bits.join(". ") + "."
      const canonical = `/t/${owner.slug}`
      return {
        title: `${owner.display_name} · Linestry`,
        description,
        alternates: { canonical },
        openGraph: { type: "website", url: canonical, siteName: "Linestry", title: `${owner.display_name} · Linestry`, description },
        twitter: { card: "summary_large_image", title: `${owner.display_name} · Linestry`, description },
      }
    }
    const { owner, meta } = episode
    const bits = [
      meta.show ? `${meta.show.name} on Linestry` : "An episode on Linestry",
      meta.episode_number != null ? `episode ${meta.episode_number}` : null,
      meta.guests.length ? `with ${meta.guests.map((g) => g.display_name).join(", ")}` : null,
    ].filter(Boolean)
    const description = bits.join(". ") + "."
    const canonical = `/t/${owner.slug}`
    return {
      title: `${owner.display_name} · Linestry`,
      description,
      alternates: { canonical },
      openGraph: { type: "article", url: canonical, siteName: "Linestry", title: `${owner.display_name} · Linestry`, description },
      twitter: { card: "summary_large_image", title: `${owner.display_name} · Linestry`, description },
    }
  }
  const { owner } = payload
  const loc = locationLine(owner.region, owner.country)
  const bits = [
    `${owner.display_name}'s snowboarding timeline on Linestry`,
    owner.era_start ? `riding since ${owner.era_start}` : null,
    loc || null,
  ].filter(Boolean)
  const description = bits.join(". ") + "."
  const canonical = `/t/${owner.slug}`

  return {
    title: `${owner.display_name} · Linestry`,
    description,
    alternates: { canonical },
    openGraph: {
      type: "profile",
      url: canonical,
      siteName: "Linestry",
      title: `${owner.display_name} · Linestry`,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title: `${owner.display_name} · Linestry`,
      description,
    },
  }
}

// /t/[slug] is the curated Stack surface: render the Stack when the owner has
// curated one, else fall back to the read-only timeline (PublicProfileView
// decides from stack.entries). The sibling timeline view now lives at the full
// profile page /people/[id], reached via the "Timeline" toggle, so there is no
// in-page view param to resolve here.
export default async function PublicTimelinePage(
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const timeline = await getPayload(slug)
  if (!timeline) {
    // Not a profile slug: try an episode owner, then a show (org) owner.
    const episode = await getEpisode(slug)
    if (episode) return <PublicEpisodeView payload={episode} />
    const show = await getShow(slug)
    if (!show) notFound()
    return <PublicShowView payload={show} />
  }

  // Reuse the already-read timeline so the stack read only fetches the curated
  // selection (no second entity resolution).
  const stack = (await readPublicStack(slug, timeline)) ?? { owner: timeline.owner, entries: [] }

  return <PublicProfileView timeline={timeline} stack={stack} />
}
