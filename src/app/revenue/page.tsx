"use client"

import { useState } from "react"
import Link from "next/link"
import { Nav } from "@/components/ui/nav"

// ─── Revenue source breakdown ─────────────────────────────────────────────────

const SOURCES = [
  { label: "Memberships",           pct: 30, color: "#3b82f6" },
  { label: "Brand sponsorships",    pct: 30, color: "#8b5cf6" },
  { label: "Marketplace",           pct: 20, color: "#f59e0b" },
  { label: "Dataset licensing",     pct: 20, color: "#10b981" },
]

const TOKEN_TABLE = [
  { type: "Founder token",       earners: "Founding members",        amount: "100 on purchase, +10/yr", weight: "2×" },
  { type: "Member token",        earners: "Annual + Lifetime",       amount: "10/yr (Lifetime: 30 + 10/yr)", weight: "1×" },
  { type: "Contribution token",  earners: "Everyone including free", amount: "Earned by activity",     weight: "1×" },
]

const CONTRIB_TABLE = [
  { action: "Adding a new timeline entry",                   tokens: "+1" },
  { action: "Entry verified by 3+ members (bonus to you)",   tokens: "+2" },
  { action: "Verifying another rider's entry (members only)", tokens: "+1" },
  { action: "Uploading a media artifact",                    tokens: "+1" },
  { action: "Linking to an authoritative external source",   tokens: "+2" },
  { action: "Onboarding a new active user",                  tokens: "+5" },
]

const DISTRIBUTION_SCHEDULE = ["January", "April", "July", "October"]

