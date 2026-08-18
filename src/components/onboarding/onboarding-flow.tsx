"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useLineageStore } from "@/store/lineage-store"
import { trackEvent } from "@/lib/analytics"
import { cn } from "@/lib/utils"
import { eraForYear, ERA_FTUE } from "@/lib/eras"
import { BrandMark } from "@/components/ui/brand-mark"
import { FtueMosaic } from "@/components/onboarding/ftue-mosaic"
import { SaveStep } from "@/components/onboarding/save-step"
import {
  BigNumber,
  Callout,
  Eyebrow,
  SectionLabel,
  StatTile,
} from "@/components/onboarding/ftue-bits"

// ─────────────────────────────────────────────────────────────────────────────
// The FTUE, as one story rather than a form.
//
//   scatter  — our stories are strewn across feeds, unconnected
//   weave    — Linestry gives every piece a home (live catalog numbers)
//   name     — "you're joining a community weaving our real stories together"
//   year     — the one anchor the whole timeline hangs off
//   era      — the reveal: your year, your seasons, your era, your peers
//   welcome  — "Here is the start of your timeline" + what you can add
//   save     — the auth gate
//
// Design notes that matter to future edits:
//
// • The flow renders inside .ftue-dark (globals.css), a token scope rather than
//   an <html class="dark"> toggle. Forced dark with no first-paint flash, no
//   write to the persisted theme, and nothing to unwind on the way out.
//
// • Place and board are no longer questions. They moved to the welcome screen
//   as things you CAN add, which shortens the pre-auth path to two fields and
//   turns the old survey tail into an invitation. Nothing else creates session
//   claims now, so the only thing carried through auth is name + start year.
//
// • The Started Riding card is not special-cased anywhere downstream: the real
//   timeline already renders a riding_start item from profiles.riding_since
//   (see feed-view + start-card), so the card previewed here is the card the
//   rider actually lands on.
// ─────────────────────────────────────────────────────────────────────────────

type StepId = "scatter" | "weave" | "name" | "year" | "era" | "welcome" | "save"

const STEPS: StepId[] = ["scatter", "weave", "name", "year", "era", "welcome", "save"]

const MIN_YEAR = 1960

type CommunityStats = {
  riders: number | null
  places: number | null
  brands: number | null
  connections: number | null
  peers: number | null
  stories: number | null
}

const EMPTY_STATS: CommunityStats = {
  riders: null, places: null, brands: null, connections: null, peers: null, stories: null,
}

// ─── Chrome ──────────────────────────────────────────────────────────────────

function Lockup() {
  // The canonical lockup: the tilted mark sized to the wordmark's ink height,
  // wordmark in Calendula Bold via --font-wordmark. Do not substitute a body
  // font here — the wordmark face IS the brand.
  return (
    <div className="flex items-center gap-2">
      <BrandMark size={26} />
      <span
        className="text-[19px] leading-none text-foreground"
        style={{ fontFamily: "var(--font-wordmark)" }}
      >
        Linestry
      </span>
    </div>
  )
}

/** Progress as one thread growing across the top, not a survey bar. */
function Thread({ pct }: { pct: number }) {
  return (
    <div className="h-0.5 rounded-full bg-foreground/10 overflow-hidden">
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{
          width: `${pct}%`,
          background: "linear-gradient(90deg,#8b5cf6,#3B82F6)",
        }}
      />
    </div>
  )
}

const fieldCls =
  "w-full bg-surface-2 border border-border-default rounded-2xl px-4 py-4 text-foreground " +
  "text-[17px] outline-none transition-colors placeholder:text-muted/60 focus:border-accent"

// ─── Flow ────────────────────────────────────────────────────────────────────

