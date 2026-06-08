import type { Metadata } from "next"

/**
 * Per-detail-page metadata for SEO (BUG-011).
 *
 * Detail pages are client components, so they cannot export `generateMetadata`
 * themselves. A sibling server `layout.tsx` calls this helper instead. We derive
 * the title from the URL slug rather than a server DB fetch: slugs are
 * name-based (see entity-links / nameToSlug), so humanizing the slug yields an
 * accurate, unique title with no RLS/data dependency, and crawlers reach these
 * pages by their slug URLs. The canonical points at the page's own path, which
 * is what was missing (every detail page was inheriting the root title
 * "Linestry" and a bare root URL, so Google listed them as separate generic
 * results).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type DetailType = "person" | "board" | "place" | "event" | "org"

const TYPE_FALLBACK: Record<DetailType, string> = {
  person: "Rider profile",
  board: "Snowboard",
  place: "Place",
  event: "Event",
  org: "Brand",
}

const TYPE_DESC: Record<DetailType, (name: string) => string> = {
  person: (n) => `${n}'s snowboarding timeline on Linestry: where they rode, who they rode with, the boards they ran, and the contests they entered.`,
  board: (n) => `${n} on Linestry: who rode it and where it sits in snowboarding history.`,
  place: (n) => `${n} on Linestry: the riders, sessions, and stories logged at this spot.`,
  event: (n) => `${n} on Linestry: who competed, who showed up, and how it fits snowboarding history.`,
  org: (n) => `${n} on Linestry: the riders, boards, and history behind the brand.`,
}

/** Reverse a name-based slug into a readable, title-cased display string. */
function humanizeSlug(slug: string): string | null {
  if (!slug || UUID_RE.test(slug)) return null
  const words = decodeURIComponent(slug).replace(/[_-]+/g, " ").trim()
  if (!words) return null
  // Upper-case the first letter of each word; leave the rest as-is so existing
  // capitalization (e.g. "CMH") survives while lower-cased person slugs get cased.
  return words.replace(/\b\w/g, (c) => c.toUpperCase())
}

export function buildDetailMetadata(opts: {
  type: DetailType
  /** The raw route param (slug, or a UUID fallback for non-canonical hits). */
  param: string
  /** The canonical path for this page, e.g. /people/jay_balmer. */
  path: string
}): Metadata {
  const name = humanizeSlug(opts.param) ?? TYPE_FALLBACK[opts.type]
  const title = `${name} · Linestry`
  const description = TYPE_DESC[opts.type](name)

  return {
    title,
    description,
    alternates: { canonical: opts.path },
    openGraph: {
      type: opts.type === "person" ? "profile" : "website",
      url: opts.path,
      siteName: "Linestry",
      title,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  }
}
