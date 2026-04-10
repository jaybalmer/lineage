"use client"

import { useMemo } from "react"
import { computeConnectionSummary } from "@/lib/connection-summary"
import { FeedView } from "@/components/feed/feed-view"
import { cn } from "@/lib/utils"
import type { Person, Claim } from "@/types"

interface ConnectionThreadProps {
  personA: Person
  personB: Person
  claimsA: Claim[]
  claimsB: Claim[]
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function StrengthBadge({ strength, score }: { strength: string; score: number }) {
  const styles: Record<string, string> = {
    strong: "bg-emerald-950 text-emerald-300 border-emerald-800/50",
    medium: "bg-blue-950 text-blue-300 border-blue-800/50",
    light: "bg-amber-950 text-amber-300 border-amber-800/50",
    none: "bg-zinc-900 text-muted border-zinc-700/50",
  }
  const dots: Record<string, string> = {
    strong: "●●●",
    medium: "●●○",
    light: "●○○",
    none: "○○○",
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border font-medium",
        styles[strength] ?? styles.none
      )}
    >
      <span className="tracking-widest text-[9px]">{dots[strength] ?? dots.none}</span>
      <span className="uppercase tracking-wide">{strength}</span>
      <span className="text-[10px] opacity-60">· {score} pts</span>
    </span>
  )
}

export function ConnectionThread({ personA, personB, claimsA, claimsB }: ConnectionThreadProps) {
  const summary = useMemo(
    () => computeConnectionSummary(personA, personB, claimsA, claimsB),
    [personA, personB, claimsA, claimsB]
  )

  return (
    <div>
      {/* Connection header */}
      <div className="bg-surface border border-border-default rounded-xl p-5 mb-6">
        {/* Avatar pair + strength */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center shrink-0">
            <div className="w-10 h-10 rounded-full bg-[#1C1917] flex items-center justify-center text-sm font-bold text-foreground">
              {initials(personA.display_name)}
            </div>
            <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center text-sm font-bold text-foreground -ml-3 border-2 border-border-default">
              {initials(personB.display_name)}
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground leading-snug">
              {personA.display_name} + {personB.display_name}
            </div>
            <div className="mt-1.5">
              <StrengthBadge strength={summary.strength} score={summary.score} />
            </div>
          </div>
        </div>

        {/* Headline */}
        <p className="text-sm text-muted leading-relaxed">{summary.headline}</p>
      </div>

      {/* Shared moments */}
      {summary.facts.length > 0 ? (
        <div className="mb-8">
          <div className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">
            Shared moments
          </div>
          <div className="space-y-2">
            {summary.facts.map((fact, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-4 py-3 bg-blue-950/20 border border-blue-900/40 rounded-xl"
              >
                <div>
                  <div className="text-sm text-blue-200">{fact.label}</div>
                  <div className="text-xs text-blue-400/70 mt-0.5">{fact.detail}</div>
                </div>
                <div className="text-xs text-blue-600 font-semibold">+{fact.score}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-8 py-8 text-center border border-dashed border-border-default rounded-xl">
          <div className="text-sm text-muted">No documented overlaps yet</div>
          <div className="text-xs text-muted mt-1">
            Add more history to both profiles to uncover shared moments
          </div>
        </div>
      )}

      {/* Other rider's feed */}
      <div>
        <div className="text-xs font-semibold text-muted uppercase tracking-widest mb-4 flex items-center gap-3">
          <span>{personB.display_name}&apos;s history</span>
          <div className="flex-1 h-px bg-surface-active" />
        </div>
        <FeedView claims={claimsB} personName={personB.display_name} isOwn={false} />
      </div>
    </div>
  )
}
