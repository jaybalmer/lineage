"use client"

import Link from "next/link"
import { Nav } from "@/components/ui/nav"
import { useLineageStore, isAuthUser } from "@/store/lineage-store"

const TIER_LABELS: Record<string, string> = {
  free:     "Rider",
  annual:   "Member",
  lifetime: "Lifetime Member",
  founding: "Founding Member",
}

const TIER_COLORS: Record<string, string> = {
  free:     "#888",
  annual:   "#3b82f6",
  lifetime: "#8b5cf6",
  founding: "#f59e0b",
}

const TIER_SYMBOLS: Record<string, string> = {
  free:     "●",
  annual:   "◈",
  lifetime: "◆",
  founding: "✦",
}

// Rough quarterly estimate (illustrative)
function estimatePayout(tier: string, tokens: { founder: number; member: number; contribution: number }) {
  const totalWeighted = tokens.founder * 2 + tokens.member + tokens.contribution
  const examplePool = 5000
  const totalCirculation = 2600
  const share = totalWeighted / totalCirculation
  const canReceive = tier !== "free" || false // contribution-only accounts don't distribute
  if (!canReceive) return null
  return (share * examplePool).toFixed(2)
}

function getNextDistributionDate() {
  const now = new Date()
  const months = [0, 3, 6, 9] // Jan, Apr, Jul, Oct
  for (const m of months) {
    const d = new Date(now.getFullYear(), m, 1)
    if (d > now) return d.toLocaleDateString("en-US", { month: "long", year: "numeric" })
  }
  return `January ${now.getFullYear() + 1}`
}

async function openStripePortal(customerId: string) {
  const res = await fetch("/api/stripe/portal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customerId }),
  })
  const data = await res.json()
  if (data.url) window.location.href = data.url
  else alert(data.error ?? "Portal unavailable — Stripe not yet configured.")
}