const PHASES = [
  {
    phase: "Phase 1",
    label: "Now",
    items: ["Revenue share weight", "Community governance voting", "Entry verification rights"],
    color: "#3b82f6",
  },
  {
    phase: "Phase 2",
    label: "As platform grows",
    items: ["Marketplace discounts", "Brand sponsorship access", "Event priority registration"],
    color: "#8b5cf6",
  },
  {
    phase: "Phase 3",
    label: "Future communities",
    items: ["Cross-community portability", "Expanded governance", "New community founding rights"],
    color: "#f59e0b",
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RevenuePage() {
  const [poolSize, setPoolSize] = useState(5000)

  const totalWeightedTokens = 2600 // example from brief

  const examples = [
    { label: "Founding member",    tokens: 100, weight: 2, description: "100 founder tokens" },
    { label: "Lifetime member yr 1", tokens: 30, weight: 1, description: "30 member tokens" },
    { label: "Annual member",      tokens: 10, weight: 1, description: "10 member tokens" },
    { label: "Active free rider",  tokens: 5,  weight: 1, description: "5 contribution tokens" },
  ]

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;500;700&display=swap" />

      <style>{`
        .rv-page { font-family: 'IBM Plex Mono', monospace; }
        .rv-heading { font-family: 'Barlow Condensed', sans-serif; }
      `}</style>

      <div className="rv-page min-h-screen bg-background text-foreground">
        <Nav />

        <div className="max-w-3xl mx-auto px-4 pt-12 pb-24 space-y-16">

          {/* ── Header ──────────────────────────────────────────────────── */}
          <div>
            <div className="text-muted mb-3" style={{ fontSize: 10, letterSpacing: 2 }}>// REVENUE SHARING</div>
            <div className="rv-heading text-foreground"
              style={{ fontSize: "clamp(32px, 6vw, 52px)", fontWeight: 800, letterSpacing: 2, lineHeight: 1.05 }}>
              HOW REVENUE<br />SHARING WORKS
            </div>
            <p className="text-muted mt-4" style={{ fontSize: 12, lineHeight: 1.8, maxWidth: 520 }}>
              20% of everything Lineage earns flows back to the community that built it.
              Here&apos;s exactly how.
            </p>
          </div>

          {/* ── Section 1: Where the money comes from ────────────────────── */}
          <section>
            <div className="rv-heading text-foreground mb-4"
              style={{ fontSize: 22, fontWeight: 700, letterSpacing: 2 }}>
              WHERE THE MONEY COMES FROM
            </div>
            <div className="bg-surface border border-border-default rounded-2xl p-5 space-y-4">
              {SOURCES.map((s) => (
                <div key={s.label}>
                  <div className="flex justify-between mb-1">
                    <span className="text-foreground" style={{ fontSize: 11 }}>{s.label}</span>
                    <span style={{ fontSize: 11, color: s.color, fontWeight: 700 }}>{s.pct}%</span>
                  </div>
                  <div className="bg-surface-2 rounded-full overflow-hidden" style={{ height: 6 }}>
                    <div style={{
                      width: `${s.pct}%`, height: "100%",
                      background: s.color, borderRadius: 6,
                      boxShadow: `0 0 8px ${s.color}44`,
                    }} />
                  </div>
                </div>
              ))}
              <p className="text-muted pt-2 border-t border-border-default"
                style={{ fontSize: 9, lineHeight: 1.7, letterSpacing: 0.3 }}>
                We never sell personal data. Revenue comes from utility, not surveillance.
              </p>
            </div>
          </section>

          {/* ── Section 2: The community pool ────────────────────────────── */}
          <section>
            <div className="rv-heading text-foreground mb-4"
              style={{ fontSize: 22, fontWeight: 700, letterSpacing: 2 }}>
              THE COMMUNITY POOL
            </div>
            <p className="text-muted mb-5" style={{ fontSize: 11, lineHeight: 1.8 }}>
              Every quarter, 20% of net revenue is set aside for the community.
              The remainder covers operations, team, and platform investment.
            </p>
            {/* Flow diagram */}
            <div className="bg-surface border border-border-default rounded-2xl p-5">
              <div className="flex flex-col sm:flex-row items-stretch gap-4">
                <div className="flex-1 rounded-xl p-4 text-center border border-border-default">
                  <div className="rv-heading text-foreground mb-1" style={{ fontSize: 22, fontWeight: 700 }}>100%</div>
                  <div className="text-muted" style={{ fontSize: 9, letterSpacing: 1 }}>TOTAL REVENUE</div>
                </div>
                <div className="flex items-center justify-center text-muted sm:text-base text-xs">→</div>
                <div className="flex-1 rounded-xl p-4 text-center"
                  style={{ border: "1px solid #3b82f644", background: "#3b82f608" }}>
                  <div className="rv-heading mb-1" style={{ fontSize: 22, fontWeight: 700, color: "#3b82f6" }}>80%</div>
                  <div className="text-muted" style={{ fontSize: 9, letterSpacing: 1 }}>OPERATIONS</div>
                  <div className="text-muted" style={{ fontSize: 8, marginTop: 4 }}>team · infrastructure · investment</div>
                </div>
                <div className="flex items-center justify-center text-muted sm:text-base text-xs">+</div>
                <div className="flex-1 rounded-xl p-4 text-center"
                  style={{ border: "1px solid #10b98144", background: "#10b98108" }}>
                  <div className="rv-heading mb-1" style={{ fontSize: 22, fontWeight: 700, color: "#10b981" }}>20%</div>
                  <div style={{ fontSize: 9, letterSpacing: 1, color: "#10b981" }}>COMMUNITY POOL</div>
                  <div className="text-muted" style={{ fontSize: 8, marginTop: 4 }}>distributed quarterly</div>
                </div>
              </div>
            </div>
          </section>

          {/* ── Section 3: Tokens ────────────────────────────────────────── */}
          <section>
            <div className="rv-heading text-foreground mb-2"
              style={{ fontSize: 22, fontWeight: 700, letterSpacing: 2 }}>
              TOKENS — YOUR SHARE
            </div>
            <p className="text-muted mb-5" style={{ fontSize: 11, lineHeight: 1.8 }}>
              Tokens are how your share of the pool is calculated. They are non-transferable
              internal credits — not securities, not crypto.
            </p>

            {/* Token types table */}
            <div className="bg-surface border border-border-default rounded-2xl overflow-hidden mb-4">
              <table className="w-full" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr className="border-b border-border-default">
                    <th className="text-left px-4 py-3 text-muted" style={{ fontSize: 9, letterSpacing: 1 }}>TOKEN</th>
                    <th className="text-left px-4 py-3 text-muted" style={{ fontSize: 9, letterSpacing: 1 }}>EARNERS</th>
                    <th className="text-left px-4 py-3 text-muted" style={{ fontSize: 9, letterSpacing: 1 }}>AMOUNT</th>
                    <th className="text-right px-4 py-3 text-muted" style={{ fontSize: 9, letterSpacing: 1 }}>WEIGHT</th>
                  </tr>
                </thead>
                <tbody>
                  {TOKEN_TABLE.map((row, i) => (
                    <tr key={i} className="border-b border-border-default last:border-0">
                      <td className="px-4 py-3 text-foreground" style={{ fontSize: 10 }}>{row.type}</td>
                      <td className="px-4 py-3 text-muted" style={{ fontSize: 10 }}>{row.earners}</td>
                      <td className="px-4 py-3 text-muted" style={{ fontSize: 10 }}>{row.amount}</td>
                      <td className="px-4 py-3 text-right font-bold text-foreground" style={{ fontSize: 10 }}>{row.weight}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Formula */}
            <div className="bg-surface border border-border-default rounded-xl p-4 mb-4"
              style={{ borderLeft: "3px solid #3b82f6" }}>
              <div className="text-muted mb-1" style={{ fontSize: 9, letterSpacing: 1 }}>FORMULA</div>
              <div className="text-foreground" style={{ fontSize: 11, lineHeight: 2 }}>
                your_share = your_weighted_tokens ÷ total_weighted_tokens<br />
                payout = your_share × quarterly_pool
              </div>
            </div>

            {/* Contribution token earning table */}
            <div className="bg-surface border border-border-default rounded-2xl overflow-hidden mb-4">
              <div className="px-4 py-3 border-b border-border-default">
                <div className="rv-heading text-foreground" style={{ fontSize: 14, fontWeight: 700, letterSpacing: 1 }}>
                  EARNING CONTRIBUTION TOKENS
                </div>
                <div className="text-muted" style={{ fontSize: 9, marginTop: 2 }}>available to all users, including free riders</div>
              </div>
              <table className="w-full" style={{ borderCollapse: "collapse" }}>
                <tbody>
                  {CONTRIB_TABLE.map((row, i) => (
                    <tr key={i} className="border-b border-border-default last:border-0">
                      <td className="px-4 py-3 text-foreground" style={{ fontSize: 10 }}>{row.action}</td>
                      <td className="px-4 py-3 text-right font-bold" style={{ fontSize: 11, color: "#10b981" }}>{row.tokens}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-surface border rounded-xl p-4"
              style={{ borderColor: "#10b98144", background: "#10b98108" }}>
              <p className="text-muted" style={{ fontSize: 10, lineHeight: 1.7 }}>
                <span style={{ color: "#10b981", fontWeight: 700 }}>Note:</span>{" "}
                Contribution tokens accumulate for everyone, but revenue share distributions require
                at least one active member or founder token. Free riders build up a head-start —
                all tokens count the moment they become members.
              </p>
            </div>
          </section>

          {/* ── Section 4: Live calculator ────────────────────────────────── */}
          <section>
            <div className="rv-heading text-foreground mb-2"
              style={{ fontSize: 22, fontWeight: 700, letterSpacing: 2 }}>
              EXAMPLE DISTRIBUTION
            </div>
            <p className="text-muted mb-5" style={{ fontSize: 11, lineHeight: 1.8 }}>
              Adjust the quarterly pool size to see how payouts scale.
            </p>

            <div className="bg-surface border border-border-default rounded-2xl p-5">
              {/* Slider */}
              <div className="mb-6">
                <div className="flex justify-between mb-2">
                  <span className="text-muted" style={{ fontSize: 10 }}>Quarterly pool</span>
                  <span className="text-foreground font-bold" style={{ fontSize: 14 }}>
                    ${poolSize.toLocaleString()}
                  </span>
                </div>
                <input
                  type="range" min={500} max={50000} step={500}
                  value={poolSize}
                  onChange={e => setPoolSize(Number(e.target.value))}
                  className="w-full"
                  style={{ accentColor: "#3b82f6" }}
                />
                <div className="flex justify-between text-muted mt-1" style={{ fontSize: 9 }}>
                  <span>$500</span><span>$50,000</span>
                </div>
              </div>

              {/* Examples */}
              <div className="space-y-3">
                {examples.map((ex) => {
                  const weighted = ex.tokens * ex.weight
                  const share = weighted / totalWeightedTokens
                  const payout = share * poolSize
                  const colors = ["#f59e0b", "#8b5cf6", "#3b82f6", "#10b981"]
                  const color = colors[examples.indexOf(ex)]
                  return (
                    <div key={ex.label} className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="text-foreground" style={{ fontSize: 10 }}>{ex.label}</div>
                        <div className="text-muted" style={{ fontSize: 9 }}>{ex.description}</div>
                      </div>
                      <div className="text-right">
                        <div style={{ fontSize: 13, fontWeight: 700, color }}>
                          ${payout.toFixed(2)}
                        </div>
                        <div className="text-muted" style={{ fontSize: 9 }}>
                          {(share * 100).toFixed(2)}% share
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <p className="text-muted mt-4 pt-4 border-t border-border-default" style={{ fontSize: 9, lineHeight: 1.7 }}>
                Based on ~{totalWeightedTokens.toLocaleString()} total weighted tokens in circulation (illustrative).
                At early scale, individual payouts will be modest — the pitch to early members is
                a stake in something growing, not immediate income.
              </p>
            </div>
          </section>

          {/* ── Section 5: Distribution mechanics ────────────────────────── */}
          <section>
            <div className="rv-heading text-foreground mb-4"
              style={{ fontSize: 22, fontWeight: 700, letterSpacing: 2 }}>
              DISTRIBUTION MECHANICS
            </div>
            <div className="bg-surface border border-border-default rounded-2xl p-5 space-y-4">
              <div>
                <div className="text-muted mb-2" style={{ fontSize: 9, letterSpacing: 1 }}>QUARTERLY SCHEDULE</div>
                <div className="flex flex-wrap gap-2">
                  {DISTRIBUTION_SCHEDULE.map(m => (
                    <div key={m} className="px-3 py-1.5 rounded-full border border-border-default text-foreground"
                      style={{ fontSize: 10 }}>
                      {m}
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-border-default pt-4 space-y-3" style={{ fontSize: 10, lineHeight: 1.7 }}>
                <p className="text-foreground">
                  <span className="text-muted">Snapshot:</span>{" "}
                  Token balances recorded on the last day of each quarter at 23:59 UTC.
                </p>
                <p className="text-foreground">
                  <span className="text-muted">Minimum payout:</span>{" "}
                  $5 — amounts below this threshold roll forward to next quarter and never expire.
                </p>
                <p className="text-foreground">
                  <span className="text-muted">Payout method (v1):</span>{" "}
                  Platform credit, spendable in the Lineage marketplace (events, gear, travel).
                  Cash-out option planned for a future version.
                </p>
                <p className="text-foreground">
                  <span className="text-muted">Transparency:</span>{" "}
                  Aggregate distribution totals are published publicly at{" "}
                  <Link href="/revenue/distributions" className="underline hover:text-foreground transition-colors">/revenue/distributions</Link>.
                  Individual payouts are private.
                </p>
              </div>
            </div>
          </section>

          {/* ── Section 6: Phase roadmap ──────────────────────────────────── */}
          <section>
            <div className="rv-heading text-foreground mb-4"
              style={{ fontSize: 22, fontWeight: 700, letterSpacing: 2 }}>
              WHAT TOKENS WILL DO AS WE GROW
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              {PHASES.map((p) => (
                <div key={p.phase} className="bg-surface border border-border-default rounded-2xl p-4">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="rv-heading font-bold" style={{ fontSize: 14, color: p.color, letterSpacing: 1 }}>
                      {p.phase.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-muted mb-3" style={{ fontSize: 9, letterSpacing: 0.5 }}>{p.label}</div>
                  <ul className="space-y-1.5">
                    {p.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2" style={{ fontSize: 10, lineHeight: 1.4 }}>
                        <span style={{ color: p.color, flexShrink: 0, marginTop: 1 }}>·</span>
                        <span className="text-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* ── Footer CTA ────────────────────────────────────────────────── */}
          <div className="text-center pt-4">
            <Link href="/membership"
              className="inline-block px-8 py-3 rounded-full font-bold transition-all hover:opacity-80"
              style={{
                background: "#3b82f6",
                color: "#fff",
                fontSize: 11,
                letterSpacing: 1.5,
                fontFamily: "'IBM Plex Mono', monospace",
              }}>
              Become a member to start earning your share →
            </Link>
          </div>

        </div>
      </div>
    </>
  )
}
