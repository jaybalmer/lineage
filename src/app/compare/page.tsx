"use client"

import { useState, useMemo, useRef, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { CommunityLink } from "@/components/ui/community-link"
import { Nav } from "@/components/ui/nav"
import { useLineageStore, getAllClaims } from "@/store/lineage-store"
import { PEOPLE, CLAIMS, getEntityName, getPlaceById } from "@/lib/mock-data"
import { supabase } from "@/lib/supabase"
import { computeConnectionSummary } from "@/lib/connection-summary"
import { PREDICATE_ICONS, PREDICATE_LABELS, formatDateRange } from "@/lib/utils"
import { cn } from "@/lib/utils"
import { ComparePlayer } from "@/components/ui/compare-player"
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
      <div className="text-[10px] text-muted uppercase tracking-wider mb-1">{label}</div>
      {value ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-surface border border-border-default rounded-xl text-left hover:border-border-default transition-colors group"
        >
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-foreground shrink-0">
            {initials(value.display_name)}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground truncate">{value.display_name}</div>
            {value.birth_year && (
              <div className="text-[11px] text-muted">b. {value.birth_year}</div>
            )}
          </div>
          <span className="ml-auto text-[10px] text-muted group-hover:text-foreground shrink-0">
            change
          </span>
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="w-full px-3 py-2.5 bg-surface border border-dashed border-border-default rounded-xl text-sm text-muted text-left hover:border-border-default hover:text-foreground transition-colors"
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
                <div className="px-3 py-5 text-sm text-muted text-center">No riders found</div>
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
                      <div className="text-[11px] text-muted">
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

const EVENT_PREDICATES = new Set(["competed_at", "spectated_at", "organized_at"])

// ─── Compact claim row for side-by-side timeline ──────────────────────────────

function CompactClaimRow({
  claim,
  shared,
  resolveName,
  resolveEventDate,
}: {
  claim: Claim
  shared: boolean
  resolveName?: (id: string, type: string) => string
  resolveEventDate?: (id: string) => { start_date: string; end_date?: string } | null
}) {
  const icon = PREDICATE_ICONS[claim.predicate] ?? "●"
  const entityName = resolveName
    ? resolveName(claim.object_id, claim.object_type)
    : getEntityName(claim.object_id, claim.object_type)

  // For event claims pull the canonical date from the event record, not the claim
  const isEventClaim = EVENT_PREDICATES.has(claim.predicate)
  const eventRecord = isEventClaim && resolveEventDate
    ? resolveEventDate(claim.object_id)
    : null
  const years = formatDateRange(
    eventRecord?.start_date ?? claim.start_date,
    eventRecord?.end_date   ?? claim.end_date,
  )

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
        <div className={cn("text-xs truncate", shared ? "text-blue-200" : "text-muted")}>
          {entityName}
        </div>
        <div className="text-[10px] text-muted">{years}</div>
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
  resolveName,
  resolveEventDate,
}: {
  personA: Person
  personB: Person
  claimsA: Claim[]
  claimsB: Claim[]
  sharedEntityIds: Set<string>
  resolveName?: (id: string, type: string) => string
  resolveEventDate?: (id: string) => { start_date: string; end_date?: string } | null
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
            <CommunityLink
              href={`/riders/${p.id}`}
              className="text-sm font-semibold text-foreground hover:text-blue-300 transition-colors truncate"
            >
              {p.display_name}
            </CommunityLink>
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
              <div className="text-[10px] text-muted uppercase tracking-widest mb-1.5 font-mono">
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
                        resolveName={resolveName}
                        resolveEventDate={resolveEventDate}
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
                        resolveName={resolveName}
                        resolveEventDate={resolveEventDate}
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
    none: "bg-zinc-900 text-muted border-zinc-700/50",
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
          : "bg-surface-active text-muted border-border-default hover:border-border-default hover:text-foreground"
      )}
    >
      {copied ? "✓ Copied" : label}
    </button>
  )
}

// ─── Main Page (inner, reads search params) ───────────────────────────────────

