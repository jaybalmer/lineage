"use client"

import Link from "next/link"
import { CommunityLink } from "@/components/ui/community-link"
import { Nav } from "@/components/ui/nav"
import { useLineageStore, isAuthUser } from "@/store/lineage-store"
import { supabase } from "@/lib/supabase"
import { useEffect, useState, useCallback, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"

// ─── Constants ────────────────────────────────────────────────────────────────

const TIER_LABELS: Record<string, string> = {
  free:     "Rider",
  annual:   "Member",
  lifetime: "Lifetime Member",
  founding: "Founding Member",
}
const TIER_COLORS: Record<string, string> = {
  free:     "#888",
  annual:   "#3b82f6",
  lifetime: "#8b5cf6",
  founding: "#f59e0b",
}
const TIER_SYMBOLS: Record<string, string> = {
  free: "●", annual: "◈", lifetime: "◆", founding: "✦",
}
const TIER_TOKENS_LABEL: Record<string, string> = {
  annual:   "10 member tokens",
  lifetime: "30 member tokens",
  founding: "100 founder tokens (2× revenue weight)",
}

const FOUNDING_SPOTS = 500

function padMemberNumber(n: number) {
  return String(n).padStart(3, "0")
}

function estimatePayout(tier: string, tokens: { founder: number; member: number; contribution: number }) {
  const totalWeighted = tokens.founder * 2 + tokens.member + tokens.contribution
  if (totalWeighted === 0 || tier === "free") return null
  const examplePool = 5000
  const totalCirculation = 2600
  return ((totalWeighted / totalCirculation) * examplePool).toFixed(2)
}

function getNextDistributionDate() {
  const now = new Date()
  for (const m of [0, 3, 6, 9]) {
    const d = new Date(now.getFullYear(), m, 1)
    if (d > now) return d.toLocaleDateString("en-US", { month: "long", year: "numeric" })
  }
  return `January ${now.getFullYear() + 1}`
}

async function openStripePortal(customerId: string) {
  const res = await fetch("/api/stripe/portal", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customerId }),
  })
  const data = await res.json()
  if (data.url) window.location.href = data.url
  else alert(data.error ?? "Portal unavailable — Stripe not yet configured.")
}

// ─── Celebration Overlay ──────────────────────────────────────────────────────

