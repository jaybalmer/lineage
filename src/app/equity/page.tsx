"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Nav } from "@/components/ui/nav"
import {
  EQUITY_POOL_SHARES,
  EQUITY_SNAPSHOT_LABEL,
  PROJECTED_TOTAL_WEIGHTED,
  CONTRIBUTOR_COMP_THRESHOLD,
  estimateShares,
} from "@/lib/equity-offer"

// The equity launch offer explainer. Replaced the revenue-sharing page
// (token-system-equity-offer brief §5.4): there is no revenue yet, so the
// premature revenue-share framing gave way to a concrete offer, one fixed
// pool of 100,000 common shares distributed by token balance at the
// September 30, 2026 snapshot. /revenue 308s here via next.config.

const TOKEN_TABLE = [
  { type: "Founder token",      earners: "Founding members",          amount: "100 on purchase",                        weight: "2×" },
  { type: "Member token",       earners: "Annual, Lifetime, Founding", amount: "20 per year (Lifetime: 70 upfront)", weight: "1×" },
  { type: "Contribution token", earners: "All riders earn; members share", amount: "Earned by activity",                weight: "1×" },
]

const CONTRIB_TABLE = [
  { action: "Adding a timeline entry or story",                    tokens: "+1", live: true },
  { action: "Posting a story with photos",                         tokens: "+1", live: true },
  { action: "Linking an authoritative external source",            tokens: "+2", live: true },
  { action: "Adding a community connection to a story",            tokens: "+1", live: true },
  { action: "Adding a new place, board, or event to the catalog",  tokens: "+2", live: true },
  { action: "Showing up: your first visit each day",               tokens: "+1", live: true },
  { action: "Onboarding a new active rider",                       tokens: "+5", live: true },
  { action: "Verifying another rider's entry (members only)",      tokens: "+1", live: false },
  { action: "Entry verified by 3+ members (bonus to you)",         tokens: "+2", live: false },
]

