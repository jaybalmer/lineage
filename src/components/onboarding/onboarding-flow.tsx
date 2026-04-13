"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useLineageStore } from "@/store/lineage-store"
import { cn } from "@/lib/utils"
import { AddEntityModal } from "@/components/ui/add-entity-modal"
import { supabase } from "@/lib/supabase"
import type { Place, Predicate } from "@/types"

// ─── Step IDs ─────────────────────────────────────────────────────────────────

type StepId =
  | "welcome"
  | "name"
  | "start_year"
  | "first_board"
  | "first_place"
  | "riding_intensity"
  | "riding_details"
  | "account"

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

  // ── Dynamic step list based on answers ───────────────────────────────────

  const steps: StepId[] = useMemo(() => {
    const base: StepId[] = [
      "welcome",
      "name",
      "start_year",
      "first_board",
      "first_place",
      "riding_intensity",
    ]
    if (onboarding.riding_intensity === "a_lot" || onboarding.riding_intensity === "my_life") {
      base.push("riding_details")
    }
    base.push("account")
    return base
  }, [onboarding.riding_intensity])

  const currentStepId: StepId = steps[step] ?? "account"
  const totalSteps = steps.length

  // ── Apply claims after account creation ──────────────────────────────────

  const applyOnboardingClaims = (personId: string) => {
    const claimYear = onboarding.start_year ?? new Date().getFullYear()
    const startDate = `${claimYear}-01-01`

    if (onboarding.first_place_id) {
      addClaim({
        id: generateClaimId(),
        subject_id: personId,
        subject_type: "person",
        predicate: "rode_at" as Predicate,
        object_id: onboarding.first_place_id,
        object_type: "place",
        start_date: startDate,
        confidence: "self-reported",
        visibility: "public",
        asserted_by: personId,
        created_at: new Date().toISOString(),
      })
    }
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

    if (typeof window !== "undefined") {
      localStorage.setItem("lineage_onboarding_banner_pending", "1")
    }

    if (data.session) {
      router.replace(`/${activeCommunitySlug}/timeline`)
    } else {
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
    if (currentStepId === "name") return !!onboarding.display_name?.trim()
    if (currentStepId === "start_year") return !!onboarding.start_year
    if (currentStepId === "riding_intensity") return !!onboarding.riding_intensity
    if (currentStepId === "account") {
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
    if (currentStepId === "account") {
      handleSignup()
    } else if (step < totalSteps - 1) {
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
            <span className="text-[#B8862A] text-xl">⬡</span>
            <span className="font-semibold text-foreground">Lineage</span>
          </div>
          <ProgressBar step={step} total={totalSteps} />
        </div>

        {/* Step content */}
        <div className="min-h-[380px]">

          {/* ── Welcome ── */}
          {currentStepId === "welcome" && (
            <div className="space-y-5">
              {claimContext ? (
                <>
                  <div className="bg-blue-950/40 border border-blue-900/50 rounded-xl px-4 py-3 text-sm text-blue-200">
                    <span className="font-semibold">{claimContext.inviterName}</span> added you to their snowboard lineage.
                    {" "}Claim your profile to verify the connection.
                  </div>
                  <h1 className="text-2xl font-bold text-foreground">Claim your profile</h1>
                </>
              ) : (
                <>
                  <h1 className="text-2xl font-bold text-foreground leading-snug">
                    Welcome to the community of snowboarders.
                  </h1>
                  <p className="text-muted leading-relaxed text-sm">
                    Lineage is where riders document their history — the boards they rode, the mountains they called home, the contests they threw down at. Together, we&apos;re building a living record of the sport.
                  </p>
                  <p className="text-muted leading-relaxed text-sm">
                    We&apos;ll ask a few quick questions to get your timeline started. Takes about two minutes.
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

          {/* ── First board ── */}
          {currentStepId === "first_board" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-foreground mb-1">
                  What was your first board?
                </h2>
                <p className="text-muted text-sm">
                  Brand name is plenty — add a model or year if you remember.
                  <span className="ml-1.5 text-muted/60">Optional.</span>
                </p>
              </div>
              <input
                autoFocus
                type="text"
                value={onboarding.first_board_text ?? ""}
                onChange={(e) => setOnboardingField("first_board_text", e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") next() }}
                placeholder="e.g. Burton, Lib Tech Skate Banana"
                className={inputCls}
              />
            </div>
          )}

          {/* ── First place ── */}
          {currentStepId === "first_place" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-foreground mb-1">
                  Where did you first ride?
                </h2>
                <p className="text-muted text-sm">
                  The mountain or resort where it all started.
                  <span className="ml-1.5 text-muted/60">Optional.</span>
                </p>
              </div>
              <PlaceSelect
                items={catalog.places as Place[]}
                value={onboarding.first_place_id}
                onChange={(id) => setOnboardingField("first_place_id", id || undefined)}
              />
            </div>
          )}

          {/* ── Riding intensity ── */}
          {currentStepId === "riding_intensity" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-foreground mb-1">
                  How much did you ride?
                </h2>
                <p className="text-muted text-sm">At your peak — when you were most into it.</p>
              </div>
              <div className="space-y-2">
                {([
                  ["casual", "Casually", "Went when I could — a few times a season"],
                  ["a_lot", "A lot", "Most weekends, every season"],
                  ["my_life", "It was my life", "I was deep in it"],
                ] as const).map(([value, label, sublabel]) => (
                  <button
                    key={value}
                    onClick={() => setOnboardingField("riding_intensity", value)}
                    className={cn(
                      "w-full text-left px-4 py-3.5 rounded-lg border transition-all",
                      onboarding.riding_intensity === value
                        ? "bg-blue-950/40 border-blue-700/50 text-foreground"
                        : "bg-surface border-border-default text-muted hover:bg-surface-hover hover:text-foreground"
                    )}
                  >
                    <div className="font-medium text-sm">{label}</div>
                    <div className="text-xs text-muted mt-0.5">{sublabel}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Riding details (sponsored + compete) ── */}
          {currentStepId === "riding_details" && (
            <div className="space-y-7">
              <div>
                <h2 className="text-xl font-bold text-foreground mb-1">A bit more about your riding</h2>
                <p className="text-muted text-sm">Helps us understand where you fit in the history.</p>
              </div>

              <div className="space-y-2.5">
                <p className="text-sm font-medium text-foreground">Were you ever sponsored?</p>
                <div className="flex gap-2">
                  {([true, false] as const).map((v) => (
                    <button
                      key={String(v)}
                      onClick={() => setOnboardingField("was_sponsored", v)}
                      className={cn(
                        "flex-1 px-4 py-2.5 rounded-lg border text-sm transition-all",
                        onboarding.was_sponsored === v
                          ? "bg-blue-950/40 border-blue-700/50 text-blue-200"
                          : "bg-surface border-border-default text-muted hover:bg-surface-hover"
                      )}
                    >
                      {v ? "Yes" : "No"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5">
                <p className="text-sm font-medium text-foreground">Did you compete?</p>
                <div className="flex gap-2">
                  {([true, false] as const).map((v) => (
                    <button
                      key={String(v)}
                      onClick={() => setOnboardingField("did_compete", v)}
                      className={cn(
                        "flex-1 px-4 py-2.5 rounded-lg border text-sm transition-all",
                        onboarding.did_compete === v
                          ? "bg-blue-950/40 border-blue-700/50 text-blue-200"
                          : "bg-surface border-border-default text-muted hover:bg-surface-hover"
                      )}
                    >
                      {v ? "Yes" : "No"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Account ── */}
          {currentStepId === "account" && !emailConfirmPending && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-foreground mb-1">Last thing — create your account</h2>
                <p className="text-muted text-sm leading-relaxed">
                  Your email and password let you sign back in from any device.
                </p>
              </div>

              <div className="space-y-3">
                <input
                  autoFocus
                  type="email"
                  value={onboarding.email ?? ""}
                  onChange={(e) => setOnboardingField("email", e.target.value)}
                  placeholder="you@example.com"
                  className={inputCls}
                />
                <div>
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
                </div>
              </div>

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
                  Skip — dev only
                </button>
              )}
            </div>
          )}

          {/* ── Email confirmation pending ── */}
          {currentStepId === "account" && emailConfirmPending && (
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
                ? "bg-[#1C1917] text-[#F5F2EE] hover:bg-[#292524]"
                : "bg-surface-active text-muted cursor-not-allowed"
            )}
          >
            {emailConfirmPending
              ? "Waiting for confirmation…"
              : currentStepId === "account"
              ? submitting
                ? "Creating account…"
                : "Create account →"
              : currentStepId === "welcome"
              ? "Get started"
              : currentStepId === "first_board" || currentStepId === "first_place"
              ? onboarding[currentStepId === "first_board" ? "first_board_text" : "first_place_id"]
                ? "Continue"
                : "Skip for now"
              : "Continue"}
          </button>
        </div>
      </div>
    </div>
  )
}