function ComparePageInner() {
  const { sessionClaims, dbClaims, deletedClaimIds, claimOverrides, activePersonId, profileOverride, catalog } =
    useLineageStore()

  // Catalog-aware entity name resolver — checks Supabase-loaded catalog before
  // falling back to the static mock-data arrays. Fixes "Unknown" for DB entity IDs.
  const resolveName = (id: string, type: string): string => {
    switch (type) {
      case "place": {
        const p = catalog.places.find((x) => x.id === id)
        return p?.name ?? getEntityName(id, type)
      }
      case "board": {
        const b = catalog.boards.find((x) => x.id === id)
        return b ? `${b.brand} ${b.model} '${String(b.model_year).slice(2)}` : getEntityName(id, type)
      }
      case "org": {
        const o = catalog.orgs.find((x) => x.id === id)
        return o?.name ?? getEntityName(id, type)
      }
      case "event": {
        const e = catalog.events.find((x) => x.id === id)
        return e?.name ?? getEntityName(id, type)
      }
      default:
        return getEntityName(id, type)
    }
  }

  // Resolve canonical dates for an event — always from the event record, never from the claim
  const resolveEventDate = (id: string): { start_date: string; end_date?: string } | null => {
    const ev = catalog.events.find((e) => e.id === id)
    if (!ev) return null
    return ev.end_date ? { start_date: ev.start_date, end_date: ev.end_date }
                       : { start_date: ev.start_date }
  }
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
  // Also ensure the authenticated current user is always present even if their
  // profile isn't returned by the public query (privacy setting or timing).
  const mockIds = useMemo(() => new Set(PEOPLE.map((p) => p.id)), [])
  const allPeople = useMemo(() => {
    const base = [...PEOPLE, ...realProfiles.filter((p) => !mockIds.has(p.id))]
    if (activePersonId && !base.find((p) => p.id === activePersonId)) {
      base.push({
        id: activePersonId,
        display_name: profileOverride.display_name ?? "You",
        birth_year: profileOverride.birth_year,
        riding_since: profileOverride.riding_since,
        privacy_level: (profileOverride.privacy_level ?? "public") as "public" | "private" | "shared",
        bio: profileOverride.bio,
        links: profileOverride.links,
        home_resort_id: profileOverride.home_resort_id,
      })
    }
    return base
  }, [realProfiles, mockIds, activePersonId, profileOverride])

  const allClaims = useMemo(
    () => getAllClaims(sessionClaims, dbClaims, deletedClaimIds, claimOverrides, activePersonId),
    [sessionClaims, dbClaims, deletedClaimIds, claimOverrides, activePersonId]
  )

  // Build the current user's Person object — must preserve `activePersonId` as the id
  // so that claimsA correctly matches dbClaims (which use the UUID as subject_id).
  // allPeople only covers mock + public profiles, so auth users may not be in it.
  const baseCurrentUser = allPeople.find((p) => p.id === activePersonId)
  const currentUser: Person = baseCurrentUser
    ? { ...baseCurrentUser, ...profileOverride }
    : activePersonId
      ? {
          id: activePersonId,
          display_name: profileOverride.display_name ?? "You",
          birth_year: profileOverride.birth_year,
          riding_since: profileOverride.riding_since,
          privacy_level: (profileOverride.privacy_level ?? "public") as "public" | "private" | "shared",
          bio: profileOverride.bio,
          links: profileOverride.links,
          home_resort_id: profileOverride.home_resort_id,
        }
      : PEOPLE[0]
  const [personA, setPersonA] = useState<Person>(currentUser)

  // Pre-select Person B from ?b= query param
  const bParam = searchParams.get("b")
  const initialB = bParam ? (allPeople.find((p) => p.id === bParam) ?? null) : null
  const [personB, setPersonB] = useState<Person | null>(initialB)
  const [playingCompare, setPlayingCompare] = useState(false)

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
    // Mock riders' claims live in the static CLAIMS array, not in the store
    if (mockIds.has(personB.id)) return CLAIMS.filter((c) => c.subject_id === personB.id)
    return personBDbClaims
  }, [personB, personBDbClaims, mockIds])

  const summary = useMemo(
    () =>
      personB
        ? computeConnectionSummary(personA, personB, claimsA, claimsB, resolveName)
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [personA, personB, claimsA, claimsB]
  )

  const sharedEntityIds = useMemo(
    () => new Set(summary?.facts.map((f) => f.entityId) ?? []),
    [summary]
  )

  return (
    <div className="min-h-screen bg-background text-foreground">
      {playingCompare && personB && (
        <ComparePlayer
          personA={personA}
          personB={personB}
          claimsA={claimsA}
          claimsB={claimsB}
          onClose={() => setPlayingCompare(false)}
        />
      )}
      <Nav />

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-foreground">Compare riders</h1>
          <p className="text-sm text-muted mt-0.5">
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
          <div className="text-muted font-light text-xl mb-2.5 shrink-0">×</div>
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
            <div className="text-sm text-muted">Select a second rider to see their overlap</div>
          </div>
        )}

        {/* Summary + side-by-side */}
        {personB && summary && (
          <div className="space-y-6">
            {/* Connection Summary Card */}
            <div className="border border-border-default rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border-default flex items-center gap-3">
                <StrengthBadge strength={summary.strength} score={summary.score} />
                <button
                  onClick={() => setPlayingCompare(true)}
                  className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-background text-xs font-semibold hover:opacity-80 transition-opacity shrink-0"
                >
                  <span className="text-[10px]">▶</span>
                  <span>Play</span>
                </button>
              </div>

              <div className="px-5 py-4">
                <h2 className="text-base font-semibold text-foreground mb-3 leading-snug">
                  {summary.headline}
                </h2>

                {summary.facts.length === 0 ? (
                  <div className="py-4 text-sm text-muted">
                    No timeline overlaps found yet.{" "}
                    <span className="text-muted">
                      Invite {personB.display_name} to add more of their history.
                    </span>
                  </div>
                ) : (
                  <ul className="space-y-1.5 mb-4">
                    {summary.bullets.slice(0, 7).map((bullet, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-blue-500 mt-0.5 shrink-0">•</span>
                        <span className="text-muted">{bullet}</span>
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
                  <div className="text-xs text-muted">
                    <span className="text-muted">{personB.display_name}</span> hasn&apos;t
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
              <div className="text-xs text-muted uppercase tracking-wider mb-4 font-mono">
                Timeline comparison
              </div>
              {claimsA.length === 0 && claimsB.length === 0 ? (
                <div className="text-sm text-muted text-center py-6">
                  No timeline entries found for either rider
                </div>
              ) : (
                <SideBySideTimeline
                  personA={personA}
                  personB={personB}
                  claimsA={claimsA}
                  claimsB={claimsB}
                  sharedEntityIds={sharedEntityIds}
                  resolveName={resolveName}
                  resolveEventDate={resolveEventDate}
                />
              )}
            </div>

            {/* Overlap legend */}
            {summary.facts.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted">
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
