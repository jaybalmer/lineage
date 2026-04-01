"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useLineageStore } from "@/store/lineage-store"
import { cn } from "@/lib/utils"
import { AddEntityModal } from "@/components/ui/add-entity-modal"
import { supabase } from "@/lib/supabase"
import type { Board, Event, Place, Predicate } from "@/types"

// ─── Steps ───────────────────────────────────────────────────────────────────

const STEPS = [
  "Welcome",
  "About you",
  "Your first season",
  "Your boards",
  "Your events",
  "Create account",
]

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex gap-1 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-0.5 flex-1 rounded-full transition-all duration-300",
            i < step ? "bg-blue-500" : i === step ? "bg-blue-400" : "bg-border-default"
          )}
        />
      ))}
    </div>
  )
}

// ─── Shared input style ───────────────────────────────────────────────────────

const inputCls =
  "w-full bg-surface border border-border-default rounded-lg px-4 py-3 text-sm text-foreground placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition-colors"

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({
  label,
  optional,
  children,
}: {
  label: string
  optional?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted uppercase tracking-widest mb-2 block">
        {label}
        {optional && (
          <span className="normal-case font-normal ml-1.5 text-muted/60">optional</span>
        )}
      </label>
      {children}
    </div>
  )
}

// ─── Single-pick search select ────────────────────────────────────────────────

function SearchSelect({
  items,
  value,
  onChange,
  placeholder,
  getLabel,
  getId,
  addEntityType,
  addEntityLabel,
}: {
  items: { id: string; [key: string]: unknown }[]
  value?: string
  onChange: (id: string) => void
  placeholder: string
  getLabel: (item: { id: string; [key: string]: unknown }) => string
  getId: (item: { id: string; [key: string]: unknown }) => string
  addEntityType?: "place" | "board" | "org"
  addEntityLabel?: string
}) {
  const [query, setQuery] = useState("")
  const [showModal, setShowModal] = useState(false)
  const filtered = items.filter((i) =>
    getLabel(i).toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div>
      {showModal && addEntityType && (
        <AddEntityModal
          entityType={addEntityType}
          initialName={query}
          onClose={() => setShowModal(false)}
          onAdded={(id) => {
            onChange(id)
            setShowModal(false)
          }}
        />
      )}
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className={inputCls}
      />
      <div className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-border-default divide-y divide-[#1e1e1e]">
        {filtered.slice(0, 10).map((item) => (
          <button
            key={getId(item)}
            onClick={() => { onChange(getId(item)); setQuery("") }}
            className={cn(
              "w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2",
              value === getId(item)
                ? "bg-blue-950 text-blue-200"
                : "text-muted hover:bg-surface-hover"
            )}
          >
            <span className="flex-1">{getLabel(item)}</span>
          </button>
        ))}
        {addEntityType && query.trim().length > 0 && (
          <button
            onClick={() => setShowModal(true)}
            className="w-full text-left px-4 py-2.5 text-sm text-blue-400 hover:bg-surface-hover transition-colors flex items-center gap-1.5"
          >
            <span className="font-bold">+</span>
            Add &ldquo;{query.trim()}&rdquo; as a new {addEntityLabel ?? addEntityType}
          </button>
        )}
        {filtered.length === 0 && !query.trim() && (
          <div className="px-4 py-2.5 text-sm text-muted">Start typing to search</div>
        )}
      </div>
      {value && (
        <button
          onClick={() => onChange("")}
          className="mt-1.5 text-xs text-muted hover:text-foreground transition-colors"
        >
          × Clear selection
        </button>
      )}
    </div>
  )
}

// ─── Board multi-picker ───────────────────────────────────────────────────────

function BoardRow({
  board,
  selected,
  onToggle,
}: {
  board: Board
  selected: boolean
  onToggle: (id: string) => void
}) {
  return (
    <button
      onClick={() => onToggle(board.id)}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors",
        selected ? "bg-blue-950/30" : "hover:bg-surface-hover"
      )}
    >
      <span
        className={cn(
          "w-5 h-5 rounded-full border flex items-center justify-center text-[10px] shrink-0 transition-all",
          selected
            ? "bg-blue-600 border-blue-500 text-white"
            : "border-border-default text-transparent"
        )}
      >
        ✓
      </span>
      <span className="flex-1 truncate">
        <span className={cn("font-medium", selected ? "text-blue-200" : "text-foreground/80")}>
          {board.brand}
        </span>{" "}
        <span className={selected ? "text-blue-300" : "text-muted"}>{board.model}</span>
      </span>
      <span className="text-xs text-muted shrink-0">
        &apos;{String(board.model_year).slice(2)}
      </span>
    </button>
  )
}

