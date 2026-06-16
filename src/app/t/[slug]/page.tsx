import { cache } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PublicProfileView } from "@/components/public-timeline/public-profile-view"
import { readPublicTimeline, readPublicStack } from "@/lib/public-timeline-read"

// PB-010 Phase 2: the chromeless public timeline at /t/[slug].
//
// Server component (no AppNav — it sits outside the (community) group, like
// /word) so the share preview, metadata, and timeline content are all in the
// initial HTML. The resolve-and-read lives in one helper shared with the public
// API and the OG route; cache() dedupes the read across generateMetadata + the
// page body within a single request.

const getPayload = cache((slug: string) => readPublicTimeline(slug))

function locationLine(region: string | null, country: string | null): string {
  return [region, country].filter(Boolean).join(", ")
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params
  const payload = await getPayload(slug)
  if (!payload) {
    return { title: "Timeline not found · Linestry", robots: { index: false, follow: false } }
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

// View resolution (D6): explicit ?view= wins, then the owner's stored default,
// then the owner-type default (members default to stack; v1 is members-only).
// Clamped to timeline whenever the owner has no curated stack, so a Phase 2 link
// or an uncurated member never lands on an empty stack. The mobile <480px
// auto-stack is applied client-side in PublicProfileView.
function resolveInitialView(
  paramRaw: string | string[] | undefined,
  storedDefault: "timeline" | "stack" | null,
  canStack: boolean,
): "timeline" | "stack" {
  const param = Array.isArray(paramRaw) ? paramRaw[0] : paramRaw
  if (param === "timeline") return "timeline"
  if (param === "stack") return canStack ? "stack" : "timeline"
  const ownerDefault = storedDefault ?? "stack" // member default
  return ownerDefault === "stack" && canStack ? "stack" : "timeline"
}

export default async function PublicTimelinePage(
  { params, searchParams }: {
    params: Promise<{ slug: string }>
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
  },
) {
  const { slug } = await params
  const { view: viewParam } = await searchParams
  const timeline = await getPayload(slug)
  if (!timeline) notFound()

  // Reuse the already-read timeline so the stack read only fetches the curated
  // selection (no second entity resolution).
  const stack = (await readPublicStack(slug, timeline)) ?? { owner: timeline.owner, entries: [] }
  const canStack = stack.entries.length > 0
  const initialView = resolveInitialView(viewParam, timeline.default_view, canStack)
  const lockTimeline = (Array.isArray(viewParam) ? viewParam[0] : viewParam) === "timeline"

  return (
    <PublicProfileView
      timeline={timeline}
      stack={stack}
      initialView={initialView}
      lockTimeline={lockTimeline}
    />
  )
}
