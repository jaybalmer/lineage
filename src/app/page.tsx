"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import { Nav } from "@/components/ui/nav"
import { BrandMark } from "@/components/ui/brand-mark"
import { useLineageStore, isAuthUser } from "@/store/lineage-store"
import { EQUITY_POOL_SHARES } from "@/lib/equity-offer"
import { primaryPresentingPartner, partnerEyebrow } from "@/lib/partners"
import { orgSlug } from "@/lib/mock-data"

export default function Home() {
  const { activePersonId } = useLineageStore()
  const communities = useLineageStore((s) => s.communities)
  const orgs = useLineageStore((s) => s.catalog.orgs)
  const catalogLoaded = useLineageStore((s) => s.catalogLoaded)
  const isAuth = isAuthUser(activePersonId)
  // Single-community launch: homepage banner reads snowboarding.
  const banner = communities.find((c) => c.slug === "snowboarding")?.landing_banner_url
  // Presenting partner card (D8/D9): only once the catalog has loaded, so it does
  // not pop in mid-read; null until an org is set to 'founding' in /admin/brand.
  const partner = catalogLoaded ? primaryPresentingPartner(orgs) : null

  return (
    // Landing page is always dark, regardless of the theme toggle. The .dark
    // wrapper re-scopes the theme tokens for this whole subtree (incl. Nav).
    <div className="dark min-h-screen bg-background text-foreground">
      <Nav />

      {/* Full-width banner band. No text overlaid on the photo, so no scrim. */}
      {banner && (
        <div className="w-full h-44 sm:h-56 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={banner} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      {/* Hero */}
      <div className={cn("max-w-3xl mx-auto px-6 pb-10 text-center", banner ? "pt-6 sm:pt-10" : "pt-12 sm:pt-20")}>
        <div className="mb-5 sm:mb-8 select-none">
          <div
            className="font-bold text-foreground leading-none tracking-tight"
            style={{ fontSize: "clamp(4rem, 14vw, 7.5rem)", letterSpacing: "-0.03em" }}
          >
            <Link href="/word" className="inline-flex items-center justify-center gap-[0.18em] hover:opacity-90 transition-opacity" aria-label="Linestry, see the definition">
              {/* Mark + wordmark lockup (matches the brand banner). Mark height is
                  set in em so it scales with the responsive wordmark; width auto
                  keeps the landscape aspect. ~1.15em so the mark reads at the full
                  wordmark height like the banner, not just cap height. Dot is
                  white here (dark hero). */}
              <BrandMark aria-hidden style={{ height: "1.15em", width: "auto" }} />
              <span style={{ fontFamily: "var(--font-wordmark)" }}>Linestry</span>
            </Link>
          </div>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-snug mb-5 mt-5 sm:mt-8 max-w-2xl mx-auto">
          Our history is real, but scattered. Let&rsquo;s weave it together.
        </h1>

        <p className="text-muted text-base leading-relaxed max-w-xl mx-auto">
          Our stories, crews, and events live across social feeds and fading memories.
          Linestry keeps them, and weaves our timelines into one.
        </p>

        {/* BUG-017: on a 414px screen the primary CTA sits well below the fold,
            behind the intro copy and the focus card. Surface it in the first
            hero screen on mobile only. The full card below keeps both actions
            for desktop and for the scroll, so desktop is unchanged. */}
        <div className="sm:hidden mt-6 flex flex-col items-center gap-3">
          {isAuth ? (
            <Link
              href="/snowboarding/profile"
              className="px-6 py-2.5 rounded-lg bg-[#1C1917] text-white font-semibold text-sm hover:bg-[#292524] transition-colors"
            >
              My Timeline
            </Link>
          ) : (
            <Link
              href="/onboarding"
              className="px-6 py-2.5 rounded-lg bg-[#1C1917] text-white font-semibold text-sm hover:bg-[#292524] transition-colors"
            >
              Start Your Timeline
            </Link>
          )}
          <Link
            href="/snowboarding"
            className="text-sm text-muted font-medium hover:text-foreground transition-colors"
          >
            Browse Snowboarding
          </Link>
        </div>
      </div>

      {/* Snowboarding focus + primary CTAs */}
      <div className="max-w-3xl mx-auto px-6 pb-8">
        <div className="rounded-2xl border-2 border-foreground/20 bg-surface p-6 sm:p-8 text-center">
          <p className="text-foreground text-lg font-semibold leading-snug mb-3">
            We&rsquo;re starting with snowboarding.
          </p>
          <p className="text-muted text-base leading-relaxed max-w-xl mx-auto mb-6">
            Add the boards you rode, the places you rode them, and the people you rode
            with. Build your timeline, and help build the linestry of snowboarding.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {isAuth ? (
              <Link
                href="/snowboarding/profile"
                className="px-6 py-2.5 rounded-lg bg-[#1C1917] text-white font-semibold text-sm hover:bg-[#292524] transition-colors"
              >
                My Timeline
              </Link>
            ) : (
              <Link
                href="/onboarding"
                className="px-6 py-2.5 rounded-lg bg-[#1C1917] text-white font-semibold text-sm hover:bg-[#292524] transition-colors"
              >
                Start Your Timeline
              </Link>
            )}
            <Link
              href="/snowboarding"
              className="px-6 py-2.5 rounded-lg border border-border-default text-muted font-semibold text-sm hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              Browse Snowboarding
            </Link>
          </div>
        </div>
      </div>

      {/* Presenting partner card. Below the focus card so its async arrival cannot
          push the primary CTA down (D8/F11/BUG-017). Renders nothing until an org
          is 'founding'. Force-dark scope, so the logo sits on a white tile (F10). */}
      {partner && (
        <div className="max-w-3xl mx-auto px-6 pb-8">
          <Link
            href={`/snowboarding/brands/${orgSlug(partner)}`}
            className="block rounded-2xl border border-border-default bg-surface p-5 sm:p-6 hover:border-foreground/30 transition-colors"
          >
            <p className="text-[11px] font-semibold text-muted uppercase tracking-widest mb-3">
              {partnerEyebrow(partner)}
            </p>
            <div className="flex items-center gap-4 min-w-0">
              {partner.logo_url ? (
                <div className="w-12 h-12 rounded-lg bg-white border border-border-default flex items-center justify-center overflow-hidden shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={partner.logo_url} alt={partner.name} className="w-full h-full object-contain p-1" />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-lg bg-violet-50 border border-violet-200 flex items-center justify-center text-lg font-bold text-violet-700 shrink-0">
                  {partner.name[0].toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-foreground truncate">{partner.name}</p>
                {partner.description && (
                  <p className="text-sm text-muted mt-0.5 line-clamp-2">
                    {partner.description.slice(0, 120)}{partner.description.length > 120 ? "…" : ""}
                  </p>
                )}
              </div>
              <span className="text-sm text-accent-strong font-semibold shrink-0 hidden sm:inline">
                Visit {partner.name}
              </span>
            </div>
          </Link>
        </div>
      )}

      {/* Equity teaser: visible to everyone (auth + logged out). Surfaces the
          offer that otherwise only lives behind /membership. */}
      <div className="max-w-3xl mx-auto px-6 pb-10">
        <p className="text-center text-muted text-sm leading-relaxed">
          Free riders earn a share of a {EQUITY_POOL_SHARES.toLocaleString()} share pool, just by adding history.{" "}
          <Link href="/equity" className="text-accent-strong font-semibold hover:underline">
            See how it works
          </Link>
        </p>
      </div>

      {/* Footer */}
      <div className="text-center py-10">
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 mb-3">
          <Link href="/privacy" className="text-muted text-xs hover:text-foreground transition-colors">Privacy</Link>
          <Link href="/terms" className="text-muted text-xs hover:text-foreground transition-colors">Terms</Link>
          <Link href="/data-deletion" className="text-muted text-xs hover:text-foreground transition-colors">Data deletion</Link>
        </nav>
        <p className="text-muted text-xs">
          Lineage Community Technologies Inc.
        </p>
      </div>
    </div>
  )
}