function BoardPicker({
  selectedIds,
  onToggle,
  boards,
}: {
  selectedIds: string[]
  onToggle: (id: string) => void
  boards: Board[]
}) {
  const [query, setQuery] = useState("")
  const selected = useMemo(() => new Set(selectedIds), [selectedIds])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return boards
      .filter(
        (b) =>
          !q ||
          `${b.brand} ${b.model}`.toLowerCase().includes(q) ||
          String(b.model_year).includes(q)
      )
      .sort((a, b) => b.model_year - a.model_year)
  }, [query, boards])

  const selectedBoards = boards.filter((b) => selected.has(b.id))
  const unselected = filtered.filter((b) => !selected.has(b.id))

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by brand or model…"
        className={inputCls}
      />

      <div className="max-h-80 overflow-y-auto rounded-lg border border-border-default divide-y divide-[#1e1e1e]">
        {/* Selected pinned at top */}
        {selectedBoards.length > 0 && (
          <>
            {selectedBoards.map((b) => (
              <BoardRow key={b.id} board={b} selected onToggle={onToggle} />
            ))}
            {unselected.length > 0 && (
              <div className="px-4 py-1 text-[10px] text-muted uppercase tracking-widest bg-surface-active">
                All boards
              </div>
            )}
          </>
        )}

        {unselected.slice(0, 40).map((b) => (
          <BoardRow key={b.id} board={b} selected={false} onToggle={onToggle} />
        ))}

        {!query && unselected.length > 40 && (
          <div className="px-4 py-2 text-xs text-center text-muted">
            {unselected.length - 40} more — search to narrow down
          </div>
        )}

        {query && filtered.length === 0 && (
          <div className="px-4 py-3 text-sm text-muted">No boards found</div>
        )}
      </div>

      {selectedIds.length > 0 && (
        <p className="text-xs text-muted">
          {selectedIds.length} board{selectedIds.length !== 1 ? "s" : ""} selected
        </p>
      )}
    </div>
  )
}

// ─── Event multi-picker ───────────────────────────────────────────────────────

function EventRow({
  event,
  place,
  selected,
  onToggle,
}: {
  event: Event
  place?: Place
  selected: boolean
  onToggle: (id: string) => void
}) {
  return (
    <button
      onClick={() => onToggle(event.id)}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors",
        selected ? "bg-blue-950/30" : "hover:bg-surface-hover"
      )}
    >
      <span
        className={cn(
          "w-5 h-5 rounded-full border flex items-center justify-center text-[10px] shrink-0 transition-all",
          selected
            ? "bg-blue-600 border-blue-500 text-white"
            : "border-border-default text-transparent"
        )}
      >
        ✓
      </span>
      <span className="flex-1 truncate">
        <span className={cn("font-medium", selected ? "text-blue-200" : "text-foreground/80")}>
          {event.name}
        </span>
        {place && (
          <span className="text-muted"> · {place.name}</span>
        )}
      </span>
      {event.year && (
        <span className="text-xs text-muted shrink-0">{event.year}</span>
      )}
    </button>
  )
}

