"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Nav } from "@/components/ui/nav"
import { useLineageStore } from "@/store/lineage-store"

// ─── Tier definitions ─────────────────────────────────────────────────────────

const FOUNDING_TOTAL = 500

const TIERS = [
  {
    id: "free",
    label: "Rider",
    price: null,
    priceLabel: "Free",
    priceSub: "forever",
    accent: "var(--muted)",
    accentHex: "#888",
    symbol: "●",
    cta: null,
    tagline: "Full access to the community record.",
    benefits: [
      "Personal snowboard timeline",
      "Browse collective community history",
      "Connection finder",
      "Add entries & upload artifacts",
      "Earn contribution tokens",
    ],
  },
  {
    id: "annual",
    label: "Member",
    price: 25,
    priceLabel: "$25",
    priceSub: "per year",
    accent: "#3b82f6",
    accentHex: "#3b82f6",
    symbol: "◈",
    cta: "Become a member",
    tagline: "Verified co-owner of the community's history.",
    benefits: [
      "Everything in Rider",
      "Verify timeline entries",
      "Community governance & voting",
      "Revenue share — quarterly distribution",
      "Member badge on public profile",
      "10 tokens per year",
    ],
  },
  {
    id: "lifetime",
    label: "Lifetime Member",
    price: 75,
    priceLabel: "$75",
    priceSub: "one-time",
    accent: "#8b5cf6",
    accentHex: "#8b5cf6",
    symbol: "◆",
    cta: "Go lifetime",
    tagline: "Best long-term value. Yours forever.",
    benefits: [
      "Everything in Annual Member",
      "30 tokens upfront",
      "+10 tokens every year",
      "Lifetime member badge",
    ],
  },
  {
    id: "founding",
    label: "Founding Member",
    price: 100,
    priceLabel: "$100",
    priceSub: "one-time · limited",
    accent: "#f59e0b",
    accentHex: "#f59e0b",
    symbol: "✦",
    cta: "Claim founding spot",
    tagline: "First 500 only. Permanent founding era badge.",
    benefits: [
      "Everything in Lifetime Member",
      "Permanent founding badge — never goes away",
      "100 tokens at 2× weight in distributions",
      "1 annual membership to gift",
      "Priority in governance proposals",
      "First access to new communities",
      "Listed in the founding members registry",
    ],
    badge: "LIMITED · 500 SPOTS",
  },
] as const

const FAQ = [
  {
    q: "What does verification mean?",
    a: "Members can confirm timeline entries added by others — saying 'yes, I was there' or 'I can corroborate this.' Three member verifications upgrade an entry's confidence level and earn the original submitter bonus tokens. It's how the collective record becomes trustworthy over time.",
  },
  {
    q: "How often is revenue distributed?",
    a: "Quarterly: January, April, July, October. The snapshot of your token balance is taken on the last day of each quarter. Minimum payout is $5 — sub-threshold amounts carry forward to the next quarter and never expire.",
  },
  {
    q: "What happens to my tokens if I cancel an annual membership?",
    a: "Your tokens are frozen, not lost. Your existing balance stays eligible for quarterly distributions. No new member tokens accrue until you renew. Contribution tokens keep accumulating regardless of membership status.",
  },
  {
    q: "What is a Founding Member?",
    a: "The first 500 people to commit to the platform before it proved itself. They get the best token deal (100 at 2× weight), a permanent founding badge that never disappears, and a membership to gift to someone in their network. Once 500 spots fill or 12 months pass — whichever comes first — the founding tier closes permanently.",
  },
  {
    q: "When does the founding tier close?",
    a: "When 500 spots are filled, or 12 months after launch — whichever comes first. The founding era badge is permanent once earned, even if the tier has closed for years.",
  },
]

// ─── Checkout helper ──────────────────────────────────────────────────────────