export default function EquityPage() {
  const [myTokens, setMyTokens] = useState(50)
  const [poolTotal, setPoolTotal] = useState<number | null>(null)

  // Live platform-wide weighted total; the illustrative constant is the
  // fallback until the fetch lands (or if it fails).
  useEffect(() => {
    fetch("/api/equity/pool")
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.total_weighted_tokens === "number" && d.total_weighted_tokens > 0) {
          setPoolTotal(d.total_weighted_tokens)
        }
      })
      .catch(() => {})
  }, [])

  // BUG-061: the estimate is floored at a projected end-of-offer pool so an
  // early estimate is realistic rather than dividing by the tiny live total.
  // Display the same effective denominator so the copy below matches the number.
  const liveTotal = poolTotal ?? 0
  const projectionFloored = liveTotal < PROJECTED_TOTAL_WEIGHTED
  const effectiveTotal = Math.max(liveTotal, PROJECTED_TOTAL_WEIGHTED)
  const est = estimateShares(myTokens, effectiveTotal)

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;500;700&display=swap" />

      <style>{`
        .eq-page { font-family: var(--font-body); }
        .eq-heading { font-family: var(--font-display); }
      `}</style>

      <div className="eq-page min-h-screen bg-background text-foreground">
        <Nav />

        <div className="max-w-3xl mx-auto px-4 pt-12 pb-24 space-y-16">

          {/* ── Header ──────────────────────────────────────────────────── */}
          <div>
            <div className="text-muted mb-3" style={{ fontSize: 10, letterSpacing: 2 }}>// EQUITY LAUNCH OFFER</div>
            <div className="eq-heading text-foreground"
              style={{ fontSize: "clamp(32px, 6vw, 52px)", fontWeight: 800, letterSpacing: 2, lineHeight: 1.05 }}>
              OWN A PIECE<br />OF LINESTRY
            </div>
            <p className="text-muted mt-4" style={{ fontSize: 12, lineHeight: 1.8, maxWidth: 520 }}>
              100,000 common shares, set aside for the community that builds the record.
              Your token balance decides your slice. First distribution September 2026.
            </p>
          </div>

          {/* ── Section 1: The offer ─────────────────────────────────────── */}
          <section>
            <div className="eq-heading text-foreground mb-4"
              style={{ fontSize: 22, fontWeight: 700, letterSpacing: 2 }}>
              THE OFFER
            </div>
            <div className="grid sm:grid-cols-3 gap-4 mb-5">
              {[
                { big: "100,000", small: "COMMON SHARES IN THE POOL", color: "#f59e0b" },
                { big: "SEP 30", small: "2026 SNAPSHOT DATE", color: "#3b82f6" },
                { big: "2×", small: "FOUNDER TOKEN WEIGHT", color: "#10b981" },
              ].map((t) => (
                <div key={t.small} className="bg-surface border rounded-2xl p-4 text-center"
                  style={{ borderColor: `${t.color}44` }}>
                  <div className="eq-heading mb-1" style={{ fontSize: 26, fontWeight: 800, color: t.color }}>{t.big}</div>
                  <div className="text-muted" style={{ fontSize: 8, letterSpacing: 1 }}>{t.small}</div>
                </div>
              ))}
            </div>
            <div className="bg-surface border border-border-default rounded-2xl p-5">
              <p className="text-foreground" style={{ fontSize: 11, lineHeight: 1.9 }}>
                Linestry is setting aside a single fixed pool of 100,000 common shares of
                Lineage Community Technologies Inc. for the launch community. On{" "}
                <strong>{EQUITY_SNAPSHOT_LABEL}</strong>{" "}we take a snapshot of every member&apos;s
                token balance, and the pool is split in proportion to weighted tokens:
                the more you have built by then, the larger your slice.
              </p>
              <p className="text-muted pt-3 mt-3 border-t border-border-default"
                style={{ fontSize: 9, lineHeight: 1.7, letterSpacing: 0.3 }}>
                One pool, shared by everyone, not 100,000 shares per member. After the snapshot,
                shares are held collectively in the Lineage Community Trust on your behalf. Your slice
                is determined by your tokens. The trust handles the rest.
              </p>
            </div>
          </section>

          {/* ── Section 1b: Who shares the pool ──────────────────────────── */}
          <section>
            <div className="eq-heading text-foreground mb-4"
              style={{ fontSize: 22, fontWeight: 700, letterSpacing: 2 }}>
              WHO SHARES THE POOL
            </div>
            <p className="text-muted mb-5" style={{ fontSize: 11, lineHeight: 1.8 }}>
              The pool is shared by members, not every account. There are two ways in, and
              both let your tokens start counting toward your slice.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-surface border rounded-2xl p-5" style={{ borderColor: "#3b82f644" }}>
                <div className="eq-heading mb-2" style={{ fontSize: 14, fontWeight: 700, color: "#3b82f6", letterSpacing: 1 }}>
                  PAY
                </div>
                <p className="text-foreground" style={{ fontSize: 10, lineHeight: 1.8 }}>
                  Become a member: Annual, Lifetime, or Founding. Your tokens count in the pool
                  for as long as your membership is active.
                </p>
              </div>
              <div className="bg-surface border rounded-2xl p-5" style={{ borderColor: "#10b98144" }}>
                <div className="eq-heading mb-2" style={{ fontSize: 14, fontWeight: 700, color: "#10b981", letterSpacing: 1 }}>
                  EARN
                </div>
                <p className="text-foreground" style={{ fontSize: 10, lineHeight: 1.8 }}>
                  Earn {CONTRIBUTOR_COMP_THRESHOLD} contribution tokens and we comp you a free year
                  of membership. Same benefits, no payment.
                </p>
              </div>
            </div>
            <p className="text-muted mt-4" style={{ fontSize: 10, lineHeight: 1.7 }}>
              Free riders keep every token they earn. Those tokens start sharing the pool the moment
              you become a member, by either route.
            </p>
          </section>

          {/* ── Section 2: Tokens ────────────────────────────────────────── */}
          <section>
            <div className="eq-heading text-foreground mb-2"
              style={{ fontSize: 22, fontWeight: 700, letterSpacing: 2 }}>
              TOKENS DECIDE YOUR SLICE
            </div>
            <p className="text-muted mb-5" style={{ fontSize: 11, lineHeight: 1.8 }}>
              Tokens are how your slice of the pool is calculated. They are non-transferable
              internal credits, not crypto, and they never expire.
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
              style={{ borderLeft: "3px solid #f59e0b" }}>
              <div className="text-muted mb-1" style={{ fontSize: 9, letterSpacing: 1 }}>FORMULA</div>
              <div className="text-foreground" style={{ fontSize: 11, lineHeight: 2 }}>
                weighted_tokens = founder×2 + member×1 + contribution×1<br />
                your_shares = your_weighted_tokens ÷ all_weighted_tokens × {EQUITY_POOL_SHARES.toLocaleString()}
              </div>
            </div>

            {/* Contribution token earning table */}
            <div className="bg-surface border border-border-default rounded-2xl overflow-hidden mb-4">
              <div className="px-4 py-3 border-b border-border-default">
                <div className="eq-heading text-foreground" style={{ fontSize: 14, fontWeight: 700, letterSpacing: 1 }}>
                  EARNING CONTRIBUTION TOKENS
                </div>
                <div className="text-muted" style={{ fontSize: 9, marginTop: 2 }}>earning is open to all riders, including the free tier</div>
              </div>
              <table className="w-full" style={{ borderCollapse: "collapse" }}>
                <tbody>
                  {CONTRIB_TABLE.map((row, i) => (
                    <tr key={i} className="border-b border-border-default last:border-0">
                      <td className="px-4 py-3 text-foreground" style={{ fontSize: 10 }}>
                        {row.action}
                        {!row.live && (
                          <span className="text-muted ml-2" style={{ fontSize: 8, letterSpacing: 0.5 }}>COMING SOON</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-bold" style={{ fontSize: 11, color: "#10b981" }}>{row.tokens}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-surface border rounded-xl p-4"
              style={{ borderColor: "#10b98144", background: "#10b98108" }}>
              <p className="text-muted" style={{ fontSize: 10, lineHeight: 1.7 }}>
                <span style={{ color: "#10b981", fontWeight: 700 }}>Fair-play cap:</span>{" "}
                content actions (entries, media, sources, connections, catalog adds) earn at most
                20 tokens per day. Daily visits, onboarding, and verification sit outside the cap.
              </p>
            </div>
          </section>

          {/* ── Section 3: Share estimator ───────────────────────────────── */}
          <section>
            <div className="eq-heading text-foreground mb-2"
              style={{ fontSize: 22, fontWeight: 700, letterSpacing: 2 }}>
              WHAT YOUR TOKENS COULD BE WORTH
            </div>
            <p className="text-muted mb-5" style={{ fontSize: 11, lineHeight: 1.8 }}>
              Slide to a weighted token balance and see the slice of the pool it would earn
              against {projectionFloored ? "a projected end-of-offer total" : "the community's current total"}.
            </p>

            <div className="bg-surface border border-border-default rounded-2xl p-5">
              <div className="mb-6">
                <div className="flex justify-between mb-2">
                  <span className="text-muted" style={{ fontSize: 10 }}>Your weighted tokens</span>
                  <span className="text-foreground font-bold" style={{ fontSize: 14 }}>{myTokens}</span>
                </div>
                <input
                  type="range" min={1} max={500} step={1}
                  value={myTokens}
                  onChange={e => setMyTokens(Number(e.target.value))}
                  className="w-full"
                  style={{ accentColor: "#f59e0b" }}
                />
                <div className="flex justify-between text-muted mt-1" style={{ fontSize: 9 }}>
                  <span>1</span><span>500</span>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border p-4"
                style={{ borderColor: "#f59e0b44", background: "#f59e0b08" }}>
                <div>
                  <div className="text-muted" style={{ fontSize: 9, letterSpacing: 1 }}>ESTIMATED SHARES</div>
                  <div className="eq-heading" style={{ fontSize: 28, fontWeight: 800, color: "#f59e0b" }}>
                    ~{(est?.shares ?? 0).toLocaleString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-muted" style={{ fontSize: 9, letterSpacing: 1 }}>OF {EQUITY_POOL_SHARES.toLocaleString()}</div>
                  <div className="text-foreground font-bold" style={{ fontSize: 14 }}>
                    {(est?.pct ?? 0).toFixed(2)}%
                  </div>
                </div>
              </div>

              <p className="text-muted mt-4 pt-4 border-t border-border-default" style={{ fontSize: 9, lineHeight: 1.7 }}>
                Based on ~{effectiveTotal.toLocaleString()} total weighted tokens
                {projectionFloored ? " (projected end-of-offer pool)" : " in circulation right now"}. Every estimate moves
                until the {EQUITY_SNAPSHOT_LABEL} snapshot: as the community earns, the pie divides
                further; as you contribute, your slice grows back.
              </p>
            </div>

            <p className="text-muted mt-3" style={{ fontSize: 10 }}>
              Signed in?{" "}
              <Link href="/account/membership" className="underline hover:text-foreground transition-colors">
                See your live estimate on your membership page →
              </Link>
            </p>
          </section>

          {/* ── Section 4: Distribution mechanics ────────────────────────── */}
          <section>
            <div className="eq-heading text-foreground mb-4"
              style={{ fontSize: 22, fontWeight: 700, letterSpacing: 2 }}>
              DISTRIBUTION MECHANICS
            </div>
            <div className="bg-surface border border-border-default rounded-2xl p-5 space-y-3"
              style={{ fontSize: 10, lineHeight: 1.7 }}>
              <p className="text-foreground">
                <span className="text-muted">Snapshot:</span>{" "}
                Token balances recorded on {EQUITY_SNAPSHOT_LABEL} at 23:59 UTC. Nothing to do
                before then except keep building your linestry.
              </p>
              <p className="text-foreground">
                <span className="text-muted">Community Trust:</span>{" "}
                After the snapshot, shares are held in the Lineage Community Trust on behalf of all
                qualifying members. Your beneficial interest in the trust is proportional to your
                weighted token balance. One trust, one pool, shared by the community that built it.
              </p>
              <p className="text-foreground">
                <span className="text-muted">Your stake:</span>{" "}
                You don&apos;t hold shares directly. The trust holds them for you. Your token balance
                determines your share of the trust, and your share of any future value event: sale,
                dividend, or IPO. Think of it as community ownership without the paperwork.
              </p>
              <p className="text-foreground">
                <span className="text-muted">Estimates:</span>{" "}
                Until the snapshot, the share numbers you see in the app are estimates. They move
                with every token the community earns.
              </p>
              <p className="text-foreground">
                <span className="text-muted">Tokens stay tokens:</span>{" "}
                Tokens are not securities and never convert by themselves. They are the measuring
                stick the trust uses on snapshot day to calculate each member&apos;s beneficial interest.
              </p>
            </div>
          </section>

          {/* ── Footer CTA ────────────────────────────────────────────────── */}
          <div className="text-center pt-4">
            <Link href="/membership"
              className="inline-block px-8 py-3 rounded-full font-bold transition-all hover:opacity-80"
              style={{
                background: "#f59e0b",
                color: "#000",
                fontSize: 11,
                letterSpacing: 1.5,
                fontFamily: "var(--font-body)",
              }}>
              Become a member to grow your share →
            </Link>
          </div>

        </div>
      </div>
    </>
  )
}