function EventPicker({
  selectedIds,
  onToggle,
  events,
  places,
}: {
  selectedIds: string[]
  onToggle: (id: string) => void
  events: Event[]
  places: Place[]
}) {
  const [query, setQuery] = useState("")
  const selected = useMemo(() => new Set(selectedIds), [selectedIds])
  const placesById = useMemo(
    () => Object.fromEntries(places.map((p) => [p.id, p])),
    [places]
  )

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return [...events]
      .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
      .filter(
        (e) =>
          !q ||
          e.name.toLowerCase().includes(q) ||
          String(e.year ?? "").includes(q) ||
          (e.place_id && placesById[e.place_id]?.name.toLowerCase().includes(q))
      )
  }, [query, events, placesById])

  const selectedEvents = events.filter((e) => selected.has(e.id))
  const unselected = filtered.filter((e) => !selected.has(e.id))

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search events…"
        className={inputCls}
      />

      <div className="max-h-80 overflow-y-auto rounded-lg border border-border-default divide-y divide-[#1e1e1e]">
        {selectedEvents.length > 0 && (
          <>
            {selectedEvents.map((e) => (
              <EventRow
                key={e.id}
                event={e}
                place={e.place_id ? placesById[e.place_id] : undefined}
                selected
                onToggle={onToggle}
              />
            ))}
            {unselected.length > 0 && (
              <div className="px-4 py-1 text-[10px] text-muted uppercase tracking-widest bg-surface-active">
                All events
              </div>
            )}
          </>
        )}

        {unselected.slice(0, 40).map((e) => (
          <EventRow
            key={e.id}
            event={e}
            place={e.place_id ? placesById[e.place_id] : undefined}
            selected={false}
            onToggle={onToggle}
          />
        ))}

        {!query && unselected.length > 40 && (
          <div className="px-4 py-2 text-xs text-center text-muted">
            {unselected.length - 40} more — search to narrow down
          </div>
        )}

        {query && filtered.length === 0 && (
          <div className="px-4 py-3 text-sm text-muted">No events found</div>
        )}
      </div>

      {selectedIds.length > 0 && (
        <p className="text-xs text-muted">
          {selectedIds.length} event{selectedIds.length !== 1 ? "s" : ""} selected
        </p>
      )}
    </div>
  )
}

// ─── Password strength ────────────────────────────────────────────────────────

function passwordStrength(pw: string): { score: number; label: string; color: string } {
  if (pw.length === 0) return { score: 0, label: "", color: "" }
  if (pw.length < 6) return { score: 1, label: "Too short", color: "bg-red-500" }
  if (pw.length < 8) return { score: 2, label: "Weak", color: "bg-amber-500" }
  const has = (re: RegExp) => re.test(pw)
  const extras = [has(/[A-Z]/), has(/[0-9]/), has(/[^A-Za-z0-9]/)].filter(Boolean).length
  if (extras >= 2) return { score: 4, label: "Strong", color: "bg-emerald-500" }
  if (extras >= 1) return { score: 3, label: "Good", color: "bg-blue-500" }
  return { score: 2, label: "Weak", color: "bg-amber-500" }
}

// ─── Main flow ────────────────────────────────────────────────────────────────