export function OnboardingFlow() {
  const router = useRouter()
  const {
    onboarding,
    setOnboardingField,
    setOnboardingStep,
    completeOnboarding,
    setProfileOverride,
    setActivePersonId,
    activeCommunitySlug,
  } = useLineageStore()

  const step = onboarding.step
  const currentStepId: StepId = STEPS[step] ?? "save"
  const [claimContext, setClaimContext] = useState<{ inviterName?: string } | null>(null)

  // One funnel event per name per visit; back-navigation must not double-count.
  const firedRef = useRef<Set<string>>(new Set())

  const displayName = onboarding.display_name?.trim() ?? ""
  const firstName = displayName.split(" ")[0] || ""
  const startYear = onboarding.start_year ?? null

  // ── Invite prefill (sessionStorage, written by /claim/[token]) ─────────────
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("lineage_claim_prefill")
      if (!raw) return
      const prefill = JSON.parse(raw) as {
        display_name?: string
        riding_since?: number | null
        inviter_name?: string
      }
      if (prefill.display_name && !onboarding.display_name) {
        setOnboardingField("display_name", prefill.display_name)
      }
      if (prefill.riding_since && !onboarding.start_year) {
        setOnboardingField("start_year", prefill.riding_since)
      }
      if (prefill.inviter_name) {
        const inviterName = prefill.inviter_name
        // Deferred out of the effect body: claimContext drives an invited-only
        // card that must stay null on the SSR first paint (no sessionStorage
        // server-side), so it cannot move into render or an initialiser.
        queueMicrotask(() => setClaimContext({ inviterName }))
      }
    } catch {
      /* sessionStorage may be unavailable */
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Entry step (BUG-166 D2) ───────────────────────────────────────────────
  // Always enter at the top of the story. Persisted answers survive, so a
  // returning half-finished visitor re-reads the pitch with their picks still
  // filled in rather than being dropped onto a bare mid-flow question.
  //
  // Runs against the HYDRATED store: persist rehydrates onboarding.step
  // asynchronously, so reading it pre-hydration would see 0, skip the reset,
  // and strand the visitor on a stale step once hydration lands.
  const entryHandledRef = useRef(false)
  useEffect(() => {
    if (entryHandledRef.current) return
    entryHandledRef.current = true

    let fromIntro = false
    try {
      fromIntro = new URLSearchParams(window.location.search).get("from") === "intro"
    } catch {
      /* window/search may be unavailable */
    }

    // Fire ftue_landed here, before the step effect below can, so an /intro
    // arrival is tagged once and never also logged source-less on the same mount.
    if (!firedRef.current.has("ftue_landed")) {
      firedRef.current.add("ftue_landed")
      trackEvent("ftue", "ftue_landed", fromIntro ? { source: "intro" } : {})
    }

    const applyEntryStep = () => {
      if (useLineageStore.getState().onboarding.step !== 0) setOnboardingStep(0)
    }
    if (useLineageStore.persist.hasHydrated()) applyEntryStep()
    else useLineageStore.persist.onFinishHydration(applyEntryStep)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Funnel: one step-shown event per step per visit ────────────────────────
  useEffect(() => {
    const name =
      currentStepId === "scatter" || currentStepId === "weave"
        ? "ftue_intro_viewed"
        : currentStepId === "era"
          ? "ftue_aha_shown"
          : currentStepId === "welcome"
            ? "ftue_timeline_shown"
            : currentStepId === "save"
              ? "ftue_save_shown"
              : null
    if (!name) return
    const key = `${name}:${currentStepId}`
    if (firedRef.current.has(key)) return
    firedRef.current.add(key)
    trackEvent("ftue", name, { step_id: currentStepId })
  }, [currentStepId])

  // ── Live community stats ──────────────────────────────────────────────────
  // Every number in the flow comes from here. A failed or partial fetch leaves
  // the field null and the callout simply does not render — the FTUE never
  // shows an invented or zero-filled number.
  const [stats, setStats] = useState<CommunityStats>(EMPTY_STATS)
  useEffect(() => {
    let cancelled = false
    const qs = startYear ? `?year=${startYear}` : ""
    fetch(`/api/stats/community${qs}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("bad status"))))
      .then((data: CommunityStats) => {
        if (cancelled) return
        setStats({
          riders: numOrNull(data.riders),
          places: numOrNull(data.places),
          brands: numOrNull(data.brands),
          connections: numOrNull(data.connections),
          peers: numOrNull(data.peers),
          stories: numOrNull(data.stories),
        })
      })
      .catch(() => {
        if (!cancelled) setStats(EMPTY_STATS)
      })
    return () => {
      cancelled = true
    }
  }, [startYear])

  // ── Navigation ────────────────────────────────────────────────────────────

  const canContinue = useCallback(() => {
    if (currentStepId === "name") return displayName.length > 0
    if (currentStepId === "year") return isUsableYear(startYear)
    return true
  }, [currentStepId, displayName, startYear])

  const next = useCallback(() => {
    if (currentStepId === "save") return
    trackEvent("ftue", "ftue_step_completed", { step_id: currentStepId })
    if (step < STEPS.length - 1) setOnboardingStep(step + 1)
  }, [currentStepId, step, setOnboardingStep])

  const back = () => {
    if (step > 0) setOnboardingStep(step - 1)
  }

  // A persistent exit so the flow is never a trap (BUG-166 D3/D5). Navigates
  // only, so answers survive for a later return; ftue_exited records where.
  const exitToBrowsing = () => {
    trackEvent("ftue", "ftue_exited", { step_id: currentStepId })
    router.push(`/${activeCommunitySlug}`)
  }

  // Dev bypass — skip the OAuth gate locally, binding the answers to a dev user
  // so the timeline renders exactly as the real save path would leave it.
  const devBypass = () => {
    const devId = `dev-${Date.now().toString(36)}`
    setProfileOverride({
      display_name: displayName || "Dev User",
      birth_year: onboarding.birth_year,
      riding_since: onboarding.start_year,
      privacy_level: "private",
    })
    setActivePersonId(devId)
    completeOnboarding()
    trackEvent("ftue", "ftue_completed", { via: "dev_bypass" })
    router.replace(`/${activeCommunitySlug}/timeline`)
  }

  const era = useMemo(() => (startYear ? eraForYear(startYear) : null), [startYear])
  const eraCopy = era ? ERA_FTUE[era.key] : null
  const seasons = startYear ? Math.max(1, new Date().getFullYear() - startYear) : null

  const primaryLabel =
    currentStepId === "scatter"
      ? "Next"
      : currentStepId === "weave"
        ? "Start"
        : currentStepId === "era"
          ? "Bring it together"
          : currentStepId === "welcome"
            ? "Save my timeline"
            : "Continue"

  const showSkip = currentStepId === "scatter" || currentStepId === "weave"
  const threadPct = Math.round((step / (STEPS.length - 1)) * 100)

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="ftue-dark min-h-dvh flex flex-col px-5 pb-6"
      data-ftue-step={currentStepId}
    >
      {/* Chrome */}
      <header className="flex items-center justify-between pt-4 pb-2.5 shrink-0">
        <Lockup />
        {showSkip ? (
          <button
            onClick={() => {
              trackEvent("ftue", "ftue_intro_skipped", { step_id: currentStepId })
              setOnboardingStep(STEPS.indexOf("name"))
            }}
            className="text-sm text-muted hover:text-foreground transition-colors"
          >
            Skip
          </button>
        ) : (
          <button
            onClick={exitToBrowsing}
            className="text-sm text-muted hover:text-foreground transition-colors"
          >
            Back to browsing
          </button>
        )}
      </header>
      <Thread pct={threadPct} />

      {/* Body. Keyed on the step so each beat replays its entrance. */}
      <main
        key={currentStepId}
        className="ftue-intro-screen flex-1 min-h-0 overflow-y-auto flex flex-col pt-6 mx-auto w-full max-w-md"
      >
        {/* ── Scatter ── */}
        {currentStepId === "scatter" && (
          <>
            <div className="mt-auto mb-1.5">
              <FtueMosaic mode="scatter" />
            </div>
            <h1 className="ftue-h1">Our stories are scattered across feeds.</h1>
            <p className="ftue-body mt-3.5">
              A clip on Instagram. A photo in someone&apos;s camera roll. A trip in 2011 buried in
              a group chat. Each one lands, gets a few likes, and slides away.
            </p>
            <p className="ftue-body mt-3.5">
              Nothing is connected to anything. None of it has a home.
            </p>
          </>
        )}

        {/* ── Weave ── */}
        {currentStepId === "weave" && (
          <>
            <div className="mt-auto mb-1.5">
              <FtueMosaic mode="woven" />
            </div>
            <Eyebrow accent>What we&apos;re building</Eyebrow>
            <h1 className="ftue-h1 mt-3">Linestry gives every piece a home.</h1>
            <p className="ftue-body mt-3.5">
              Each one lands on a <strong className="text-foreground font-medium">place</strong>, a{" "}
              <strong className="text-foreground font-medium">year</strong>, and the{" "}
              <strong className="text-foreground font-medium">people who were there</strong>
              {" — "}and you can see how it connects to everyone else&apos;s.
            </p>

            {stats.riders !== null && (
              <div className="mt-6">
                <BigNumber value={stats.riders} tone="violet" />
                <p className="mt-2 text-[14px] font-medium text-foreground leading-snug">
                  riders named in the stories so far.
                </p>
                <p className="mt-1 text-[12.5px] text-muted">
                  Most of them haven&apos;t claimed their own timeline yet.
                </p>
              </div>
            )}

            <div className="flex gap-2 mt-5">
              <StatTile value={stats.places} label="Mountains" tone="#14b8a6" />
              <StatTile value={stats.brands} label="Brands" tone="#06b6d4" />
              <StatTile value={stats.connections} label="Connections" tone="#8b5cf6" />
            </div>
          </>
        )}

        {/* ── Name ── */}
        {currentStepId === "name" && (
          <>
            <div className="mt-auto">
              {claimContext ? (
                <>
                  <div className="rounded-2xl border border-accent/40 bg-accent-tint px-4 py-3 text-sm text-accent-strong">
                    <span className="font-semibold">{claimContext.inviterName}</span> added you to
                    their linestry. Claim your spot to make it yours.
                  </div>
                  <h1 className="ftue-h1 mt-4">Claim your linestry.</h1>
                </>
              ) : (
                <>
                  <Eyebrow accent>Step 1 of 2</Eyebrow>
                  <h1 className="ftue-h1 mt-3">
                    You&apos;re joining a community weaving our real stories together.
                  </h1>
                  <p className="ftue-body mt-3.5">
                    Real names, real mountains, real days. That&apos;s what makes it worth keeping.
                  </p>
                </>
              )}
            </div>

            <div className="mt-7">
              <label htmlFor="ftue-name" className="block mb-2.5">
                <Eyebrow>What&apos;s your name?</Eyebrow>
              </label>
              <input
                id="ftue-name"
                autoFocus
                type="text"
                autoComplete="name"
                value={onboarding.display_name ?? ""}
                onChange={(e) => setOnboardingField("display_name", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canContinue()) next()
                }}
                placeholder="e.g. Alex Torres"
                className={fieldCls}
              />
              <p className="mt-2.5 text-[12.5px] text-muted">
                How riders will know you here. You can change it later.
              </p>
            </div>

            {stats.riders !== null && (
              <div className="mt-5">
                <Callout>
                  Right now{" "}
                  <b className="text-foreground font-semibold">
                    {stats.riders.toLocaleString()} riders
                  </b>{" "}
                  are named in other people&apos;s stories. Adding your name is how yours stops
                  being someone else&apos;s footnote.
                </Callout>
              </div>
            )}
          </>
        )}

        {/* ── Year ── */}
        {currentStepId === "year" && (
          <>
            <div className="mt-auto">
              <Eyebrow accent>Step 2 of 2</Eyebrow>
              <h1 className="ftue-h1 mt-3">
                {firstName
                  ? `Good to meet you, ${firstName}. What year did you get into snowboarding?`
                  : "What year did you get into snowboarding?"}
              </h1>
              <p className="ftue-body mt-3.5">
                Just the year you first strapped in. This is the anchor your whole timeline hangs
                off.
              </p>
            </div>

            <div className="mt-6">
              <input
                autoFocus
                type="number"
                inputMode="numeric"
                value={onboarding.start_year ?? ""}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10)
                  setOnboardingField("start_year", Number.isNaN(v) ? undefined : v)
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canContinue()) next()
                }}
                placeholder={String(new Date().getFullYear() - 10)}
                min={MIN_YEAR}
                max={new Date().getFullYear()}
                aria-label="The year you started snowboarding"
                className={cn(fieldCls, "text-center tabular-nums py-3.5")}
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 800,
                  fontSize: 34,
                  letterSpacing: "-0.02em",
                }}
              />
              <DecadeChips
                value={startYear}
                onPick={(y) => setOnboardingField("start_year", y)}
              />
              <p className="mt-2.5 text-[12.5px] text-muted">
                Close enough is fine. Nobody&apos;s checking your receipts.
              </p>
            </div>
          </>
        )}

        {/* ── Era reveal ── */}
        {currentStepId === "era" && era && eraCopy && (
          <>
            <div className="mt-auto">
              <Eyebrow accent>
                {firstName ? `${firstName}'s first season` : "Your first season"}
              </Eyebrow>
              <BigNumber value={startYear} grouped={false} className="mt-2.5" />
              {seasons !== null && (
                <p className="mt-2 text-[14px] font-medium text-foreground">
                  {seasons} {seasons === 1 ? "season" : "seasons"} on snow.
                </p>
              )}
            </div>

            <h2 className="ftue-h2 mt-7">{eraCopy.headline}</h2>
            <p className="ftue-body mt-3.5">{eraCopy.body}</p>

            {(stats.peers !== null || stats.stories !== null) && (
              <div className="flex gap-2 mt-6">
                <StatTile
                  value={stats.peers}
                  label={<>Riders started<br />that year</>}
                  tone="#8b5cf6"
                />
                <StatTile
                  value={stats.stories}
                  label={<>Stories from<br />your first season</>}
                  tone="#f59e0b"
                />
              </div>
            )}

            <div className="mt-5">
              <Callout>
                Your year isn&apos;t just a field on a form. It drops you into{" "}
                <b className="text-foreground font-semibold">{era.label}</b> — and connects you to
                everyone else who was there for it.
              </Callout>
            </div>
          </>
        )}

        {/* ── Welcome ── */}
        {currentStepId === "welcome" && (
          <>
            <div className="mt-auto">
              <Eyebrow accent>Woven</Eyebrow>
              <h1 className="ftue-h1 mt-3">
                Welcome to Linestry{firstName ? `, ${firstName}` : ""}.
              </h1>
            </div>

            <div className="mt-6">
              <SectionLabel>Here is the start of your timeline</SectionLabel>
            </div>

            {/* The Started Riding card. Everyone's timeline opens with this one:
                the real feed derives it from profiles.riding_since, so what is
                previewed here is what lands after signup. */}
            <div className="relative pl-6 mt-3.5">
              <span className="absolute left-[7px] top-1.5 bottom-4 w-0.5 rounded-full bg-gradient-to-b from-accent to-accent/10" />
              <div className="ftue-row-in relative" style={{ animationDelay: "0.15s" }}>
                <span className="absolute -left-6 top-4 w-4 h-4 rounded-full bg-background border-2 border-accent">
                  <span className="absolute inset-0.5 rounded-full bg-accent ftue-intro-pulse" />
                </span>
                <div
                  className="rounded-2xl border px-4 py-3.5"
                  style={{
                    borderColor: "rgba(59,130,246,0.5)",
                    background: "linear-gradient(150deg,#20242e,#1e1c1a 62%)",
                  }}
                >
                  <div className="text-[11px] font-semibold uppercase tracking-[0.11em] text-accent-strong">
                    {startYear}
                  </div>
                  <div
                    className="mt-1 text-[17px]"
                    style={{ fontFamily: "var(--font-display)", fontWeight: 800 }}
                  >
                    Started riding
                  </div>
                  <p className="mt-1.5 text-[12.5px] text-muted leading-snug">
                    The first season. Everything you add after this connects back to here.
                  </p>
                  {era && (
                    <span className="inline-block mt-2.5 rounded-full border border-accent/35 bg-accent-tint px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.07em] text-accent-strong">
                      {era.badge}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6">
              <SectionLabel>Here is what you can add</SectionLabel>
            </div>

            <div className="mt-3 space-y-2.5">
              <NextUpCard
                delay="0.42s"
                tint="#14b8a6"
                title="Places you've ridden"
                body="Home hill, road trips, that one week in Japan. Each one links you to every story that ever happened there."
              />
              <NextUpCard
                delay="0.54s"
                tint="#10b981"
                title="Boards you've ridden or own"
                body="Every model carries its own lineage — the year, the riders, the graphics. Yours joins it."
              />
              <NextUpCard
                delay="0.66s"
                tint="#8b5cf6"
                title="Stories and events you were part of"
                body="Contests, premieres, the day nobody photographed. Tag the people who were there and they get connected too."
              />
            </div>
          </>
        )}

        {/* ── Save ── */}
        {currentStepId === "save" && (
          <div className="mt-auto">
            <SaveStep firstName={firstName} startYear={startYear} ridersWaiting={stats.riders} />
          </div>
        )}

        {/* ── Footer ── */}
        <div className="mt-auto pt-6 flex flex-col gap-2.5">
          {currentStepId === "save" ? (
            <>
              <button
                onClick={back}
                className="self-center text-[13px] text-muted hover:text-foreground transition-colors"
              >
                ← Back to my timeline
              </button>
              {process.env.NODE_ENV === "development" && (
                <button
                  onClick={devBypass}
                  className="self-center rounded-lg border border-amber-900/50 bg-amber-950/20 px-3 py-2 text-xs text-amber-400 hover:bg-amber-950/40 transition-colors"
                >
                  Skip — dev only
                </button>
              )}
            </>
          ) : (
            <>
              <button
                onClick={back}
                className={cn(
                  "self-start text-[13px] text-muted hover:text-foreground transition-colors",
                  step === 0 && "invisible",
                )}
              >
                ← Back
              </button>
              <button
                onClick={next}
                disabled={!canContinue()}
                className={cn(
                  "w-full rounded-full px-6 py-4 text-[15px] font-semibold transition-colors",
                  canContinue()
                    ? "bg-accent text-white hover:bg-accent-strong"
                    : "bg-surface-active text-muted cursor-not-allowed",
                )}
              >
                {primaryLabel}
              </button>
              {currentStepId === "weave" && (
                <p className="text-center text-[11px] text-muted">
                  No account needed yet. Two questions.
                </p>
              )}
              {currentStepId === "welcome" && (
                <p className="text-center text-[11px] text-muted">
                  Nothing is saved until you do.
                </p>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}

// ─── Bits used only by this flow ─────────────────────────────────────────────

function NextUpCard({
  title,
  body,
  tint,
  delay,
}: {
  title: string
  body: string
  tint: string
  delay: string
}) {
  return (
    <div
      className="ftue-row-in relative rounded-2xl border border-dashed border-border-default px-4 py-3.5 pl-4"
      style={{ animationDelay: delay }}
    >
      <span
        className="absolute -left-px top-3.5 bottom-3.5 w-[2.5px] rounded-full"
        style={{ background: tint, opacity: 0.75 }}
      />
      <div className="text-[15px] font-semibold text-muted">
        <span className="text-accent-strong font-bold mr-1.5">+</span>
        {title}
      </div>
      <p className="mt-1.5 text-[12.5px] leading-snug text-muted/75">{body}</p>
    </div>
  )
}

/** Decade shortcuts. Typing four digits on a phone keypad is the single most
 *  annoying moment in the flow; a tap that lands mid-decade is close enough for
 *  a field the copy already says is approximate. */
function DecadeChips({
  value,
  onPick,
}: {
  value: number | null
  onPick: (year: number) => void
}) {
  const decades = useMemo(() => {
    const now = new Date().getFullYear()
    const out: { label: string; mid: number }[] = []
    for (let d = 1970; d <= Math.floor(now / 10) * 10; d += 10) {
      out.push({ label: `${d}s`, mid: Math.min(now, d + (d === 1970 ? 8 : 5)) })
    }
    return out
  }, [])

  return (
    <div className="flex flex-wrap gap-1.5 mt-3">
      {decades.map((d) => {
        const on = value !== null && Math.floor(value / 10) * 10 === Math.floor(d.mid / 10) * 10
        return (
          <button
            key={d.label}
            type="button"
            onClick={() => onPick(d.mid)}
            className={cn(
              "rounded-full border px-3.5 py-2 text-[12.5px] font-medium transition-colors",
              on
                ? "border-accent bg-accent-tint text-accent-strong"
                : "border-border-default bg-surface text-muted hover:text-foreground",
            )}
          >
            {d.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function numOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null
}

function isUsableYear(y: number | null): boolean {
  return y !== null && y >= MIN_YEAR && y <= new Date().getFullYear()
}
