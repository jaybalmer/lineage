"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useLineageStore, isAuthUser } from "@/store/lineage-store"

// Daily token progress chip (token-game-feel brief D2/D4). A compact, self
// contained card: how much you have earned today against the daily content
// cap, whether the daily +1 has landed, a visit streak, and an expandable
// "how earning works" table. Reused on /account/membership and the owner My
// Timeline, for ALL tiers including free (the chip never gates on tier).
//
// It reads from GET /api/me/tokens-today on mount and re-fetches whenever
// tokenEarnTick changes, so adding a claim/story/connection/entity updates the
// meter live without a reload.

interface TokensToday {
  content_earned_today: number
  cap: number
  visit_awarded_today: boolean
  total_earned_today: number
  visit_streak: number
  by_source?: Record<string, number>
}

// token_events.source -> friendly label, ordered, for the "earned today, by
// type" breakdown. Only the day-to-day earning sources (membership/admin grants
// are not "earned" through activity, so they are intentionally not listed).
const EARNED_TODAY_LABELS: { source: string; label: string }[] = [
  { source: "contribution_entry",      label: "Timeline entries" },
  { source: "contribution_media",      label: "Story photos" },
  { source: "contribution_source",     label: "Sources cited" },
  { source: "contribution_connection", label: "Story connections" },
  { source: "contribution_entity",     label: "Catalog adds" },
  { source: "daily_visit",             label: "Showing up" },
  { source: "contribution_onboard",    label: "Riders onboarded" },
]

// Canonical earning table (cory-token-questions-answers.md §"The earning table
// as it actually runs today", June 21 2026). Verification is deliberately
// omitted: those token types exist in code but nothing awards them yet. These
// values are copy only; the server is the source of truth for every grant.
const EARN_ROWS: { label: string; value: string }[] = [
  { label: "Add a timeline entry", value: "+1" },
  { label: "Add a story", value: "+1" },
  { label: "Story with a photo", value: "+1" },
  { label: "Cite a source (a link or reference)", value: "+2" },
  { label: "Connect a rider, place, or event to a story", value: "+1" },
  { label: "Add a place, board, brand, or event", value: "+2" },
  { label: "Show up each day", value: "+1" },
  { label: "Onboard a rider who claims their profile", value: "+5" },
]

export function DailyTokenChip({ className = "" }: { className?: string }) {
  const activePersonId = useLineageStore((s) => s.activePersonId)
  const tokenEarnTick = useLineageStore((s) => s.tokenEarnTick)
  const [data, setData] = useState<TokensToday | null>(null)
  const [showEarn, setShowEarn] = useState(false)

  useEffect(() => {
    if (!isAuthUser(activePersonId)) return
    let alive = true
    fetch("/api/me/tokens-today")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d && typeof d.cap === "number") setData(d as TokensToday)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [activePersonId, tokenEarnTick])

  if (!isAuthUser(activePersonId) || !data) return null

  const earned = data.content_earned_today
  const cap = data.cap
  const maxed = cap > 0 && earned >= cap
  const pct = cap > 0 ? Math.min(100, Math.round((earned / cap) * 100)) : 0
  const streak = data.visit_streak

  const statusLine = maxed
    ? "Daily earning maxed out. Come back tomorrow for more."
    : data.visit_awarded_today
      ? "Showing up today: +1 earned"
      : "Visit each day for +1"

  const bySource = data.by_source ?? {}
  const earnedRows = EARNED_TODAY_LABELS.filter((r) => (bySource[r.source] ?? 0) > 0)

  return (
    <div
      className={`bg-surface border border-border-default rounded-2xl p-5 ${className}`}
      style={{ fontFamily: "var(--font-body)" }}
    >
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-foreground"
          style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1, fontFamily: "var(--font-display)" }}
        >
          EARNED TODAY
        </span>
        <span className="text-foreground font-bold tabular-nums" style={{ fontSize: 13 }}>
          {earned} / {cap}
        </span>
      </div>

      {/* Progress toward the daily content cap. Turns emerald once the cap is hit
          so a full bar reads as "goal reached", not "blocked". */}
      <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: "var(--surface-active)" }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: maxed ? "#10b981" : "#3b82f6" }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
        <span className="text-muted" style={{ fontSize: 10, lineHeight: 1.5 }}>{statusLine}</span>
        {streak >= 2 && (
          <span className="shrink-0 font-bold" style={{ fontSize: 10, color: "#f59e0b" }}>
            🔥 {streak} day streak
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowEarn((v) => !v)}
        className="mt-3 text-muted hover:text-foreground transition-colors"
        style={{ fontSize: 10, background: "none", border: "none", cursor: "pointer", padding: 0 }}
      >
        Today&apos;s breakdown {showEarn ? "▾" : "▸"}
      </button>

      {showEarn && (
        <div className="mt-2 space-y-2">
          {/* What you actually earned today, by type (the daily-visit +1 shows
              here even though it sits outside the content cap above). */}
          <div className="space-y-1">
            <div className="text-muted" style={{ fontSize: 9, letterSpacing: 1, fontWeight: 700 }}>TODAY</div>
            {earnedRows.length > 0 ? (
              earnedRows.map((r) => (
                <div key={r.source} className="flex items-center justify-between gap-3">
                  <span className="text-foreground" style={{ fontSize: 10 }}>{r.label}</span>
                  <span className="tabular-nums shrink-0" style={{ fontSize: 10, fontWeight: 600, color: "#10b981" }}>
                    +{bySource[r.source]}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-muted" style={{ fontSize: 10 }}>Nothing earned yet today. Add an entry or story to start.</p>
            )}
          </div>

          {/* Canonical earning rules (reference). */}
          <div className="border-t border-border-default pt-2 space-y-1">
            <div className="text-muted" style={{ fontSize: 9, letterSpacing: 1, fontWeight: 700 }}>HOW EARNING WORKS</div>
            {EARN_ROWS.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3">
                <span className="text-muted" style={{ fontSize: 10 }}>{row.label}</span>
                <span className="text-foreground tabular-nums shrink-0" style={{ fontSize: 10, fontWeight: 600 }}>
                  {row.value}
                </span>
              </div>
            ))}
            <p className="text-muted pt-1" style={{ fontSize: 9, lineHeight: 1.5 }}>
              Up to {cap} a day from entries, stories, sources, connections, and catalog adds.
              Showing up and onboarding sit outside the cap.{" "}
              <Link href="/equity" className="underline hover:text-foreground">How tokens become equity →</Link>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