export default function MembershipDashboardPage() {
  const { membership, activePersonId, profileOverride } = useLineageStore()
  const { tier, status, founding_badge, token_balance, pending_credit, stripe_customer_id, membership_expires_at } = membership

  const isAuth = isAuthUser(activePersonId)
  const name = profileOverride.display_name ?? "Rider"
  const color = TIER_COLORS[tier]
  const symbol = TIER_SYMBOLS[tier]
  const label = TIER_LABELS[tier]
  const totalTokens = token_balance.founder * 2 + token_balance.member + token_balance.contribution
  const estPayout = estimatePayout(tier, token_balance)
  const nextDist = getNextDistributionDate()
  const isLapsed = tier !== "free" && status === "expired"

  if (!isAuth) {
    return (
      <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
        <Nav />
        <div className="max-w-3xl mx-auto px-4 pt-20 text-center">
          <p className="text-muted mb-4" style={{ fontSize: 12 }}>Sign in to view your membership.</p>
          <Link href="/profile" className="underline text-muted hover:text-foreground" style={{ fontSize: 11 }}>
            Go to profile →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;700;800&family=IBM+Plex+Mono:wght@400;700&display=swap" />

      <style>{`
        .md-page { font-family: 'IBM Plex Mono', monospace; }
        .md-heading { font-family: 'Barlow Condensed', sans-serif; }
      `}</style>

      <div className="md-page min-h-screen bg-background text-foreground">
        <Nav />
        <div className="max-w-3xl mx-auto px-4 pt-10 pb-24 space-y-6">

          {/* Header */}
          <div>
            <div className="text-muted mb-1" style={{ fontSize: 10, letterSpacing: 2 }}>// MEMBERSHIP</div>
            <div className="md-heading text-foreground" style={{ fontSize: 28, fontWeight: 800, letterSpacing: 2 }}>
              {name.toUpperCase()}
            </div>
          </div>

          {/* Status card */}
          <div className="bg-surface border rounded-2xl p-5"
            style={{ borderColor: `${color}44` }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span style={{ color, fontSize: 18 }}>{symbol}</span>
                  <span className="md-heading text-foreground" style={{ fontSize: 20, fontWeight: 700, letterSpacing: 1 }}>
                    {label.toUpperCase()}
                  </span>
                  {founding_badge && (
                    <span className="px-2 py-0.5 rounded-full text-black md-heading"
                      style={{ background: "#f59e0b", fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>
                      FOUNDING ✦
                    </span>
                  )}
                </div>
                <div className="text-muted" style={{ fontSize: 10 }}>
                  Status: <span style={{ color: isLapsed ? "#ef4444" : "#10b981" }}>
                    {isLapsed ? "Lapsed" : "Active"}
                  </span>
                  {membership_expires_at && !isLapsed && (
                    <span className="ml-3">
                      Renews {new Date(membership_expires_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                    </span>
                  )}
                </div>
              </div>
              {tier === "free" && (
                <Link href="/membership"
                  className="shrink-0 px-4 py-2 rounded-full font-bold transition-all hover:opacity-80"
                  style={{
                    background: "#3b82f6", color: "#fff",
                    fontSize: 9, letterSpacing: 1,
                    fontFamily: "'IBM Plex Mono', monospace",
                  }}>
                  Become a member →
                </Link>
              )}
            </div>

            {/* Lapsed notice */}
            {isLapsed && (
              <div className="mt-4 p-3 rounded-xl border"
                style={{ borderColor: "#ef444444", background: "#ef444408" }}>
                <p className="text-foreground" style={{ fontSize: 10, lineHeight: 1.7 }}>
                  Your membership has lapsed. Your{" "}
                  <strong>{token_balance.member + token_balance.founder}</strong> tokens are preserved
                  — renew to start earning again.
                </p>
                <Link href="/membership"
                  className="inline-block mt-2 text-blue-400 hover:text-blue-300 transition-colors underline"
                  style={{ fontSize: 10 }}>
                  Renew membership →
                </Link>
              </div>
            )}
          </div>

          {/* Token balance */}
          <div className="bg-surface border border-border-default rounded-2xl p-5">
            <div className="md-heading text-foreground mb-4" style={{ fontSize: 16, fontWeight: 700, letterSpacing: 1 }}>
              TOKEN BALANCE
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: "Founder",      count: token_balance.founder,      color: "#f59e0b", weight: "2×" },
                { label: "Member",       count: token_balance.member,        color: "#3b82f6", weight: "1×" },
                { label: "Contribution", count: token_balance.contribution,  color: "#10b981", weight: "1×" },
              ].map(({ label: l, count, color: c, weight }) => (
                <div key={l} className="rounded-xl border border-border-default p-3 text-center">
                  <div style={{ fontSize: 22, fontWeight: 700, color: c, fontFamily: "'Barlow Condensed', sans-serif", lineHeight: 1 }}>
                    {count}
                  </div>
                  <div className="text-muted mt-1" style={{ fontSize: 8, letterSpacing: 0.5 }}>{l.toUpperCase()}</div>
                  <div className="text-muted" style={{ fontSize: 8 }}>weight {weight}</div>
                </div>
              ))}
            </div>

            <div className="border-t border-border-default pt-3 flex justify-between items-center">
              <span className="text-muted" style={{ fontSize: 10 }}>Total weighted tokens</span>
              <span className="text-foreground font-bold" style={{ fontSize: 14 }}>{totalTokens}</span>
            </div>
          </div>

          {/* Revenue share */}
          <div className="bg-surface border border-border-default rounded-2xl p-5">
            <div className="md-heading text-foreground mb-3" style={{ fontSize: 16, fontWeight: 700, letterSpacing: 1 }}>
              REVENUE SHARE
            </div>
            {tier === "free" ? (
              <div>
                <p className="text-muted mb-3" style={{ fontSize: 10, lineHeight: 1.7 }}>
                  Your contribution tokens are accumulating. Revenue share distributions require
                  at least one active member or founder token — you&apos;ll have a head-start the moment
                  you become a member.
                </p>
                <Link href="/revenue"
                  className="text-muted hover:text-foreground transition-colors underline"
                  style={{ fontSize: 10 }}>
                  How revenue sharing works →
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted" style={{ fontSize: 10 }}>Next distribution</span>
                  <span className="text-foreground" style={{ fontSize: 10 }}>{nextDist}</span>
                </div>
                {estPayout && (
                  <div className="flex justify-between">
                    <span className="text-muted" style={{ fontSize: 10 }}>Estimated payout (illustrative)</span>
                    <span className="text-foreground font-bold" style={{ fontSize: 12 }}>${estPayout}</span>
                  </div>
                )}
                {pending_credit > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted" style={{ fontSize: 10 }}>Platform credit balance</span>
                    <span style={{ fontSize: 12, color: "#10b981", fontWeight: 700 }}>${pending_credit.toFixed(2)}</span>
                  </div>
                )}
                <Link href="/revenue/distributions"
                  className="text-muted hover:text-foreground transition-colors underline"
                  style={{ fontSize: 10 }}>
                  View past distributions →
                </Link>
              </div>
            )}
          </div>

          {/* Manage subscription */}
          {tier === "annual" && stripe_customer_id && (
            <div className="bg-surface border border-border-default rounded-2xl p-5">
              <div className="md-heading text-foreground mb-3" style={{ fontSize: 16, fontWeight: 700, letterSpacing: 1 }}>
                MANAGE SUBSCRIPTION
              </div>
              <p className="text-muted mb-4" style={{ fontSize: 10, lineHeight: 1.7 }}>
                Update your payment method, view invoices, or cancel — all through Stripe&apos;s secure portal.
              </p>
              <button
                onClick={() => openStripePortal(stripe_customer_id!)}
                className="px-5 py-2 rounded-full border border-border-default text-muted hover:text-foreground hover:border-foreground transition-all"
                style={{ fontSize: 10, letterSpacing: 1, background: "none", cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace" }}>
                Manage billing →
              </button>
            </div>
          )}

          {/* Contribution tokens note (free tier) */}
          {tier === "free" && token_balance.contribution > 0 && (
            <div className="p-4 rounded-xl border"
              style={{ borderColor: "#10b98130", background: "#10b98108" }}>
              <p style={{ fontSize: 10, lineHeight: 1.7, color: "var(--foreground)" }}>
                <span style={{ color: "#10b981", fontWeight: 700 }}>
                  {token_balance.contribution} contribution token{token_balance.contribution !== 1 ? "s" : ""} earned.
                </span>{" "}
                These tokens count toward your revenue share when you become a member.
              </p>
            </div>
          )}

          {/* Back links */}
          <div className="flex gap-4 pt-2" style={{ fontSize: 10 }}>
            <Link href="/profile" className="text-muted hover:text-foreground transition-colors">← Profile</Link>
            <Link href="/membership" className="text-muted hover:text-foreground transition-colors">Membership options →</Link>
            <Link href="/revenue" className="text-muted hover:text-foreground transition-colors">Revenue sharing →</Link>
          </div>

        </div>
      </div>
    </>
  )
}