function CelebrationOverlay({
  tier, memberNumber, spotsFilled, memberName, onContinue,
}: {
  tier: string
  memberNumber?: number
  spotsFilled?: number
  memberName: string
  onContinue: () => void
}) {
  const color = TIER_COLORS[tier] ?? "#3b82f6"
  const symbol = TIER_SYMBOLS[tier] ?? "◈"
  const label = TIER_LABELS[tier] ?? "Member"
  const tokensLabel = TIER_TOKENS_LABEL[tier] ?? ""
  const isFounding = tier === "founding"

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(5,8,15,0.96)" }}
    >
      {/* Glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 60% 50% at 50% 40%, ${color}22 0%, transparent 70%)`,
        }}
      />

      <div className="relative z-10 w-full max-w-md text-center space-y-6"
        style={{ fontFamily: "'IBM Plex Mono', monospace" }}>

        {/* Symbol burst */}
        <div style={{ fontSize: 48, color, lineHeight: 1 }}>{symbol}</div>

        {/* Headline */}
        <div>
          {isFounding && memberNumber && (
            <div
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 72, fontWeight: 800,
                color, letterSpacing: 2, lineHeight: 1,
              }}
            >
              #{padMemberNumber(memberNumber)}
            </div>
          )}
          <div
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: isFounding ? 28 : 36, fontWeight: 800,
              color: "#e5e5e5", letterSpacing: 4, marginTop: isFounding ? 8 : 0,
            }}
          >
            {label.toUpperCase()}
          </div>
          <div className="text-muted mt-1" style={{ fontSize: 11 }}>
            {memberName}
          </div>
        </div>

        {/* Founding spots progress */}
        {isFounding && spotsFilled !== undefined && (
          <div className="space-y-2">
            <div className="flex justify-between text-muted" style={{ fontSize: 9, letterSpacing: 1 }}>
              <span>SPOTS FILLED</span>
              <span>{spotsFilled} / {FOUNDING_SPOTS}</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#1a2030" }}>
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${Math.min(100, (spotsFilled / FOUNDING_SPOTS) * 100)}%`,
                  background: `linear-gradient(90deg, ${color}cc, ${color})`,
                }}
              />
            </div>
          </div>
        )}

        {/* Tokens */}
        {tokensLabel && (
          <div
            className="px-4 py-3 rounded-xl border mx-auto inline-block"
            style={{ borderColor: `${color}44`, background: `${color}10`, fontSize: 11, color }}
          >
            {tokensLabel} granted
          </div>
        )}

        {/* Share card preview */}
        <ShareCard tier={tier} memberNumber={memberNumber} memberName={memberName} preview />

        {/* Continue */}
        <button
          onClick={onContinue}
          className="w-full py-3 rounded-xl font-bold transition-all hover:opacity-90"
          style={{
            background: color, color: isFounding ? "#000" : "#fff",
            fontSize: 13, letterSpacing: 1,
            fontFamily: "'IBM Plex Mono', monospace",
          }}
        >
          Continue to my membership →
        </button>
      </div>
    </div>
  )
}

// ─── Share Card ───────────────────────────────────────────────────────────────

function ShareCard({
  tier, memberNumber, memberName, preview = false,
}: {
  tier: string
  memberNumber?: number
  memberName: string
  preview?: boolean
}) {
  const color = TIER_COLORS[tier] ?? "#3b82f6"
  const symbol = TIER_SYMBOLS[tier] ?? "◈"
  const label = TIER_LABELS[tier] ?? "Member"
  const [copied, setCopied] = useState(false)

  const copyLink = () => {
    navigator.clipboard.writeText("https://lineage.wtf/membership")
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={preview ? "" : "bg-surface border border-border-default rounded-2xl p-5"}>
      {!preview && (
        <div className="md-heading text-foreground mb-4" style={{ fontSize: 16, fontWeight: 700, letterSpacing: 1 }}>
          SHARE YOUR MEMBERSHIP
        </div>
      )}

      {/* The card itself */}
      <div
        id="lineage-share-card"
        className="rounded-2xl p-6 mx-auto"
        style={{
          background: "linear-gradient(135deg, #080e1a 0%, #0d1628 60%, #101e2e 100%)",
          border: `1px solid ${color}44`,
          maxWidth: 320,
          boxShadow: `0 0 40px ${color}22`,
        }}
      >
        {/* Logo row */}
        <div className="flex items-center gap-2 mb-4">
          <span style={{ fontSize: 20, color }}>⬡</span>
          <span style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 11, fontWeight: 700, letterSpacing: 4, color: "#71717a",
          }}>LINEAGE</span>
        </div>

        {/* Symbol + tier */}
        <div className="flex items-baseline gap-3 mb-1">
          <span style={{ fontSize: 32, color, lineHeight: 1 }}>{symbol}</span>
          <span style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 22, fontWeight: 800, color: "#e5e5e5", letterSpacing: 2,
          }}>
            {label.toUpperCase()}
          </span>
        </div>

        {/* Member number */}
        {memberNumber && (
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 48, fontWeight: 800, color, letterSpacing: 2, lineHeight: 1, marginBottom: 4,
          }}>
            #{padMemberNumber(memberNumber)}
          </div>
        )}

        {/* Name */}
        <div style={{ fontSize: 13, color: "#a1a1aa", marginTop: 4 }}>{memberName}</div>

        {/* Footer */}
        <div className="mt-4 pt-3" style={{ borderTop: "1px solid #1e2d3d" }}>
          <div style={{ fontSize: 9, color: "#52525b", letterSpacing: 2 }}>LINEAGE.WTF</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-4 justify-center">
        <p className="text-muted" style={{ fontSize: 9, letterSpacing: 0.5 }}>
          📸 Screenshot card to share on Instagram
        </p>
      </div>
      <div className="flex gap-2 mt-2 justify-center">
        <button
          onClick={copyLink}
          className="px-4 py-2 rounded-full border border-border-default text-muted hover:text-foreground hover:border-foreground transition-all"
          style={{ fontSize: 9, letterSpacing: 1, background: "none", cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace" }}
        >
          {copied ? "✓ Copied!" : "Copy lineage.wtf/membership"}
        </button>
      </div>
    </div>
  )
}

// ─── Gift Section ─────────────────────────────────────────────────────────────

function GiftSection({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(false)
  const [giftLink, setGiftLink] = useState("")
  const [copied, setCopied] = useState(false)

  const generateGiftLink = async () => {
    setLoading(true)
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: "gift_annual", userId }),
    })
    const data = await res.json()
    setLoading(false)
    if (data.url) {
      setGiftLink(data.url)
      navigator.clipboard.writeText(data.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    }
  }

  return (
    <div className="bg-surface border border-border-default rounded-2xl p-5">
      <div className="md-heading text-foreground mb-2" style={{ fontSize: 16, fontWeight: 700, letterSpacing: 1 }}>
        GIFT A MEMBERSHIP
      </div>
      <p className="text-muted mb-4" style={{ fontSize: 10, lineHeight: 1.7 }}>
        Give a fellow rider an annual membership — $25, one year of access to Lineage with
        member tokens and revenue share.
      </p>

      {giftLink ? (
        <div className="space-y-3">
          <div className="p-3 rounded-xl border border-border-default break-all" style={{ fontSize: 9, color: "#52525b" }}>
            {giftLink}
          </div>
          <button
            onClick={() => { navigator.clipboard.writeText(giftLink); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
            className="px-5 py-2 rounded-full border border-border-default text-muted hover:text-foreground hover:border-foreground transition-all"
            style={{ fontSize: 10, letterSpacing: 1, background: "none", cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace" }}
          >
            {copied ? "✓ Link copied!" : "Copy gift link →"}
          </button>
          <p className="text-muted" style={{ fontSize: 9 }}>
            Share this link — your friend pays directly via Stripe and gets a full annual membership.
          </p>
        </div>
      ) : (
        <button
          onClick={generateGiftLink}
          disabled={loading}
          className="px-5 py-2 rounded-full font-bold transition-all hover:opacity-80 disabled:opacity-50"
          style={{
            background: "#3b82f6", color: "#fff",
            fontSize: 10, letterSpacing: 1,
            fontFamily: "'IBM Plex Mono', monospace", cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "Generating..." : "Generate gift link →"}
        </button>
      )}
    </div>
  )
}

// ─── Main Dashboard (needs Suspense for useSearchParams) ─────────────────────

function MembershipDashboard() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const success = searchParams.get("success") === "true"
  const tierParam = searchParams.get("tier") ?? ""

  const { membership, activePersonId, profileOverride, setMembership } = useLineageStore()
  const { tier, status, founding_badge, founding_member_number, token_balance, pending_credit, stripe_customer_id, membership_expires_at } = membership

  const isAuth = isAuthUser(activePersonId)
  const name = profileOverride.display_name ?? "Rider"

  // ── Poll for updated membership after successful purchase ────────────────
  const [showCelebration, setShowCelebration] = useState(success)
  const [spotsFilled, setSpotsFilled] = useState<number | undefined>()
  const [pollDone, setPollDone] = useState(!success)

  const refreshMembership = useCallback(async () => {
    if (!activePersonId || !isAuthUser(activePersonId)) return
    // Use /api/me (service role) to bypass RLS — browser client may not return
    // columns like is_editor depending on RLS policies.
    const res = await fetch("/api/me")
    if (!res.ok) return
    const { profile: data } = await res.json() as { uid: string; profile: Record<string, unknown> }
    if (!data) return
    const dbTier = (data.membership_tier as string) ?? "free"
    const isEditor = !!data.is_editor || dbTier === "founding"
    setMembership({
      is_editor:               isEditor,
      tier:                   dbTier as "free" | "annual" | "lifetime" | "founding",
      status:                 ((data.membership_status ?? "active") as "active" | "expired" | "gifted"),
      founding_badge:          (data.founding_badge as boolean) ?? false,
      founding_member_number:  data.founding_member_number as number | undefined ?? undefined,
      token_balance: {
        founder:      (data.token_founder      as number) ?? 0,
        member:       (data.token_member       as number) ?? 0,
        contribution: (data.token_contribution as number) ?? membership.token_balance.contribution,
      },
      stripe_customer_id:      data.stripe_customer_id     as string | undefined ?? undefined,
      stripe_subscription_id:  data.stripe_subscription_id as string | undefined ?? undefined,
      membership_expires_at:   data.membership_expires_at  as string | undefined ?? undefined,
      pending_credit:          (data.pending_credit as number) ?? 0,
    })
    return data
  }, [activePersonId, setMembership]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!success || !isAuth) { setPollDone(true); return }

    // Fetch founding spots count for celebration
    if (tierParam === "founding") {
      supabase.from("profiles").select("*", { count: "exact", head: true })
        .eq("membership_tier", "founding")
        .then(({ count }) => setSpotsFilled(count ?? undefined))
    }

    // Poll until webhook updates the profile (up to ~15s)
    let attempts = 0
    const poll = setInterval(async () => {
      attempts++
      const data = await refreshMembership()
      const updatedTier = data?.membership_tier ?? "free"
      if (updatedTier !== "free") {
        clearInterval(poll)
        setPollDone(true)
      }
      if (attempts >= 15) { clearInterval(poll); setPollDone(true) }
    }, 1000)

    return () => clearInterval(poll)
  }, [success, isAuth, tierParam]) // eslint-disable-line react-hooks/exhaustive-deps

  // Dismiss celebration and clean URL
  const handleContinue = () => {
    setShowCelebration(false)
    router.replace("/account/membership")
  }

  // ── Not authenticated ────────────────────────────────────────────────────
  if (!isAuth) {
    return (
      <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
        <Nav />
        <div className="max-w-sm mx-auto px-4 pt-24 text-center space-y-5">
          <div className="text-3xl">⬡</div>
          <p className="text-foreground font-semibold" style={{ fontSize: 14 }}>Sign in to Lineage</p>
          <p className="text-muted" style={{ fontSize: 12 }}>Sign in to view your membership and profile.</p>
          <Link href="/auth/signin"
            className="inline-block w-full px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-500 transition-colors"
            style={{ fontSize: 13 }}>
            Sign in →
          </Link>
          <p className="text-muted" style={{ fontSize: 10 }}>
            New here?{" "}
            <Link href="/onboarding" className="underline hover:text-foreground">Create your timeline</Link>
          </p>
        </div>
      </div>
    )
  }

  const color = TIER_COLORS[tier]
  const symbol = TIER_SYMBOLS[tier]
  const label = TIER_LABELS[tier]
  const totalTokens = token_balance.founder * 2 + token_balance.member + token_balance.contribution
  const estPayout = estimatePayout(tier, token_balance)
  const nextDist = getNextDistributionDate()
  const isLapsed = tier !== "free" && status === "expired"

  // Celebration tier (might differ from store if poll not done yet)
  const celebTier = (success && tierParam) ? tierParam : tier
  const celebMemberNumber = founding_member_number ?? (tierParam === "founding" && spotsFilled ? spotsFilled : undefined)

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;700;800&family=IBM+Plex+Mono:wght@400;700&display=swap" />
      <style>{`.md-page { font-family: 'IBM Plex Mono', monospace; } .md-heading { font-family: 'Barlow Condensed', sans-serif; }`}</style>

      {/* Celebration overlay — shows while polling or until dismissed */}
      {showCelebration && (success || pollDone) && (
        <CelebrationOverlay
          tier={celebTier}
          memberNumber={celebMemberNumber}
          spotsFilled={spotsFilled}
          memberName={name}
          onContinue={handleContinue}
        />
      )}

      <div className="md-page min-h-screen bg-background text-foreground">
        <Nav />
        <div className="max-w-3xl mx-auto px-4 pt-10 pb-24 space-y-6">

          {/* Header */}
          <div>
            <div className="text-muted mb-1" style={{ fontSize: 10, letterSpacing: 2 }}>// MEMBERSHIP</div>
            <div className="md-heading text-foreground" style={{ fontSize: 28, fontWeight: 800, letterSpacing: 2 }}>
              {name.toUpperCase()}
            </div>
          </div>

          {/* Status card */}
          <div className="bg-surface border rounded-2xl p-5" style={{ borderColor: `${color}44` }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span style={{ color, fontSize: 18 }}>{symbol}</span>
                  <span className="md-heading text-foreground" style={{ fontSize: 20, fontWeight: 700, letterSpacing: 1 }}>
                    {label.toUpperCase()}
                  </span>
                  {founding_badge && (
                    <span className="px-2 py-0.5 rounded-full text-black md-heading"
                      style={{ background: "#f59e0b", fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>
                      FOUNDING ✦
                    </span>
                  )}
                  {founding_member_number && (
                    <span className="md-heading" style={{ color: "#f59e0b", fontSize: 16, fontWeight: 800 }}>
                      #{padMemberNumber(founding_member_number)}
                    </span>
                  )}
                </div>
                <div className="text-muted" style={{ fontSize: 10 }}>
                  Status: <span style={{ color: isLapsed ? "#ef4444" : "#10b981" }}>
                    {isLapsed ? "Lapsed" : "Active"}
                  </span>
                  {membership_expires_at && !isLapsed && (
                    <span className="ml-3">
                      Renews {new Date(membership_expires_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                    </span>
                  )}
                </div>
              </div>
              {tier === "free" && (
                <Link href="/membership"
                  className="shrink-0 px-4 py-2 rounded-full font-bold transition-all hover:opacity-80"
                  style={{ background: "#3b82f6", color: "#fff", fontSize: 9, letterSpacing: 1, fontFamily: "'IBM Plex Mono', monospace" }}>
                  Become a member →
                </Link>
              )}
            </div>

            {/* Lapsed notice */}
            {isLapsed && (
              <div className="mt-4 p-3 rounded-xl border" style={{ borderColor: "#ef444444", background: "#ef444408" }}>
                <p className="text-foreground" style={{ fontSize: 10, lineHeight: 1.7 }}>
                  Your membership has lapsed. Your{" "}
                  <strong>{token_balance.member + token_balance.founder}</strong> tokens are preserved
                  — renew to start earning again.
                </p>
                <Link href="/membership"
                  className="inline-block mt-2 text-blue-400 hover:text-blue-300 transition-colors underline"
                  style={{ fontSize: 10 }}>
                  Renew membership →
                </Link>
              </div>
            )}
          </div>

          {/* Token balance */}
          <div className="bg-surface border border-border-default rounded-2xl p-5">
            <div className="md-heading text-foreground mb-4" style={{ fontSize: 16, fontWeight: 700, letterSpacing: 1 }}>
              TOKEN BALANCE
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: "Founder",      count: token_balance.founder,      color: "#f59e0b", weight: "2×" },
                { label: "Member",       count: token_balance.member,        color: "#3b82f6", weight: "1×" },
                { label: "Contribution", count: token_balance.contribution,  color: "#10b981", weight: "1×" },
              ].map(({ label: l, count, color: c, weight }) => (
                <div key={l} className="rounded-xl border border-border-default p-3 text-center">
                  <div style={{ fontSize: 22, fontWeight: 700, color: c, fontFamily: "'Barlow Condensed', sans-serif", lineHeight: 1 }}>
                    {count}
                  </div>
                  <div className="text-muted mt-1" style={{ fontSize: 8, letterSpacing: 0.5 }}>{l.toUpperCase()}</div>
                  <div className="text-muted" style={{ fontSize: 8 }}>weight {weight}</div>
                </div>
              ))}
            </div>
            <div className="border-t border-border-default pt-3 flex justify-between items-center">
              <span className="text-muted" style={{ fontSize: 10 }}>Total weighted tokens</span>
              <span className="text-foreground font-bold" style={{ fontSize: 14 }}>{totalTokens}</span>
            </div>
          </div>

          {/* Revenue share */}
          <div className="bg-surface border border-border-default rounded-2xl p-5">
            <div className="md-heading text-foreground mb-3" style={{ fontSize: 16, fontWeight: 700, letterSpacing: 1 }}>
              REVENUE SHARE
            </div>
            {tier === "free" ? (
              <div>
                <p className="text-muted mb-3" style={{ fontSize: 10, lineHeight: 1.7 }}>
                  Your contribution tokens are accumulating. Revenue share distributions require
                  at least one active member or founder token — you&apos;ll have a head-start the moment
                  you become a member.
                </p>
                <Link href="/revenue" className="text-muted hover:text-foreground transition-colors underline" style={{ fontSize: 10 }}>
                  How revenue sharing works →
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted" style={{ fontSize: 10 }}>Next distribution</span>
                  <span className="text-foreground" style={{ fontSize: 10 }}>{nextDist}</span>
                </div>
                {estPayout && (
                  <div className="flex justify-between">
                    <span className="text-muted" style={{ fontSize: 10 }}>Estimated payout (illustrative)</span>
                    <span className="text-foreground font-bold" style={{ fontSize: 12 }}>${estPayout}</span>
                  </div>
                )}
                {pending_credit > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted" style={{ fontSize: 10 }}>Platform credit balance</span>
                    <span style={{ fontSize: 12, color: "#10b981", fontWeight: 700 }}>${pending_credit.toFixed(2)}</span>
                  </div>
                )}
                <Link href="/revenue/distributions" className="text-muted hover:text-foreground transition-colors underline" style={{ fontSize: 10 }}>
                  View past distributions →
                </Link>
              </div>
            )}
          </div>

          {/* Share card (for paid members) */}
          {tier !== "free" && (
            <ShareCard tier={tier} memberNumber={founding_member_number} memberName={name} />
          )}

          {/* Gift a membership (for paid members) */}
          {tier !== "free" && (
            <GiftSection userId={activePersonId} />
          )}

          {/* Manage subscription */}
          {tier === "annual" && stripe_customer_id && (
            <div className="bg-surface border border-border-default rounded-2xl p-5">
              <div className="md-heading text-foreground mb-3" style={{ fontSize: 16, fontWeight: 700, letterSpacing: 1 }}>
                MANAGE SUBSCRIPTION
              </div>
              <p className="text-muted mb-4" style={{ fontSize: 10, lineHeight: 1.7 }}>
                Update your payment method, view invoices, or cancel — all through Stripe&apos;s secure portal.
              </p>
              <button
                onClick={() => openStripePortal(stripe_customer_id!)}
                className="px-5 py-2 rounded-full border border-border-default text-muted hover:text-foreground hover:border-foreground transition-all"
                style={{ fontSize: 10, letterSpacing: 1, background: "none", cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace" }}>
                Manage billing →
              </button>
            </div>
          )}

          {/* Contribution tokens note (free tier) */}
          {tier === "free" && token_balance.contribution > 0 && (
            <div className="p-4 rounded-xl border" style={{ borderColor: "#10b98130", background: "#10b98108" }}>
              <p style={{ fontSize: 10, lineHeight: 1.7, color: "var(--foreground)" }}>
                <span style={{ color: "#10b981", fontWeight: 700 }}>
                  {token_balance.contribution} contribution token{token_balance.contribution !== 1 ? "s" : ""} earned.
                </span>{" "}
                These tokens count toward your revenue share when you become a member.
              </p>
            </div>
          )}

          {/* Back links */}
          <div className="flex gap-4 pt-2" style={{ fontSize: 10 }}>
            <CommunityLink href="/profile" className="text-muted hover:text-foreground transition-colors">← Profile</CommunityLink>
            <Link href="/membership" className="text-muted hover:text-foreground transition-colors">Membership options →</Link>
            <Link href="/revenue" className="text-muted hover:text-foreground transition-colors">Revenue sharing →</Link>
          </div>

        </div>
      </div>
    </>
  )
}

// ─── Page export — Suspense wrapper required for useSearchParams ──────────────

export default function MembershipDashboardPage() {
  return (
    <Suspense>
      <MembershipDashboard />
    </Suspense>
  )
}
