"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useLineageStore } from "@/store/lineage-store"
import { cn } from "@/lib/utils"
import { AddEntityModal } from "@/components/ui/add-entity-modal"
import { TimelineAhaStep } from "@/components/onboarding/timeline-aha"
import { SaveStep } from "@/components/onboarding/save-step"
import type { Claim, Org, Place, Predicate } from "@/types"

// ─── Step IDs ─────────────────────────────────────────────────────────────────

type StepId =
  | "land"
  | "name"
  | "start_year"
  | "last_place"
  | "first_board_brand"
  | "timeline_aha"
  | "save"

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

// ─── Place search select ──────────────────────────────────────────────────────

function PlaceSelect({
  items,
  value,
  onChange,
}: {
  items: Place[]
  value?: string
  onChange: (id: string) => void
}) {
  const [query, setQuery] = useState("")
  const [showModal, setShowModal] = useState(false)

  const selectedItem = items.find((i) => i.id === value)

  const filtered = items.filter((i) =>
    i.name.toLowerCase().includes(query.toLowerCase())
  )

  if (value && selectedItem) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-blue-950/30 border border-blue-900/40 rounded-lg px-4 py-3 text-sm text-blue-200">
          {selectedItem.name}
        </div>
        <button
          onClick={() => onChange("")}
          className="text-muted hover:text-foreground transition-colors px-2 py-3 text-sm"
        >
          ×
        </button>
      </div>
    )
  }

  return (
    <div>
      {showModal && (
        <AddEntityModal
          entityType="place"
          initialName={query}
          onClose={() => setShowModal(false)}
          onAdded={(id) => {
            onChange(id)
            setShowModal(false)
          }}
        />
      )}
      <input
        autoFocus
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search resorts, mountains…"
        className={inputCls}
      />
      {query.length > 0 && (
        <div className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-border-default divide-y divide-[#1e1e1e]">
          {filtered.slice(0, 8).map((item) => (
            <button
              key={item.id}
              onClick={() => { onChange(item.id); setQuery("") }}
              className="w-full text-left px-4 py-2.5 text-sm text-muted hover:bg-surface-hover transition-colors"
            >
              {item.name}
            </button>
          ))}
          {query.trim().length > 0 && (
            <button
              onClick={() => setShowModal(true)}
              className="w-full text-left px-4 py-2.5 text-sm text-blue-400 hover:bg-surface-hover transition-colors flex items-center gap-1.5"
            >
              <span className="font-bold">+</span>
              Add &ldquo;{query.trim()}&rdquo; as a new place
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Brand search select ──────────────────────────────────────────────────────

function BrandSelect({
  items,
  value,
  onChange,
}: {
  items: Org[]
  value?: string
  onChange: (id: string) => void
}) {
  const [query, setQuery] = useState("")
  const [showModal, setShowModal] = useState(false)

  const selectedItem = items.find((i) => i.id === value)

  const filtered = items.filter((i) =>
    i.name.toLowerCase().includes(query.toLowerCase())
  )

  if (value && selectedItem) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-blue-950/30 border border-blue-900/40 rounded-lg px-4 py-3 text-sm text-blue-200">
          {selectedItem.name}
        </div>
        <button
          onClick={() => onChange("")}
          className="text-muted hover:text-foreground transition-colors px-2 py-3 text-sm"
        >
          ×
        </button>
      </div>
    )
  }

  return (
    <div>
      {showModal && (
        <AddEntityModal
          entityType="org"
          initialName={query}
          onClose={() => setShowModal(false)}
          onAdded={(id) => {
            onChange(id)
            setShowModal(false)
          }}
        />
      )}
      <input
        autoFocus
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search brands…"
        className={inputCls}
      />
      {query.length > 0 && (
        <div className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-border-default divide-y divide-[#1e1e1e]">
          {filtered.slice(0, 8).map((item) => (
            <button
              key={item.id}
              onClick={() => { onChange(item.id); setQuery("") }}
              className="w-full text-left px-4 py-2.5 text-sm text-muted hover:bg-surface-hover transition-colors"
            >
              {item.name}
            </button>
          ))}
          {query.trim().length > 0 && (
            <button
              onClick={() => setShowModal(true)}
              className="w-full text-left px-4 py-2.5 text-sm text-blue-400 hover:bg-surface-hover transition-colors flex items-center gap-1.5"
            >
              <span className="font-bold">+</span>
              Add &ldquo;{query.trim()}&rdquo; as a new brand
            </button>
          )}
        </div>
      )}
    </div>
  )
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
    catalog,
    addClaim,
    removeClaim,
    updateClaim,
    activeCommunitySlug,
  } = useLineageStore()
  const sessionClaims = useLineageStore((s) => s.sessionClaims)

  const step = onboarding.step
  const [claimContext, setClaimContext] = useState<{ inviterName?: string } | null>(null)

  // Pre-fill from invite claim link (sessionStorage set by /claim/[token] page).
  // Invited users fall through the organic flow until the dedicated aha-card arc ships;
  // the existing /auth/complete invite-merge still repoints their ghost claims on save.
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

  // ── Fixed organic step path ───────────────────────────────────────────────

  const steps: StepId[] = useMemo(
    () => ["land", "name", "start_year", "last_place", "first_board_brand", "timeline_aha", "save"],
    []
  )

  const currentStepId: StepId = steps[step] ?? "save"
  const totalSteps = steps.length

  const brandItems = useMemo(
    () => (catalog.orgs as Org[]).filter((o) => o.org_type === "brand"),
    [catalog.orgs]
  )

  // ── Claim creation (pre-auth → sessionClaims; migrated at /auth/complete) ──
  // Keep at most one claim per FTUE predicate so re-picking or clearing a
  // selection never leaves a duplicate behind. subject_id/asserted_by are
  // placeholders here; /auth/complete overwrites them with the real user id.

  const replaceClaim = (predicate: Predicate, claim: Claim | null) => {
    useLineageStore
      .getState()
      .sessionClaims.filter((c) => c.predicate === predicate)
      .forEach((c) => removeClaim(c.id))
    if (claim) addClaim(claim)
  }

  const handlePlace = (id: string) => {
    setOnboardingField("first_place_id", id || undefined)
    replaceClaim(
      "rode_at",
      id
        ? {
            id: generateClaimId(),
            subject_id: "ftue-self",
            subject_type: "person",
            predicate: "rode_at",
            object_id: id,
            object_type: "place",
            start_date: `${new Date().getFullYear()}-01-01`,
            confidence: "self-reported",
            visibility: "public",
            asserted_by: "ftue-self",
            created_at: new Date().toISOString(),
          }
        : null
    )
  }

  const handleBrand = (id: string) => {
    setOnboardingField("first_board_id", id || undefined)
    const year = onboarding.start_year ?? new Date().getFullYear()
    replaceClaim(
      "fan_of",
      id
        ? {
            id: generateClaimId(),
            subject_id: "ftue-self",
            subject_type: "person",
            predicate: "fan_of",
            object_id: id,
            object_type: "org",
            start_date: `${year}-01-01`,
            confidence: "self-reported",
            visibility: "public",
            asserted_by: "ftue-self",
            created_at: new Date().toISOString(),
          }
        : null
    )
  }

  // Dev bypass — skip the OAuth gate locally. Binds the session claims to the
  // dev user so they render on the timeline just like the real save path would.
  const devBypass = () => {
    const devId = `dev-${Date.now().toString(36)}`
    setProfileOverride({
      display_name: onboarding.display_name?.trim() || "Dev User",
      birth_year: onboarding.birth_year,
      riding_since: onboarding.start_year,
      privacy_level: "private",
    })
    setActivePersonId(devId)
    useLineageStore.getState().sessionClaims.forEach((c) =>
      updateClaim(c.id, { subject_id: devId, asserted_by: devId })
    )
    completeOnboarding()
    router.replace(`/${activeCommunitySlug}/timeline`)
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  const canContinue = () => {
    if (currentStepId === "name") return !!onboarding.display_name?.trim()
    if (currentStepId === "start_year") return !!onboarding.start_year
    return true
  }

  const next = () => {
    if (currentStepId === "save") return
    if (step < totalSteps - 1) setOnboardingStep(step + 1)
  }

  const back = () => {
    if (step > 0) setOnboardingStep(step - 1)
  }

  const displayName = onboarding.display_name?.trim() || "You"

  const primaryLabel =
    currentStepId === "land"
      ? "Get started"
      : currentStepId === "timeline_aha"
      ? "Save my lineage"
      : currentStepId === "last_place"
      ? (onboarding.first_place_id ? "Continue" : "Skip for now")
      : currentStepId === "first_board_brand"
      ? (onboarding.first_board_id ? "Continue" : "Skip for now")
      : "Continue"

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen bg-background flex items-center justify-center px-4"
      data-ftue-step={currentStepId}
    >
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-8">
            <span className="text-[#B8862A] text-xl">⬡</span>
            <span className="font-semibold text-foreground">Lineage</span>
          </div>
          <ProgressBar step={step} total={totalSteps} />
        </div>

        {/* Step content */}
        <div className="min-h-[380px]">

          {/* ── Land ── */}
          {currentStepId === "land" && (
            <div className="space-y-5">
              {claimContext ? (
                <>
                  <div className="bg-blue-950/40 border border-blue-900/50 rounded-xl px-4 py-3 text-sm text-blue-200">
                    <span className="font-semibold">{claimContext.inviterName}</span> added you to their snowboard lineage. Claim your spot to make it yours.
                  </div>
                  <h1 className="text-2xl font-bold text-foreground">Claim your lineage</h1>
                </>
              ) : (
                <>
                  <h1 className="text-2xl font-bold text-foreground leading-snug">
                    Lineage is a living record of snowboarding.
                  </h1>
                  <p className="text-muted leading-relaxed text-sm">
                    Claim a couple of real moments. They land on your personal timeline and become part of the community&apos;s collective history.
                  </p>
                  <p className="text-muted leading-relaxed text-sm">
                    Two quick claims, then it&apos;s yours to save. Takes about a minute.
                  </p>
                </>
              )}
            </div>
          )}

          {/* ── Name ── */}
          {currentStepId === "name" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-foreground mb-1">What&apos;s your name?</h2>
                <p className="text-muted text-sm">How people know you in the community.</p>
              </div>
              <input
                autoFocus
                type="text"
                value={onboarding.display_name ?? ""}
                onChange={(e) => setOnboardingField("display_name", e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && canContinue()) next() }}
                placeholder="e.g. Alex Torres"
                className={inputCls}
              />
            </div>
          )}

          {/* ── Start year ── */}
          {currentStepId === "start_year" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-foreground mb-1">
                  When did you start snowboarding?
                </h2>
                <p className="text-muted text-sm">Just the year you first clipped in.</p>
              </div>
              <input
                autoFocus
                type="number"
                value={onboarding.start_year ?? ""}
                onChange={(e) => {
                  const v = parseInt(e.target.value)
                  setOnboardingField("start_year", isNaN(v) ? undefined : v)
                }}
                onKeyDown={(e) => { if (e.key === "Enter" && canContinue()) next() }}
                placeholder={`e.g. ${new Date().getFullYear() - 10}`}
                min={1960}
                max={new Date().getFullYear()}
                className={inputCls}
              />
            </div>
          )}

          {/* ── Last place ── */}
          {currentStepId === "last_place" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-foreground mb-1">Where do you ride?</h2>
                <p className="text-muted text-sm">
                  The mountain or resort you call home.
                  <span className="ml-1.5 text-muted/60">Optional.</span>
                </p>
              </div>
              <PlaceSelect
                items={catalog.places as Place[]}
                value={onboarding.first_place_id}
                onChange={handlePlace}
              />
            </div>
          )}

          {/* ── First board brand ── */}
          {currentStepId === "first_board_brand" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-foreground mb-1">What brand do you ride?</h2>
                <p className="text-muted text-sm">
                  Pick the brand on your board.
                  <span className="ml-1.5 text-muted/60">Optional.</span>
                </p>
              </div>
              <BrandSelect
                items={brandItems}
                value={onboarding.first_board_id}
                onChange={handleBrand}
              />
            </div>
          )}

          {/* ── Timeline aha ── */}
          {currentStepId === "timeline_aha" && (
            <TimelineAhaStep
              claims={sessionClaims}
              displayName={displayName}
              startYear={onboarding.start_year}
            />
          )}

          {/* ── Save ── */}
          {currentStepId === "save" && <SaveStep />}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-border-default">
          <button
            onClick={back}
            className={cn(
              "text-sm text-muted hover:text-foreground transition-colors",
              step === 0 && "invisible"
            )}
          >
            ← Back
          </button>

          {currentStepId === "save" ? (
            process.env.NODE_ENV === "development" ? (
              <button
                onClick={devBypass}
                className="px-3 py-2 rounded-lg text-xs text-amber-400 border border-amber-900/50 bg-amber-950/20 hover:bg-amber-950/40 transition-colors"
              >
                Skip — dev only
              </button>
            ) : null
          ) : (
            <button
              onClick={next}
              disabled={!canContinue()}
              className={cn(
                "px-6 py-2.5 rounded-lg text-sm font-medium transition-all",
                canContinue()
                  ? "bg-[#1C1917] text-[#F5F2EE] hover:bg-[#292524]"
                  : "bg-surface-active text-muted cursor-not-allowed"
              )}
            >
              {primaryLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