async function startCheckout(tier: "annual" | "lifetime" | "founding" | "gift_annual") {
  const res = await fetch("/api/stripe/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tier }),
  })
  const data = await res.json()
  if (data.url) {
    window.location.href = data.url
  } else {
    alert(data.error ?? "Checkout unavailable — Stripe is not yet configured.")
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MembershipPage() {
  const { membership } = useLineageStore()
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [foundingFilled, setFoundingFilled] = useState(0)

  // Fetch live founding spots count
  useEffect(() => {
    fetch("/api/founding")
      .then((r) => r.json())
      .then((data) => setFoundingFilled(data.filled ?? 0))
      .catch(() => {})
  }, [])

  const foundingRemaining = FOUNDING_TOTAL - foundingFilled
  const foundingPct = (foundingFilled / FOUNDING_TOTAL) * 100
  const isSoldOut = foundingFilled >= FOUNDING_TOTAL

  const handleCta = async (tierId: string) => {
    if (tierId === "free") return
    const tier = tierId as "annual" | "lifetime" | "founding"
    setLoading(tier)
    await startCheckout(tier)
    setLoading(null)
  }

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;500;700&display=swap" />

      <style>{`
        .ms-page { font-family: 'IBM Plex Mono', monospace; }
        .ms-heading { font-family: 'Barlow Condensed', sans-serif; }
      `}</style>

      <div className="ms-page min-h-screen bg-background text-foreground">
        <Nav />

        <div className="max-w-5xl mx-auto px-4 pt-12 pb-24">

          {/* ── Hero ──────────────────────────────────────────────────────── */}
          <div className="text-center mb-12">
            <div className="ms-heading text-foreground mb-3"
              style={{ fontSize: "clamp(36px, 7vw, 64px)", fontWeight: 800, letterSpacing: 2, lineHeight: 1 }}>
              OWN A PIECE OF<br />
              <span style={{ color: "#f59e0b" }}>SNOWBOARDING'S HISTORY</span>
            </div>
            <p className="text-muted mt-4 max-w-xl mx-auto" style={{ fontSize: 13, lineHeight: 1.7 }}>
              Lineage is community-owned. Members verify the record,<br />
              vote on the platform, and share in what we build together.
            </p>
            <a href="#tiers" className="inline-block mt-6 text-muted hover:text-foreground transition-colors" style={{ fontSize: 11, letterSpacing: 1 }}>
              See membership options ↓
            </a>
          </div>

          {/* ── Founding banner ───────────────────────────────────────────── */}
          {!isSoldOut && (
            <div className="mb-10 rounded-2xl border p-5"
              style={{ borderColor: "#f59e0b44", background: "#f59e0b08" }}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="ms-heading text-foreground mb-1"
                    style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1 }}>
                    <span style={{ color: "#f59e0b" }}>✦</span> FOUNDING ERA — {foundingRemaining} SPOTS REMAINING
                  </div>
                  <div className="text-muted" style={{ fontSize: 10, letterSpacing: 0.5 }}>
                    First 500 only · closes when full or 12 months after launch
                  </div>
                  {/* Progress bar */}
                  <div className="mt-3 bg-surface-2 rounded-full overflow-hidden" style={{ width: 200, height: 4 }}>
                    <div style={{ width: `${foundingPct}%`, height: "100%", background: "#f59e0b", borderRadius: 4, transition: "width 0.5s ease" }} />
                  </div>
                  <div className="text-muted mt-1" style={{ fontSize: 9, letterSpacing: 0.5 }}>
                    {foundingFilled} / {FOUNDING_TOTAL} founding spots filled
                  </div>
                </div>
                <button
                  onClick={() => handleCta("founding")}
                  disabled={loading === "founding"}
                  className="shrink-0 px-5 py-2.5 rounded-full font-bold transition-all"
                  style={{
                    background: "#f59e0b",
                    color: "#000",
                    fontSize: 11,
                    letterSpacing: 1,
                    fontFamily: "'IBM Plex Mono', monospace",
                    opacity: loading === "founding" ? 0.7 : 1,
                    cursor: loading === "founding" ? "wait" : "pointer",
                    border: "none",
                  }}
                >
                  {loading === "founding" ? "…" : "Claim founding membership →"}
                </button>
              </div>
            </div>
          )}

          {/* ── Tier cards ─────────────────────────────────────────────────── */}
          <div id="tiers" className="grid gap-4"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            {TIERS.map((tier) => {
              const isCurrentTier = membership.tier === tier.id
              const hex = tier.accentHex
              return (
                <div key={tier.id}
                  className="rounded-2xl border p-5 flex flex-col"
                  style={{
                    borderColor: isCurrentTier ? hex : `${hex}30`,
                    background: isCurrentTier ? `${hex}08` : "var(--surface)",
                    position: "relative",
                  }}>

                  {/* Badge */}
                  {"badge" in tier && tier.badge && (
                    <div className="absolute -top-2.5 left-4 px-2.5 py-0.5 rounded-full text-black ms-heading"
                      style={{ background: hex, fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>
                      {tier.badge}
                    </div>
                  )}
                  {isCurrentTier && (
                    <div className="absolute -top-2.5 right-4 px-2.5 py-0.5 rounded-full ms-heading"
                      style={{ background: hex, color: "#000", fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>
                      YOUR TIER
                    </div>
                  )}

                  {/* Header */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span style={{ color: hex, fontSize: 16 }}>{tier.symbol}</span>
                      <span className="ms-heading text-foreground"
                        style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1 }}>
                        {tier.label.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span style={{ fontSize: 28, fontWeight: 700, color: hex, fontFamily: "'Barlow Condensed', sans-serif", lineHeight: 1 }}>
                        {tier.priceLabel}
                      </span>
                      <span className="text-muted" style={{ fontSize: 10 }}>
                        {tier.priceSub}
                      </span>
                    </div>
                    <p className="text-muted mt-2" style={{ fontSize: 10, lineHeight: 1.5 }}>
                      {tier.tagline}
                    </p>
                  </div>

                  {/* Benefits */}
                  <ul className="flex-1 space-y-2 mb-5">
                    {tier.benefits.map((b, i) => (
                      <li key={i} className="flex items-start gap-2" style={{ fontSize: 10, lineHeight: 1.4 }}>
                        <span style={{ color: hex, flexShrink: 0, marginTop: 1 }}>✓</span>
                        <span className="text-foreground">{b}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  {tier.cta && !isCurrentTier && (
                    <button
                      onClick={() => handleCta(tier.id)}
                      disabled={!!loading}
                      className="w-full py-2.5 rounded-full font-bold transition-all"
                      style={{
                        background: tier.id === "founding" ? hex : "transparent",
                        border: `1px solid ${hex}`,
                        color: tier.id === "founding" ? "#000" : hex,
                        fontSize: 10,
                        letterSpacing: 1,
                        fontFamily: "'IBM Plex Mono', monospace",
                        cursor: loading ? "wait" : "pointer",
                        opacity: loading && loading !== tier.id ? 0.5 : 1,
                      }}
                    >
                      {loading === tier.id ? "…" : tier.cta}
                    </button>
                  )}
                  {isCurrentTier && (
                    <div className="w-full py-2.5 rounded-full text-center"
                      style={{ border: `1px solid ${hex}44`, color: hex, fontSize: 10, letterSpacing: 1 }}>
                      ✓ Active
                    </div>
                  )}
                  {!tier.cta && !isCurrentTier && (
                    <div className="w-full py-2.5 rounded-full text-center border border-border-default text-muted"
                      style={{ fontSize: 10, letterSpacing: 1 }}>
                      Your current plan
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* ── Revenue sharing teaser ───────────────────────────────────── */}
          <div className="mt-10 p-6 rounded-2xl border border-border-default bg-surface">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="ms-heading text-foreground mb-1"
                  style={{ fontSize: 20, fontWeight: 700, letterSpacing: 1 }}>
                  HOW REVENUE SHARING WORKS
                </div>
                <p className="text-muted" style={{ fontSize: 11, lineHeight: 1.6, maxWidth: 480 }}>
                  20% of everything Lineage earns flows back to the community that built it.
                  Tokens determine your share. Even free riders accumulate tokens toward the day they join.
                </p>
              </div>
              <Link href="/revenue"
                className="shrink-0 px-5 py-2 rounded-full border border-border-default text-muted hover:text-foreground hover:border-foreground transition-all"
                style={{ fontSize: 10, letterSpacing: 1, whiteSpace: "nowrap" }}>
                How revenue sharing works →
              </Link>
            </div>
          </div>

          {/* ── Gift a membership ────────────────────────────────────────── */}
          <div className="mt-6 p-6 rounded-2xl border border-border-default bg-surface">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="ms-heading text-foreground mb-1"
                  style={{ fontSize: 20, fontWeight: 700, letterSpacing: 1 }}>
                  GIFT A MEMBERSHIP
                </div>
                <p className="text-muted" style={{ fontSize: 11, lineHeight: 1.6, maxWidth: 480 }}>
                  Know someone who belongs here? Gift them an annual membership for $25.
                  Gifted memberships count fully toward the receiver's status.
                  You earn a Community Patron badge for each membership gifted.
                </p>
              </div>
              <button
                onClick={() => startCheckout("gift_annual")}
                className="shrink-0 px-5 py-2 rounded-full border transition-all"
                style={{
                  borderColor: "#3b82f644", color: "#3b82f6",
                  fontSize: 10, letterSpacing: 1, whiteSpace: "nowrap",
                  background: "transparent", cursor: "pointer",
                  fontFamily: "'IBM Plex Mono', monospace",
                }}>
                Gift annual membership — $25 →
              </button>
            </div>
          </div>

          {/* ── Founding registry preview ────────────────────────────────── */}
          <div className="mt-6 p-6 rounded-2xl border border-border-default bg-surface">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="ms-heading text-foreground mb-1"
                  style={{ fontSize: 20, fontWeight: 700, letterSpacing: 1 }}>
                  THE FIRST 500
                </div>
                <p className="text-muted" style={{ fontSize: 11, lineHeight: 1.6 }}>
                  Meet the people who believed in Lineage before it proved itself.
                </p>
              </div>
              <Link href="/founding"
                className="shrink-0 text-muted hover:text-foreground transition-colors"
                style={{ fontSize: 10, letterSpacing: 1, whiteSpace: "nowrap" }}>
                View registry →
              </Link>
            </div>
            {foundingFilled === 0 ? (
              <div className="text-muted text-center py-6"
                style={{ fontSize: 10, letterSpacing: 0.5, lineHeight: 2 }}>
                No founding members yet.<br />
                <span style={{ color: "#f59e0b" }}>Be the first.</span>
              </div>
            ) : (
              <p className="text-muted text-center py-4" style={{ fontSize: 10 }}>
                {foundingFilled} founding members so far.{" "}
                <Link href="/founding" className="underline">See the registry →</Link>
              </p>
            )}
          </div>

          {/* ── FAQ ──────────────────────────────────────────────────────── */}
          <div className="mt-10">
            <div className="ms-heading text-foreground mb-4"
              style={{ fontSize: 20, fontWeight: 700, letterSpacing: 2 }}>
              FAQ
            </div>
            <div className="space-y-1">
              {FAQ.map((item, i) => (
                <div key={i} className="border border-border-default rounded-xl overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-surface-hover transition-colors"
                    style={{ background: "none", cursor: "pointer" }}>
                    <span className="text-foreground" style={{ fontSize: 11, lineHeight: 1.4 }}>{item.q}</span>
                    <span className="text-muted ml-4 shrink-0" style={{ fontSize: 14, transform: openFaq === i ? "rotate(45deg)" : "none", transition: "transform 0.2s" }}>+</span>
                  </button>
                  {openFaq === i && (
                    <div className="px-5 pb-4 text-muted" style={{ fontSize: 11, lineHeight: 1.7 }}>
                      {item.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── Footer copy note ──────────────────────────────────────────── */}
          <div className="mt-10 text-center text-muted" style={{ fontSize: 9, lineHeight: 2, letterSpacing: 0.5 }}>
            Membership is community ownership — not a subscription.<br />
            Free riders have full access. The only member-exclusive feature is entry verification.
          </div>
        </div>
      </div>
    </>
  )
}
