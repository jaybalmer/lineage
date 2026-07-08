"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { BrandMark } from "@/components/ui/brand-mark"
import { trackEvent } from "@/lib/analytics"
import { cn } from "@/lib/utils"
import {
  EQUITY_SNAPSHOT_DATE,
  EQUITY_SNAPSHOT_LABEL,
  EQUITY_POOL_SHARES,
} from "@/lib/equity-offer"
import {
  ConstellationScene,
  ConnectionsScene,
  CommunityScene,
  EquityScene,
  TimelineAliveScene,
} from "@/components/onboarding/intro-visuals"

// The pre-signup intro slideshow (brief §6). Chromeless full-viewport, manual
// navigation only (D4): dots, swipe, arrow keys, and each screen's CTA. Screen 4
// (equity) is conditional on the launch offer still being live (D5). The final
// CTA drops into /onboarding?from=intro, which the wizard reads to skip its land
// step (D3). Everything is UI-only; the one network call is a public GET reuse.

const WIZARD_TARGET = "/onboarding?from=intro"
const SWIPE_THRESHOLD = 40 // px of horizontal travel to count as a swipe

// Each screen keeps a canonical number (1..5) so analytics reads the same funnel
// step regardless of whether the equity screen is present (D5, §7).
interface ScreenDef {
  num: number
  headline: string
  body: React.ReactNode
  visual: React.ReactNode
  cta: string
  equity?: boolean
}

function screenIsEquityLive(): boolean {
  // The snapshot date IS the offer-active mechanism (D5): no boolean flag exists.
  return new Date() < new Date(EQUITY_SNAPSHOT_DATE)
}

