"use client"

import Link from "next/link"
import { Nav } from "@/components/ui/nav"

const FOUNDING_TOTAL = 500

export default function FoundingPage() {
  // TODO: fetch real founding members from Supabase
  const foundingMembers: { id: string; name: string; joined: string; tagline?: string }[] = []
  const filled = foundingMembers.length
  const remaining = FOUNDING_TOTAL - filled
  const pct = (filled / FOUNDING_TOTAL) * 100
  const isSoldOut = filled >= FOUNDING_TOTAL

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;700&display=swap" />

      <style>{`
        .fd-page { font-family: 'IBM Plex Mono', monospace; }
        .fd-heading { font-family: 'Barlow Condensed', sans-serif; }
      `}</style>

      <div className="fd-page min-h-screen bg-background text-foreground">
        <Nav />

        <div className="max-w-3xl mx-auto px-4 pt-12 pb-24">

          {/* Header */}
          <div className="text-muted mb-3" style={{ fontSize: 10, letterSpacing: 2 }}>// FOUNDING MEMBERS</div>
          <div className="fd-heading text-foreground mb-2"
            style={{ fontSize: "clamp(32px, 6vw, 52px)", fontWeight: 800, letterSpacing: 2, lineHeight: 1.05 }}>
            THE FIRST 500
          </div>
          <p className="text-muted mb-8" style={{ fontSize: 12, lineHeight: 1.8, maxWidth: 520 }}>
            These are the people who believed in Lineage before it was proven.
            Their names are part of the record — permanently.
          </p>

          {/* Progress */}
          <div className="bg-surface border border-border-default rounded-2xl p-5 mb-8">
            <div className="flex items-center justify-between mb-3">
              <div className="fd-heading text-foreground" style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1 }}>
                <span style={{ color: "#f59e0b" }}>✦</span>{" "}
                {filled} / {FOUNDING_TOTAL} spots filled
              </div>
              {!isSoldOut && (
                <div className="text-muted" style={{ fontSize: 10 }}>
                  {remaining} remaining
                </div>
              )}
            </div>
            <div className="bg-surface-2 rounded-full overflow-hidden" style={{ height: 6 }}>
              <div style={{
                width: `${Math.max(pct, 0.5)}%`, height: "100%",
                background: "#f59e0b", borderRadius: 6,
                transition: "width 0.5s ease",
                boxShadow: "0 0 8px #f59e0b44",
              }} />
            </div>
          </div>

          {/* Member grid */}
          {filled > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
              {foundingMembers.map((m) => (
                <div key={m.id}
                  className="bg-surface border border-border-default rounded-xl p-4"
                  style={{ borderTop: "2px solid #f59e0b" }}>
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-amber-900 flex items-center justify-center text-sm font-bold text-amber-200 mb-3">
                    {m.name[0]?.toUpperCase()}
                  </div>
                  <div className="text-foreground font-bold" style={{ fontSize: 11 }}>{m.name}</div>
                  {m.tagline && (
                    <div className="text-muted mt-1" style={{ fontSize: 9, lineHeight: 1.5 }}>{m.tagline}</div>
                  )}
                  <div className="text-muted mt-2" style={{ fontSize: 8 }}>
                    ✦ Founding member since {new Date(m.joined).getFullYear()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-surface border border-border-default rounded-2xl p-12 text-center mb-8">
              <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>✦</div>
              <div className="text-foreground mb-2" style={{ fontSize: 13 }}>No founding members yet</div>
              <p className="text-muted" style={{ fontSize: 10, lineHeight: 1.8 }}>
                The founding era is open. {FOUNDING_TOTAL} spots are available.<br />
                Be the first to claim yours.
              </p>
            </div>
          )}

          {/* CTA */}
          {!isSoldOut ? (
            <div className="text-center">
              <Link href="/membership#tiers"
                className="inline-block px-8 py-3 rounded-full font-bold transition-all hover:opacity-80"
                style={{
                  background: "#f59e0b",
                  color: "#000",
                  fontSize: 11,
                  letterSpacing: 1.5,
                  fontFamily: "'IBM Plex Mono', monospace",
                }}>
                Claim your founding spot — $100 →
              </Link>
              <div className="text-muted mt-3" style={{ fontSize: 9 }}>
                {remaining} spots remaining · closes when full
              </div>
            </div>
          ) : (
            <div className="text-center bg-surface border border-border-default rounded-2xl p-6">
              <div className="text-foreground mb-2 fd-heading" style={{ fontSize: 18, fontWeight: 700 }}>
                THE FOUNDING ERA IS CLOSED
              </div>
              <p className="text-muted mb-4" style={{ fontSize: 11, lineHeight: 1.7 }}>
                All 500 founding spots have been claimed. Annual and lifetime memberships are still available.
              </p>
              <Link href="/membership"
                className="inline-block px-6 py-2 rounded-full border border-border-default text-muted hover:text-foreground hover:border-foreground transition-all"
                style={{ fontSize: 10, letterSpacing: 1 }}>
                See membership options →
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
