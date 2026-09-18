// Partner campaign module (FNRad Surface Reconciliation brief, 3c).
//
// Renders on the light brand-page ground in place of the generic curated
// contribute module when a founding-tier media org has a PARTNER_CAMPAIGNS
// entry. Client-safe leaf: links plus one callback (Contribute a story, wired to
// the page's existing handleContribute), no fetch. The challenge line reads the
// campaign's resolved values directly (D3), so there is no avatar and no DB read
// here; the hub and episode pages keep their resolved ChallengeCard.

import Link from "next/link"
import type { PartnerCampaign } from "@/lib/partner-campaigns"

export function PartnerCampaignModule({
  campaign,
  brandColor,
  ctaColor,
  onContribute,
}: {
  campaign: PartnerCampaign
  brandColor: string
  ctaColor: string
  onContribute: () => void
}) {
  return (
    <section className="rounded-2xl p-5 sm:p-6 bg-surface border" style={{ borderColor: `${brandColor}40` }}>
      {/* Kicker */}
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: brandColor }}>
        {campaign.kicker}
      </p>

      {/* Headline */}
      <h2 className="text-xl text-foreground mb-1.5" style={{ fontFamily: "var(--font-wordmark)" }}>
        {campaign.headline}
      </h2>

      {/* Body */}
      <p className="text-sm text-muted font-light max-w-xl mb-4 leading-relaxed">
        {campaign.body}
      </p>

      {/* This week's challenge (only when a guest is configured) */}
      {campaign.challenge && (
        <div className="mb-5 rounded-xl border p-3.5" style={{ borderColor: `${brandColor}33`, background: `${brandColor}0d` }}>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted mb-2">
            This week&apos;s challenge
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link
              href={campaign.challenge.href}
              style={{ background: ctaColor, borderColor: ctaColor }}
              className="px-3.5 py-2 rounded-lg text-sm font-medium text-white border hover:opacity-90 transition-opacity"
            >
              Add your story about {campaign.challenge.guestName}
            </Link>
            {campaign.challenge.episodeLabel && (
              <span className="text-xs text-muted">{campaign.challenge.episodeLabel}</span>
            )}
          </div>
        </div>
      )}

      {/* Link row */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <Link href={campaign.hubHref} className="font-medium hover:opacity-80 transition-opacity" style={{ color: brandColor }}>
          {campaign.hubLabel} <span aria-hidden="true">&rarr;</span>
        </Link>
        <a
          href={campaign.listenHref}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-muted hover:text-foreground transition-colors"
        >
          {campaign.listenLabel} <span aria-hidden="true">&rarr;</span>
        </a>
        <button
          onClick={onContribute}
          className="font-medium text-muted hover:text-foreground transition-colors"
        >
          Contribute a story
        </button>
      </div>
    </section>
  )
}