export function IntroSlideshow() {
  const router = useRouter()
  const [index, setIndex] = useState(0)

  // D5 date gate, computed at view time. Both branches must be verifiable by
  // flipping the clock or stubbing the constant (acceptance §9.4).
  const showEquity = useMemo(() => screenIsEquityLive(), [])

  // Live contributor counter for Screen 4. Hidden entirely on fetch failure or
  // when member_count < 10 (D5). Never a fabricated number.
  const [poolCount, setPoolCount] = useState<number | null>(null)
  const [poolFailed, setPoolFailed] = useState(false)
  useEffect(() => {
    if (!showEquity) return
    let cancelled = false
    fetch("/api/equity/pool")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("bad status"))))
      .then((data) => {
        if (cancelled) return
        const n = Number(data?.member_count)
        setPoolCount(Number.isFinite(n) ? n : null)
      })
      .catch(() => {
        if (!cancelled) setPoolFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [showEquity])

  const showCounter =
    showEquity && !poolFailed && poolCount !== null && poolCount >= 10

  const screens: ScreenDef[] = useMemo(() => {
    const equityScreen: ScreenDef = {
      num: 4,
      equity: true,
      headline: "Contribute. Own a Piece of This.",
      body: (
        <>
          Early contributors earn tokens for what they add. At the{" "}
          {EQUITY_SNAPSHOT_LABEL} snapshot, a pool of{" "}
          {EQUITY_POOL_SHARES.toLocaleString()} shares in Lineage Community
          Technologies is split across the launch community by token balance.
        </>
      ),
      visual: <EquityScene />,
      cta: "Claim Your Stake",
    }
    const list: ScreenDef[] = [
      {
        num: 1,
        headline: "This Isn't a Feed.",
        body: "Every story you add connects: to a place, a time, and the people who were there. This is history, wired together.",
        visual: <ConstellationScene />,
        cta: "See How It Works",
      },
      {
        num: 2,
        headline: "Stories. People. Places. Boards.",
        body: "Browse a mountain and see every story that happened there. Find a rider and follow their whole arc. Everything is connected.",
        visual: <ConnectionsScene />,
        cta: "Explore Connections",
      },
      {
        num: 3,
        headline: "Built by the People Who Were There.",
        body: "This history isn't written by editors. It's authored by the community: riders, photographers, fans who lived it.",
        visual: <CommunityScene />,
        cta: "Meet the Community",
      },
      ...(showEquity ? [equityScreen] : []),
      {
        num: 5,
        headline: "Your History Starts Now.",
        body: "Add a photo. Tell a story. Connect yourself to forty years of snowboarding. You were part of this.",
        visual: <TimelineAliveScene />,
        cta: "Start Your Timeline",
      },
    ]
    return list
  }, [showEquity])

  const total = screens.length
  const current = screens[Math.min(index, total - 1)]
  const isFinal = index === total - 1

  // ── Analytics: one ftue_intro_viewed per screen per visit (§7) ──────────────
  const viewedRef = useRef<Set<number>>(new Set())
  useEffect(() => {
    const num = current.num
    if (viewedRef.current.has(num)) return
    viewedRef.current.add(num)
    trackEvent("ftue", "ftue_intro_viewed", {
      screen: num,
      equity_screen_present: showEquity,
    })
  }, [current.num, showEquity])

  // ── Navigation ──────────────────────────────────────────────────────────────
  const goTo = useCallback(
    (i: number) => {
      setIndex((prev) => {
        const next = Math.max(0, Math.min(total - 1, i))
        return next === prev ? prev : next
      })
    },
    [total],
  )

  const advance = useCallback(() => {
    setIndex((prev) => Math.min(total - 1, prev + 1))
  }, [total])

  const retreat = useCallback(() => {
    setIndex((prev) => Math.max(0, prev - 1))
  }, [])

  const goToWizard = useCallback(() => {
    router.push(WIZARD_TARGET)
  }, [router])

  const handleSkip = useCallback(() => {
    trackEvent("ftue", "ftue_intro_skipped", { screen: current.num })
    goToWizard()
  }, [current.num, goToWizard])

  const handleCta = useCallback(() => {
    if (isFinal) {
      trackEvent("ftue", "ftue_intro_completed")
      goToWizard()
      return
    }
    advance()
  }, [isFinal, advance, goToWizard])

  // Arrow keys (D4).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") advance()
      else if (e.key === "ArrowLeft") retreat()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [advance, retreat])

  // Touch swipe (D4).
  const touchStartX = useRef<number | null>(null)
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current
    const delta = endX - touchStartX.current
    touchStartX.current = null
    if (delta <= -SWIPE_THRESHOLD) advance()
    else if (delta >= SWIPE_THRESHOLD) retreat()
  }

  return (
    <div
      className="fixed inset-0 bg-background text-foreground flex flex-col overflow-hidden select-none"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Chromeless header: brand lockup left, Skip right (D1). */}
      <header className="flex items-center justify-between px-5 py-4 shrink-0">
        <div className="flex items-center gap-2">
          <BrandMark size={22} />
          <span
            className="text-lg text-foreground"
            style={{ fontFamily: "var(--font-wordmark)" }}
          >
            Linestry
          </span>
        </div>
        <button
          onClick={handleSkip}
          className="text-sm text-muted hover:text-foreground transition-colors"
        >
          Skip
        </button>
      </header>

      {/* Screen body. Keyed on index so each screen re-mounts and plays its
          enter animation (reduced-motion collapses this to a quick fade). */}
      <main
        key={index}
        className="ftue-intro-screen flex-1 min-h-0 flex flex-col px-6 pb-4"
      >
        {/* Visual fills the upper portion of the viewport (§6). */}
        <div className="flex-[0_0_52%] min-h-0 flex items-center justify-center">
          <div className="w-full h-full max-w-sm">{current.visual}</div>
        </div>

        {/* Text + CTA */}
        <div className="flex-1 min-h-0 flex flex-col items-center text-center max-w-md mx-auto w-full">
          <h1
            className="text-[1.65rem] leading-tight text-foreground mb-3"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {current.headline}
          </h1>
          <p
            className="text-muted leading-relaxed text-[0.95rem] mb-1"
            style={{ fontWeight: 300 }}
          >
            {current.body}
          </p>

          {/* Live contributor counter, Screen 4 only, gated by D5. */}
          {current.equity && showCounter && (
            <p className="text-accent-strong text-sm font-semibold mt-2">
              {poolCount!.toLocaleString()} founding contributors so far
            </p>
          )}

          <div className="mt-auto pt-5 w-full flex flex-col items-center gap-3">
            <button
              onClick={handleCta}
              className="px-8 py-3 rounded-full bg-accent text-white font-semibold text-sm hover:bg-accent-strong transition-colors"
            >
              {current.cta}
            </button>

            {/* Screen 4 explainer link (D5). */}
            {current.equity && (
              <Link
                href="/equity"
                className="text-muted text-xs hover:text-foreground underline underline-offset-2 transition-colors"
              >
                How the offer works
              </Link>
            )}
          </div>
        </div>
      </main>

      {/* Dot indicators reflect 4 vs 5 screens (D5). Clickable (D4). */}
      <div className="shrink-0 flex items-center justify-center gap-2.5 pb-7 pt-2">
        {screens.map((s, i) => (
          <button
            key={s.num}
            onClick={() => goTo(i)}
            aria-label={`Go to screen ${i + 1} of ${total}`}
            className={cn(
              "h-2 rounded-full transition-all",
              i === index
                ? "w-6 bg-accent"
                : "w-2 bg-foreground/20 hover:bg-foreground/40",
            )}
          />
        ))}
      </div>
    </div>
  )
}
