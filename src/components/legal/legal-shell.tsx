import type { ReactNode } from "react"
import Link from "next/link"
import { BrandMark } from "@/components/ui/brand-mark"

// Shared chrome + constants for the three public legal pages (/privacy, /terms,
// /data-deletion). A change of entity, contact, or effective date is one edit
// here. Server component: no "use client". Modeled on src/app/word/page.tsx
// (minimal brand-mark header, NOT the app Nav) because these pages are read
// logged out by reviewers and crawlers, so app chrome is noise.

export const LEGAL_ENTITY = "Lineage Community Technologies Inc."
export const LEGAL_CONTACT = "jay@lineage.community"
export const LEGAL_EFFECTIVE = "August 31, 2026"

const displayFont = { fontFamily: "var(--font-display)" }

type LegalPageKey = "privacy" | "terms" | "data-deletion"

const ALL_PAGES: { key: LegalPageKey; href: string; label: string }[] = [
  { key: "privacy", href: "/privacy", label: "Privacy Policy" },
  { key: "terms", href: "/terms", label: "Terms of Service" },
  { key: "data-deletion", href: "/data-deletion", label: "Deleting your data" },
]

// An h2 section with a stable anchor id (used for cross-page links) and a prose
// body. scroll-mt clears the sticky-free header so an in-page jump lands the
// heading below the top edge rather than flush against it.
export function LegalSection({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: ReactNode
}) {
  return (
    <section className="mt-10">
      <h2
        id={id}
        style={displayFont}
        className="scroll-mt-24 text-lg font-bold tracking-tight text-foreground sm:text-xl"
      >
        {title}
      </h2>
      <div className="mt-3 space-y-4 text-base font-light leading-relaxed text-foreground/90">
        {children}
      </div>
    </section>
  )
}

export function LegalPage({
  title,
  summary,
  current,
  children,
}: {
  title: string
  summary: ReactNode
  current: LegalPageKey
  children: ReactNode
}) {
  const others = ALL_PAGES.filter((p) => p.key !== current)
  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      {/* Minimal chrome: brand mark links home, no app nav */}
      <header className="mx-auto max-w-2xl px-6 pt-6 pb-2">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label="Linestry home"
        >
          <BrandMark size={22} color="#3b82f6" />
          <span
            style={displayFont}
            className="text-lg font-bold tracking-tight text-foreground"
          >
            Linestry
          </span>
        </Link>
      </header>

      <main className="mx-auto max-w-2xl px-6 pb-24">
        <h1
          style={displayFont}
          className="mt-6 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl"
        >
          {title}
        </h1>
        <p className="mt-2 text-sm text-muted">Effective {LEGAL_EFFECTIVE}</p>

        {/* Plain-language summary, one boxed paragraph */}
        <div className="mt-6 rounded-2xl border border-border-default bg-surface-2 p-5 text-base font-light leading-relaxed text-foreground/90">
          {summary}
        </div>

        {children}

        {/* Cross-links to the other two legal pages + contact */}
        <footer className="mt-16 border-t border-border-default pt-6">
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            {others.map((p) => (
              <Link
                key={p.key}
                href={p.href}
                className="text-accent-strong hover:underline"
              >
                {p.label}
              </Link>
            ))}
            <a
              href={`mailto:${LEGAL_CONTACT}`}
              className="text-accent-strong hover:underline"
            >
              Contact us
            </a>
          </nav>
          <p className="mt-4 text-sm font-light text-muted">{LEGAL_ENTITY}</p>
        </footer>
      </main>
    </div>
  )
}
