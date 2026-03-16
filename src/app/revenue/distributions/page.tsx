"use client"

import Link from "next/link"
import { Nav } from "@/components/ui/nav"

export default function DistributionsPage() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800&family=IBM+Plex+Mono:wght@400;700&display=swap" />

      <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
        <Nav />
        <div className="max-w-3xl mx-auto px-4 pt-12 pb-24">
          <div className="text-muted mb-3" style={{ fontSize: 10, letterSpacing: 2 }}>// DISTRIBUTIONS</div>
          <div className="text-foreground mb-2" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 36, fontWeight: 800, letterSpacing: 2 }}>
            DISTRIBUTION LOG
          </div>
          <p className="text-muted mb-10" style={{ fontSize: 11, lineHeight: 1.8 }}>
            Aggregate totals for every quarterly distribution. Individual payouts are private.
          </p>

          <div className="bg-surface border border-border-default rounded-2xl p-8 text-center">
            <div className="text-muted mb-2" style={{ fontSize: 28, opacity: 0.3 }}>◎</div>
            <div className="text-foreground mb-2" style={{ fontSize: 12 }}>No distributions yet</div>
            <p className="text-muted" style={{ fontSize: 10, lineHeight: 1.8 }}>
              The first distribution will appear here after the first quarter closes.<br />
              Distributions run in January, April, July, and October.
            </p>
            <div className="mt-6">
              <Link href="/revenue" className="text-muted hover:text-foreground transition-colors underline" style={{ fontSize: 10 }}>
                ← How revenue sharing works
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
