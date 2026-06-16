import { cache } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { BrandMark } from "@/components/ui/brand-mark"
import { PublicTimeline } from "@/components/public-timeline/public-timeline"
import { readPublicTimeline } from "@/lib/public-timeline-read"

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

export default async function PublicTimelinePage(
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const payload = await getPayload(slug)
  if (!payload) notFound()

  const { owner } = payload
  const loc = locationLine(owner.region, owner.country)
  const eraLine = owner.era_start ? `Snowboarding since ${owner.era_start}` : null
  const subline = [eraLine, loc].filter(Boolean).join(" · ")

  // Phase 3: when public_timeline_default_view (or a ?view=stack param) selects
  // the Stack, branch to <StackView /> here. Phase 2 always renders the
  // timeline, ignoring ?view=stack so links already shared keep working (D6).

  return (
    <div className="postcard min-h-screen w-full">
      <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        {/* Owner hero */}
        <header className="mb-10 flex items-start gap-4">
          {owner.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={owner.avatar_url}
              alt={owner.display_name}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover flex-shrink-0 border border-default"
            />
          ) : (
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-violet-600 flex items-center justify-center flex-shrink-0 text-2xl font-bold text-white">
              {owner.display_name[0]?.toUpperCase() ?? "?"}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1
              className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground leading-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {owner.display_name}
            </h1>
            {subline && <p className="mt-1.5 text-sm text-muted">{subline}</p>}
            {owner.bio && (
              <p className="mt-3 text-sm font-light leading-relaxed text-foreground/90 whitespace-pre-wrap">
                {owner.bio}
              </p>
            )}
          </div>
        </header>

        {/* Read-only timeline */}
        <PublicTimeline payload={payload} />

        {/* Attribution footer */}
        <footer className="mt-16 border-t border-default pt-6 flex flex-col items-center gap-3 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-muted hover:text-foreground transition-colors"
            aria-label="Linestry home"
          >
            <BrandMark size={18} color="#3b82f6" />
            <span className="text-xs font-medium">Powered by Linestry</span>
          </Link>
          <Link
            href="/"
            className="text-xs text-accent-strong hover:underline"
          >
            Start your own timeline →
          </Link>
        </footer>
      </main>
    </div>
  )
}
