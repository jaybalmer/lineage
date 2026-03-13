"use client"

import { useState, useMemo, useRef, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Nav } from "@/components/ui/nav"
import { useLineageStore, getAllClaims } from "@/store/lineage-store"
import { PEOPLE, getEntityName, getPlaceById } from "@/lib/mock-data"
import { supabase } from "@/lib/supabase"
import { computeConnectionSummary } from "@/lib/connection-summary"
import { PREDICATE_ICONS, PREDICATE_LABELS, formatDateRange } from "@/lib/utils"
import { cn } from "@/lib/utils"
import type { Person, Claim } from "@/types"

// ─── Person Picker ────────────────────────────────────────────────────────────

function PersonPicker({
  value,
  onChange,
  label,
  excludeId,
  allPeople,
}: {
  value: Person | null
  onChange: (p: Person) => void
  label: string
  excludeId?: string
  allPeople: Person[]
}) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => {
    const q = query.toLowerCase()
    return allPeople.filter(
      (p) =>
        p.id !== excludeId &&
        (q === "" || p.display_name.toLowerCase().includes(q))
    )
  }, [query, excludeId, allPeople])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  const initials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase()

  return (
    <div className="relative flex-1 min-w-0">
      <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">{label}</div>
      {value ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-surface border border-border-default rounded-xl text-left hover:border-zinc-600 transition-colors group"
        >
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-foreground shrink-0">
            {initials(value.display_name)}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground truncate">{value.display_name}</div>
            {value.birth_year && (
              <div className="text-[11px] text-zinc-500">b. {value.birth_year}</div>
            )}
          </div>
          <span className="ml-auto text-[10px] text-zinc-600 group-hover:text-zinc-400 shrink-0">
            change
          </span>
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="w-full px-3 py-2.5 bg-surface border border-dashed border-border-default rounded-xl text-sm text-zinc-600 text-left hover:border-zinc-500 hover:text-zinc-400 transition-colors"
        >
          Search for a rider…
        </button>
      )}

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-surface-hover border border-border-default rounded-xl shadow-2xl overflow-hidden">
            <div className="p-2.5 border-b border-border-default">
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search riders…"
                className="w-full bg-transparent text-sm text-foreground placeholder-zinc-600 outline-none"
              />
            </div>
            <div className="max-h-56 overflow-y-auto">
              {results.length === 0 ? (
                <div className="px-3 py-5 text-sm text-zinc-600 text-center">No riders found</div>
              ) : (
                results.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      onChange(p)
                      setOpen(false)
                      setQuery("")
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-surface-hover transition-colors text-left"
                  >
                    <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-foreground shrink-0">
                      {initials(p.display_name)}
                    </div>
                    <div>
                      <div className="text-sm text-foreground">{p.display_name}</div>
                      <div className="text-[11px] text-zinc-600">
                        {p.birth_year ? `b. ${p.birth_year}` : ""}
                        {p.home_resort_id
                          ? ` · ${getPlaceById(p.home_resort_id)?.name ?? ""}`
                          : ""}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Compact claim row for side-by-side timeline ──────────────────────────────

function CompactClaimRow({
  claim,
  shared,
}: {
  claim: Claim
  shared: boolean
}) {
  const icon = PREDICATE_ICONS[claim.predicate] ?? "●"
  const entityName = getEntityName(claim.object_id, claim.object_type)
  const years = formatDateRange(claim.start_date, claim.end_date)

  return (
    <div
      className={cn(
        "flex items-start gap-1.5 px-2 py-1.5 rounded-lg text-left",
        shared
          ? "bg-blue-950/40 border border-blue-700/30"
          : "bg-surface border border-transparent"
      )}
    >
      <span className="text-xs mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className={cn("text-xs truncate", shared ? "text-blue-200" : "text-zinc-300")}>
          {entityName}
        </div>
        <div className="text-[10px] text-zinc-600">{years}</div>
      </div>
      {shared && <span className="text-[8px] text-blue-500 shrink-0 mt-1">●</span>}
    </div>
  )
}

// ─── Side-by-side timeline columns ───────────────────────────────────────────

function SideBySideTimeline({
  personA,
  personB,
  claimsA,
  claimsB,
  sharedEntityIds,
}: {
  personA: Person
  personB: Person
  claimsA: Claim[]
  claimsB: Claim[]
  sharedEntityIds: Set<string>
}) {
  function getDecade(c: Claim) {
    const y = parseInt((c.start_date ?? "").slice(0, 4))
    return isNaN(y) ? 2020 : Math.floor(y / 10) * 10
  }

  function groupByDecade(claims: Claim[]) {
    const map = new Map<number, Claim[]>()
    for (const c of claims) {
      const d = getDecade(c)
      if (!map.has(d)) map.set(d, [])
      map.get(d)!.push(c)
    }
    // Sort each group by start date desc
    for (const [, v] of map) {
      v.sort((a, b) => (b.start_date ?? "").localeCompare(a.start_date ?? ""))
    }
    return map
  }

  const groupA = groupByDecade(claimsA)
  const groupB = groupByDecade(claimsB)

  const allDecades = Array.from(
    new Set([...groupA.keys(), ...groupB.keys()])
  ).sort((a, b) => b - a)

  const initials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase()

  return (
    <div>
      {/* Column headers */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {[personA, personB].map((p) => (
          <div key={p.id} className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-foreground shrink-0">
              {initials(p.display_name)}
            </div>
            <Link
              href={`/riders/${p.id}`}
              className="text-sm font-semibold text-foreground hover:text-blue-300 transition-colors truncate"
            >
              {p.display_name}
            </Link>
          </div>
        ))}
      </div>

      {/* Decade rows */}
      <div className="space-y-5">
        {allDecades.map((decade) => {
          const rowA = groupA.get(decade) ?? []
          const rowB = groupB.get(decade) ?? []
          if (rowA.length === 0 && rowB.length === 0) return null
          return (
            <div key={decade}>
              <div className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1.5 font-mono">
                {decade}s
              </div>
              <div className="grid grid-cols-2 gap-4">
                {/* Column A */}
                <div className="space-y-1">
                  {rowA.length === 0 ? (
                    <div className="h-6" />
                  ) : (
                    rowA.map((c) => (
                      <CompactClaimRow
                        key={c.id}
                        claim={c}
                        shared={sharedEntityIds.has(c.object_id)}
                      />
                    ))
                  )}
                </div>
                {/* Column B */}
                <div className="space-y-1">
                  {rowB.length === 0 ? (
                    <div className="h-6" />
                  ) : (
                    rowB.map((c) => (
                      <CompactClaimRow
                        key={c.id}
                        claim={c}
                        shared={sharedEntityIds.has(c.object_id)}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Strength badge ───────────────────────────────────────────────────────────

function StrengthBadge({ strength, score }: { strength: string; score: number }) {
  const styles = {
    strong: "bg-emerald-950 text-emerald-300 border-emerald-800/50",
    medium: "bg-blue-950 text-blue-300 border-blue-800/50",
    light: "bg-amber-950 text-amber-300 border-amber-800/50",
    none: "bg-zinc-900 text-zinc-400 border-zinc-700/50",
  }
  const dots = {
    strong: "●●●",
    medium: "●●○",
    light: "●○○",
    none: "○○○",
  }
  const s = strength as keyof typeof styles
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border font-medium",
        styles[s] ?? styles.none
      )}
    >
      <span className="tracking-widest text-[9px]">{dots[s] ?? dots.none}</span>
      <span className="uppercase tracking-wide">{strength}</span>
      <span className="text-[10px] opacity-60">· {score} pts</span>
    </span>
  )
}

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
    }
  }

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
        copied
          ? "bg-emerald-950 text-emerald-300 border-emerald-700"
          : "bg-surface-active text-zinc-300 border-border-default hover:border-zinc-500 hover:text-foreground"
      )}
    >
      {copied ? "✓ Copied" : label}
    </button>
  )
}

// ─── Main Page (inner, reads search params) ───────────────────────────────────

function ComparePageInner() {
  const { sessionClaims, dbClaims, deletedClaimIds, claimOverrides, activePersonId, profileOverride } =
    useLineageStore()
  const searchParams = useSearchParams()

  // Real profiles from Supabase
  const [realProfiles, setRealProfiles] = useState<Person[]>([])
  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, display_name, birth_year, riding_since, privacy_level, bio, home_resort_id")
      .eq("privacy_level", "public")
      .then(({ data }) => {
        if (data) {
          setRealProfiles(data.map((p) => ({
            id: p.id,
            display_name: p.display_name,
            birth_year: p.birth_year ?? undefined,
            riding_since: p.riding_since ?? undefined,
            privacy_level: p.privacy_level as "public",
            bio: p.bio ?? undefined,
            home_resort_id: p.home_resort_id ?? undefined,
          }) as Person))
        }
      })
  }, [])

  // Merge mock people + real profiles (deduplicate by id)
  const mockIds = useMemo(() => new Set(PEOPLE.map((p) => p.id)), [])
  const allPeople = useMemo(
    () => [...PEOPLE, ...realProfiles.filter((p) => !mockIds.has(p.id))],
    [realProfiles, mockIds]
  )

  const allClaims = useMemo(
    () => getAllClaims(sessionClaims, dbClaims, deletedClaimIds, claimOverrides, activePersonId),
    [sessionClaims, dbClaims, deletedClaimIds, claimOverrides, activePersonId]
  )

  const baseCurrentUser = allPeople.find((p) => p.id === activePersonId) ?? PEOPLE[0]
  const currentUser = { ...baseCurrentUser, ...profileOverride }
  const [personA, setPersonA] = useState<Person>(currentUser)

  // Pre-select Person B from ?b= query param
  const bParam = searchParams.get("b")
  const initialB = bParam ? (allPeople.find((p) => p.id === bParam) ?? null) : null
  const [personB, setPersonB] = useState<Person | null>(initialB)

  // DB claims for a real Person B
  const [personBDbClaims, setPersonBDbClaims] = useState<Claim[]>([])
  useEffect(() => {
    if (!personB || mockIds.has(personB.id)) {
      setPersonBDbClaims([])
      return
    }
    supabase
      .from("claims")
      .select("*")
      .eq("subject_id", personB.id)
      .eq("visibility", "public")
      .then(({ data }) => setPersonBDbClaims((data ?? []) as Claim[]))
  }, [personB?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const claimsA = useMemo(
    () => allClaims.filter((c) => c.subject_id === personA.id),
    [allClaims, personA.id]
  )
  const claimsB = useMemo(() => {
    if (!personB) return []
    if (mockIds.has(personB.id)) return allClaims.filter((c) => c.subject_id === personB.id)
    return personBDbClaims
  }, [allClaims, personB, personBDbClaims, mockIds])

  const summary = useMemo(
    () =>
      personB
        ? computeConnectionSummary(personA, personB, claimsA, claimsB)
        : null,
    [personA, personB, claimsA, claimsB]
  )

  const sharedEntityIds = useMemo(
    () => new Set(summary?.facts.map((f) => f.entityId) ?? []),
    [summary]
  )

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-foreground">Compare riders</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Find overlapping history between two riders
          </p>
        </div>

        {/* Person pickers */}
        <div className="flex items-end gap-3 mb-6">
          <PersonPicker
            label="Rider A"
            value={personA}
            onChange={setPersonA}
            excludeId={personB?.id}
            allPeople={allPeople}
          />
          <div className="text-zinc-600 font-light text-xl mb-2.5 shrink-0">×</div>
          <PersonPicker
            label="Rider B"
            value={personB}
            onChange={setPersonB}
            excludeId={personA.id}
            allPeople={allPeople}
          />
        </div>

        {/* No person B selected (and no ?b= param) */}
        {!personB && (
          <div className="border border-dashed border-border-default rounded-xl py-12 text-center">
            <div className="text-3xl mb-2">⬡</div>
            <div className="text-sm text-zinc-500">Select a second rider to see their overlap</div>
          </div>
        )}

        {/* Summary + side-by-side */}
        {personB && summary && (
          <div className="space-y-6">
            {/* Connection Summary Card */}
            <div className="border border-border-default rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border-default flex items-center gap-3">
                <StrengthBadge strength={summary.strength} score={summary.score} />
              </div>

              <div className="px-5 py-4">
                <h2 className="text-base font-semibold text-foreground mb-3 leading-snug">
                  {summary.headline}
                </h2>

                {summary.facts.length === 0 ? (
                  <div className="py-4 text-sm text-zinc-500">
                    No timeline overlaps found yet.{" "}
                    <span className="text-zinc-400">
                      Invite {personB.display_name} to add more of their history.
                    </span>
                  </div>
                ) : (
                  <ul className="space-y-1.5 mb-4">
                    {summary.bullets.slice(0, 7).map((bullet, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-blue-500 mt-0.5 shrink-0">•</span>
                        <span className="text-zinc-300">{bullet}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Copy buttons */}
                {summary.facts.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <CopyButton text={summary.longSummaryText} label="Copy summary" />
                    <CopyButton text={summary.shortCardText} label="Copy short version" />
                  </div>
                )}
              </div>

              {/* Invite prompt — hide if Person B is a real user with claims */}
              {(mockIds.has(personB.id) || personBDbClaims.length === 0) && (
                <div className="px-5 py-3 bg-surface border-t border-border-default flex items-center justify-between">
                  <div className="text-xs text-zinc-500">
                    <span className="text-zinc-400">{personB.display_name}</span> hasn&apos;t
                    confirmed their side yet
                  </div>
                  <CopyButton
                    text={`Hey ${personB.display_name}, check out our snowboarding connection on Lineage — ${personA.display_name} + ${personB.display_name}: ${summary.headline}\n\nAdd your timeline at lineage.app/compare`}
                    label={`✉ Invite ${personB.display_name.split(" ")[0]}`}
                  />
                </div>
              )}
            </div>

            {/* Side-by-side timeline */}
            <div className="border border-border-default rounded-xl p-5">
              <div className="text-xs text-zinc-600 uppercase tracking-wider mb-4 font-mono">
                Timeline comparison
              </div>
              {claimsA.length === 0 && claimsB.length === 0 ? (
                <div className="text-sm text-zinc-600 text-center py-6">
                  No timeline entries found for either rider
                </div>
              ) : (
                <SideBySideTimeline
                  personA={personA}
                  personB={personB}
                  claimsA={claimsA}
                  claimsB={claimsB}
                  sharedEntityIds={sharedEntityIds}
                />
              )}
            </div>

            {/* Overlap legend */}
            {summary.facts.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-zinc-600">
                <div className="w-3 h-3 rounded bg-blue-950/60 border border-blue-700/40" />
                <span>Shared entries highlighted in both timelines</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Export wrapped in Suspense (required for useSearchParams) ────────────────

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <ComparePageInner />
    </Suspense>
  )
}
