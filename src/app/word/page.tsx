import type { Metadata } from "next"
import Link from "next/link"
import { BrandMark } from "@/components/ui/brand-mark"

const META_DESCRIPTION =
  "linestry, noun. The cultural lineage of a community, the people, places, stories, and artifacts woven together into a shared fabric. From lineage + tapestry."

export const metadata: Metadata = {
  title: "linestry (n.)",
  description: META_DESCRIPTION,
  alternates: { canonical: "/word" },
  openGraph: {
    type: "article",
    url: "/word",
    siteName: "Linestry",
    title: "linestry (n.)",
    description: META_DESCRIPTION,
    authors: ["Lineage Community Technologies Inc."],
    publishedTime: "2026-06-05",
  },
  twitter: {
    card: "summary_large_image",
    title: "linestry (n.)",
    description: META_DESCRIPTION,
  },
}

const displayFont = { fontFamily: "var(--font-display)" }

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-strong mb-3">
      {children}
    </h2>
  )
}

export default function WordPage() {
  return (
    <div className="postcard min-h-screen w-full">
      {/* Minimal chrome: brand mark links home, no app nav */}
      <header className="mx-auto max-w-2xl px-6 pt-6 pb-2">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label="Linestry home"
        >
          <BrandMark size={22} color="#3b82f6" />
          <span style={displayFont} className="text-lg font-bold tracking-tight text-foreground">
            Linestry
          </span>
        </Link>
      </header>

      <main className="mx-auto max-w-2xl px-6 pb-24">
        {/* Hero dictionary card — live, selectable text */}
        <article className="relative mt-6 rounded-2xl border border-default bg-surface-2 p-7 shadow-sm sm:p-9">
          <BrandMark
            size={30}
            color="#3b82f6"
            className="absolute right-6 top-6 opacity-90 sm:right-8 sm:top-8"
            aria-hidden="true"
          />
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-muted">
            Dictionary
          </p>
          <h1 className="mt-2 leading-none">
            <dfn
              style={displayFont}
              className="not-italic text-5xl font-extrabold tracking-tight text-foreground sm:text-6xl"
            >
              linestry
            </dfn>
          </h1>
          <p className="mt-4 text-base text-muted">
            <span lang="en-fonipa">/ˈlin-ə-strē/</span>{" "}
            <em className="font-light">n.</em>{" "}
            <span className="text-muted/90">(rhymes with <em className="font-light">ministry</em>)</span>
          </p>
          <hr className="my-6 border-default" />
          <p className="text-lg font-light leading-relaxed text-foreground sm:text-xl">
            the cultural lineage of a community, the people, places, stories, and
            artifacts woven together into a shared fabric.
          </p>
          <p className="mt-4 text-base font-light italic text-muted">
            <em>from</em> lineage + tapestry.
          </p>
        </article>

        {/* How to say it */}
        <section className="mt-14">
          <SectionLabel>How to say it</SectionLabel>
          <p className="text-base font-light leading-relaxed text-foreground sm:text-lg">
            LIN-uh-stree. Three syllables. Short <em>i</em> in the first, schwa in
            the middle, long <em>ee</em> at the end. It rhymes with ministry,
            industry, chemistry, artistry, tapestry. The <em>-stry</em> sound puts
            it in the family of English words that name a body of craft or practice.
          </p>
        </section>

        {/* What it means */}
        <section className="mt-12">
          <SectionLabel>What it means</SectionLabel>
          <p className="text-base font-light leading-relaxed text-foreground sm:text-lg">
            A linestry is what a community is, looked at across time. Not its history
            (which is written, finished, authored), and not its heritage (which is
            inherited and static). A linestry is the live record of people, places,
            stories, and objects woven together by the lives that touched them. It
            grows as more threads are added. Its picture only becomes legible when
            many lives are seen together.
          </p>
        </section>

        {/* Where it came from */}
        <section className="mt-12">
          <SectionLabel>Where it came from</SectionLabel>
          <p className="text-base font-light leading-relaxed text-foreground sm:text-lg">
            Coined in 2026 by <strong className="font-semibold">Cory Yip</strong> in
            the course of brand work for Linestry, a platform for the cultural
            lineage of communities. The word was proposed as a candidate brand name,
            formed by joining two roots.
          </p>
          <div className="my-5 space-y-2 border-l border-default pl-5">
            <p className="text-base font-light leading-relaxed text-foreground">
              <em>lineage</em>, from Old French <em>lignage</em>, a line of descent,
              ancestry.
            </p>
            <p className="text-base font-light leading-relaxed text-foreground">
              <em>tapestry</em>, from Old French <em>tapisserie</em>, a woven fabric
              in which many threads form a single picture.
            </p>
          </div>
          <p className="text-base font-light leading-relaxed text-foreground sm:text-lg">
            The founder, Jay Balmer, recognized in the coinage not merely a name but
            a word that English had wanted and not yet held. It was adopted as the
            name of the company and the platform, and given the formal definition
            above.
          </p>
          <p className="mt-4 text-base font-light leading-relaxed text-foreground sm:text-lg">
            English had words that came close (<em>history</em>, <em>heritage</em>,{" "}
            <em>legacy</em>, <em>tradition</em>, <em>lore</em>, <em>patrimony</em>)
            and none did the full work. <em>Linestry</em> names something both
            inherited and made, both ancestral and present, both individual and
            collective.
          </p>
        </section>

        {/* How to use it */}
        <section className="mt-12">
          <SectionLabel>How to use it</SectionLabel>
          <p className="text-base font-light leading-relaxed text-foreground sm:text-lg">
            A noun. Plural in the usual way (<em>linestries</em>).
          </p>
          <div className="mt-5 space-y-3">
            {[
              "Burton's linestry runs from a Vermont garage to every mountain on earth.",
              "The Westbeach Classic is a thread in the linestry of West Coast snowboarding.",
              "She's been part of this linestry since the eighties.",
              "Add yourself to the linestry.",
              "What's your linestry?",
            ].map((line) => (
              <blockquote
                key={line}
                className="border-l-2 border-accent/40 pl-4 text-base font-light italic leading-relaxed text-foreground/90 sm:text-lg"
              >
                {line}
              </blockquote>
            ))}
          </div>
          <p className="mt-6 text-base font-light leading-relaxed text-foreground sm:text-lg">
            Related forms: <em>linestral</em> (adj.),{" "}
            <em>linestry-keeper</em>{" "}(n., one who tends a community&apos;s record).
          </p>
        </section>

        {/* Why this word */}
        <section className="mt-12">
          <SectionLabel>Why this word</SectionLabel>
          <p className="text-base font-light leading-relaxed text-foreground sm:text-lg">
            English has many words for what one person leaves behind, and many for
            what a society inherits. It has fewer for what a community weaves together
            while it is still living. A scene without its linestry is just a moment. A
            community with one has continuity, memory, and a place to stand.
          </p>
          <p className="mt-5 text-lg font-light leading-relaxed text-foreground sm:text-xl">
            If you have a linestry, it is worth keeping.
          </p>
        </section>

        {/* CTA */}
        <div className="mt-14">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 font-semibold text-white transition-colors hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Start your linestry
            <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>

        {/* Footer micro-copy */}
        <footer className="mt-16 border-t border-default pt-6">
          <p className="text-sm font-light italic text-muted">
            The word linestry was coined in 2026. This page is its first home.
          </p>
        </footer>
      </main>
    </div>
  )
}