function generateClaimId() {
  return `ob-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

export function OnboardingFlow() {
  const router = useRouter()
  const {
    onboarding,
    setOnboardingField,
    setOnboardingStep,
    completeOnboarding,
    setProfileOverride,
    setActivePersonId,
    userEntities,
    catalog,
    addClaim,
    activeCommunitySlug,
  } = useLineageStore()

  const step = onboarding.step

  // Account step state (not persisted to store)
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [emailConfirmPending, setEmailConfirmPending] = useState(false)
  const [claimContext, setClaimContext] = useState<{ inviterName?: string } | null>(null)

  // Pre-fill from invite claim link (sessionStorage set by /claim/[token] page)
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
        setClaimContext({ inviterName: prefill.inviter_name })
      }
    } catch { /* sessionStorage may not be available */ }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Merged catalog data
  const allPlaces = useMemo(
    () => [...catalog.places, ...userEntities.places] as unknown as { id: string; [key: string]: unknown }[],
    [catalog.places, userEntities.places]
  )
  const allBoards = useMemo(
    () => [...catalog.boards, ...userEntities.boards],
    [catalog.boards, userEntities.boards]
  )

  // ── Multi-select toggles ──────────────────────────────────────────────────

  const toggleBoard = (id: string) => {
    const ids = onboarding.board_ids ?? []
    setOnboardingField(
      "board_ids",
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
    )
  }

  const toggleEvent = (id: string) => {
    const ids = onboarding.event_ids ?? []
    setOnboardingField(
      "event_ids",
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
    )
  }

  // ── Apply claims after account creation ──────────────────────────────────

  const applyOnboardingClaims = (personId: string) => {
    const claimYear = onboarding.start_year ?? new Date().getFullYear()
    const startDate = `${claimYear}-01-01`

    const makeClaim = (predicate: Predicate, objectId: string, objectType: "board" | "place" | "event") => {
      addClaim({
        id: generateClaimId(),
        subject_id: personId,
        subject_type: "person",
        predicate,
        object_id: objectId,
        object_type: objectType,
        start_date: startDate,
        confidence: "self-reported",
        visibility: "public",
        asserted_by: personId,
        created_at: new Date().toISOString(),
      })
    }

    if (onboarding.first_board_id) makeClaim("owned_board", onboarding.first_board_id, "board")
    if (onboarding.first_place_id) makeClaim("rode_at", onboarding.first_place_id, "place")

    const extraBoards = (onboarding.board_ids ?? []).filter((id) => id !== onboarding.first_board_id)
    extraBoards.forEach((id) => makeClaim("owned_board", id, "board"))

    const extraPlaces = (onboarding.event_ids ?? [])
    extraPlaces.forEach((id) => makeClaim("competed_at", id, "event"))
  }

  // ── Account creation ──────────────────────────────────────────────────────

  const handleSignup = async () => {
    const email = onboarding.email?.trim() ?? ""
    if (!email || !password || password.length < 8) return

    setSubmitting(true)
    setSubmitError(null)

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })

    setSubmitting(false)

    if (error) {
      setSubmitError(error.message)
      return
    }

    // Apply profile locally
    setProfileOverride({
      display_name: onboarding.display_name?.trim() || email.split("@")[0],
      ...(onboarding.birth_year && { birth_year: onboarding.birth_year }),
      riding_since: onboarding.start_year,
      privacy_level: "private",
    })

    const userId = data.user?.id ?? `local-${Date.now()}`
    setActivePersonId(userId)
    applyOnboardingClaims(userId)
    completeOnboarding()

    // Flag for post-onboarding membership banner (shown once on first profile visit)
    if (typeof window !== "undefined") {
      localStorage.setItem("lineage_onboarding_banner_pending", "1")
    }

    if (data.session) {
      router.replace(`/${activeCommunitySlug}/timeline`)
    } else {
      // Email confirmation required
      setEmailConfirmPending(true)
    }
  }

  // Dev bypass
  const devBypass = () => {
    const devId = `dev-${Date.now().toString(36)}`
    setProfileOverride({
      display_name: onboarding.display_name?.trim() || "Dev User",
      birth_year: onboarding.birth_year,
      riding_since: onboarding.start_year,
      privacy_level: "private",
    })
    setActivePersonId(devId)
    applyOnboardingClaims(devId)
    completeOnboarding()
    router.replace(`/${activeCommunitySlug}/timeline`)
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  const canContinue = () => {
    if (step === 1) return !!onboarding.display_name?.trim()
    if (step === 2) return !!onboarding.start_year
    if (step === STEPS.length - 1) {
      const e = onboarding.email?.trim() ?? ""
      return (
        e.includes("@") &&
        e.length > 4 &&
        password.length >= 8 &&
        !submitting &&
        !emailConfirmPending
      )
    }
    return true
  }

  const next = () => {
    if (step === STEPS.length - 1) {
      handleSignup()
    } else if (step < STEPS.length - 1) {
      setOnboardingStep(step + 1)
    }
  }

  const back = () => {
    if (step > 0) setOnboardingStep(step - 1)
  }

  const pw = passwordStrength(password)

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-8">
            <span className="text-blue-400 text-xl">⬡</span>
            <span className="font-semibold text-foreground">Lineage</span>
          </div>
          <ProgressBar step={step} total={STEPS.length} />
        </div>

        {/* Step content */}
        <div className="min-h-[420px]">

          {/* ── Step 0: Welcome ── */}
          {step === 0 && (
            <div className="space-y-4">
              {claimContext ? (
                <>
                  <div className="bg-blue-950/40 border border-blue-900/50 rounded-xl px-4 py-3 text-sm text-blue-200">
                    <span className="font-semibold">{claimContext.inviterName}</span> added you to their snowboard lineage.
                    {" "}Claim your profile to verify the connection.
                  </div>
                  <h1 className="text-2xl font-bold text-foreground">Claim your profile</h1>
                </>
              ) : (
                <h1 className="text-2xl font-bold text-foreground">Build your snowboarding lineage.</h1>
              )}
              <p className="text-muted leading-relaxed text-sm">
                Lineage is a living record of snowboarding history — built by riders, for riders.
                Add your own timeline: the boards you rode, the places you rode them, and the events you attended.
              </p>
              <div className="mt-6 space-y-2.5">
                {[
                  ["🏂", "Document every board you've ever ridden"],
                  ["🏔", "Trace your history by mountain and season"],
                  ["🏆", "Log events you competed at or watched"],
                  ["🤙", "Find other riders who share your lineage"],
                ].map(([icon, text]) => (
                  <div
                    key={text}
                    className="flex gap-3 text-sm text-muted bg-surface rounded-lg px-4 py-3 border border-border-default"
                  >
                    <span>{icon}</span>
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 1: About you ── */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-foreground mb-1">About you</h2>
                <p className="text-muted text-sm">Your name is required. Everything else is optional.</p>
              </div>

              <Field label="Your name">
                <input
                  autoFocus
                  type="text"
                  value={onboarding.display_name ?? ""}
                  onChange={(e) => setOnboardingField("display_name", e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && canContinue()) next() }}
                  placeholder="e.g. Alex Torres"
                  className={inputCls}
                />
              </Field>

              <Field label="Birth year" optional>
                <input
                  type="number"
                  value={onboarding.birth_year ?? ""}
                  onChange={(e) => {
                    const v = parseInt(e.target.value)
                    setOnboardingField("birth_year", isNaN(v) ? undefined : v)
                  }}
                  placeholder="e.g. 1985"
                  min={1930}
                  max={2015}
                  className={inputCls}
                />
              </Field>

              <div className="pt-1">
                <p className="text-xs font-medium text-muted uppercase tracking-widest mb-3">
                  Home <span className="normal-case font-normal text-muted/60">optional</span>
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={onboarding.home_country ?? ""}
                    onChange={(e) => setOnboardingField("home_country", e.target.value)}
                    placeholder="Country"
                    className={inputCls}
                  />
                  <input
                    type="text"
                    value={onboarding.home_region ?? ""}
                    onChange={(e) => setOnboardingField("home_region", e.target.value)}
                    placeholder="Province / State"
                    className={inputCls}
                  />
                  <input
                    type="text"
                    value={onboarding.home_city ?? ""}
                    onChange={(e) => setOnboardingField("home_city", e.target.value)}
                    placeholder="City"
                    className={inputCls}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: First season ── */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-foreground mb-1">Your first season</h2>
                <p className="text-muted text-sm">When did you start? Add your first board and mountain too.</p>
              </div>

              <Field label="Year you started snowboarding">
                <input
                  autoFocus
                  type="number"
                  value={onboarding.start_year ?? ""}
                  onChange={(e) => {
                    const v = parseInt(e.target.value)
                    setOnboardingField("start_year", isNaN(v) ? undefined : v)
                  }}
                  placeholder="e.g. 1998"
                  min={1960}
                  max={new Date().getFullYear()}
                  className={inputCls}
                />
              </Field>

              <Field label="First board" optional>
                <SearchSelect
                  items={allBoards as unknown as { id: string; [key: string]: unknown }[]}
                  value={onboarding.first_board_id}
                  onChange={(id) => setOnboardingField("first_board_id", id || undefined)}
                  placeholder="Search boards…"
                  getLabel={(i) => {
                    const b = i as unknown as Board
                    return `${b.brand} ${b.model} '${String(b.model_year).slice(2)}`
                  }}
                  getId={(i) => i.id}
                  addEntityType="board"
                  addEntityLabel="board"
                />
              </Field>

              <Field label="First place you rode" optional>
                <SearchSelect
                  items={allPlaces}
                  value={onboarding.first_place_id}
                  onChange={(id) => setOnboardingField("first_place_id", id || undefined)}
                  placeholder="Search resorts, mountains…"
                  getLabel={(i) => (i as unknown as Place).name}
                  getId={(i) => i.id}
                  addEntityType="place"
                  addEntityLabel="place"
                />
              </Field>
            </div>
          )}

          {/* ── Step 3: Boards ── */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-foreground mb-1">Your board history</h2>
                <p className="text-muted text-sm">
                  Tap <span className="text-foreground font-medium">+</span> to add any board you&apos;ve ridden to your timeline.
                </p>
              </div>
              <BoardPicker
                selectedIds={onboarding.board_ids ?? []}
                onToggle={toggleBoard}
                boards={allBoards}
              />
            </div>
          )}

          {/* ── Step 4: Events ── */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-foreground mb-1">Events you attended</h2>
                <p className="text-muted text-sm">
                  Contests, film premieres, trade shows — anything you competed at, spectated, or organized.
                </p>
              </div>
              <EventPicker
                selectedIds={onboarding.event_ids ?? []}
                onToggle={toggleEvent}
                events={catalog.events}
                places={catalog.places}
              />
            </div>
          )}

          {/* ── Step 5: Create account ── */}
          {step === 5 && !emailConfirmPending && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-foreground mb-1">Create your account</h2>
                <p className="text-muted text-sm leading-relaxed">
                  Your email and password let you sign back in from any device.
                </p>
              </div>

              <Field label="Email address">
                <input
                  autoFocus
                  type="email"
                  value={onboarding.email ?? ""}
                  onChange={(e) => setOnboardingField("email", e.target.value)}
                  placeholder="you@example.com"
                  className={inputCls}
                />
              </Field>

              <Field label="Password">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && canContinue()) next() }}
                  placeholder="At least 8 characters"
                  className={inputCls}
                />
                {password.length > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex gap-0.5 flex-1">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={cn(
                            "h-0.5 flex-1 rounded-full transition-all duration-300",
                            pw.score >= i ? pw.color : "bg-border-default"
                          )}
                        />
                      ))}
                    </div>
                    {pw.label && (
                      <span className="text-xs text-muted shrink-0">{pw.label}</span>
                    )}
                  </div>
                )}
              </Field>

              {submitError && (
                <p className="text-sm text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-4 py-3">
                  {submitError}
                </p>
              )}

              <p className="text-xs text-muted">
                We&apos;ll never share your email. Used only to restore your session.
              </p>

              {process.env.NODE_ENV === "development" && (
                <button
                  onClick={devBypass}
                  className="w-full px-4 py-2 rounded-lg text-xs text-amber-400 border border-amber-900/50 bg-amber-950/20 hover:bg-amber-950/40 transition-colors"
                >
                  ⚡ Skip — dev only
                </button>
              )}
            </div>
          )}

          {/* ── Step 5: Email confirmation pending ── */}
          {step === 5 && emailConfirmPending && (
            <div className="space-y-4 text-center pt-8">
              <div className="text-5xl">📬</div>
              <h2 className="text-xl font-bold text-foreground">One more step</h2>
              <p className="text-muted text-sm leading-relaxed">
                We sent a confirmation link to{" "}
                <span className="text-foreground font-medium">{onboarding.email}</span>.
                Click it, then sign in with your email and password.
              </p>
              <p className="text-xs text-muted pt-2">
                Didn&apos;t get it?{" "}
                <button
                  onClick={() => setEmailConfirmPending(false)}
                  className="text-blue-400 hover:underline"
                >
                  Try again
                </button>
              </p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-border-default">
          <button
            onClick={back}
            className={cn(
              "text-sm text-muted hover:text-foreground transition-colors",
              (step === 0 || emailConfirmPending) && "invisible"
            )}
          >
            ← Back
          </button>

          <button
            onClick={next}
            disabled={!canContinue()}
            className={cn(
              "px-6 py-2.5 rounded-lg text-sm font-medium transition-all",
              canContinue()
                ? "bg-blue-600 text-white hover:bg-blue-500"
                : "bg-surface-active text-muted cursor-not-allowed"
            )}
          >
            {emailConfirmPending
              ? "Waiting for confirmation…"
              : step === STEPS.length - 1
              ? submitting
                ? "Creating account…"
                : "Create account →"
              : step === 3 || step === 4
              ? onboarding[step === 3 ? "board_ids" : "event_ids"]?.length
                ? `Continue with ${onboarding[step === 3 ? "board_ids" : "event_ids"]!.length} selected →`
                : "Skip for now"
              : step === 0
              ? "Get started"
              : "Continue"}
          </button>
        </div>
      </div>
    </div>
  )
}
