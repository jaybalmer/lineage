"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

interface InviteRecord {
  id: string
  person_id: string
  person_name: string
  inviter_name: string
  predicate: string
  claimed_at: string | null
  expires_at: string
  riding_since?: number | null
}

// Map predicate → friendly verb
const PREDICATE_VERBS: Record<string, string> = {
  rode_with: "rode with",
  coached_by: "was coached by",
  shot_by: "was filmed by",
}

export default function ClaimPage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()
  const [invite, setInvite] = useState<InviteRecord | null>(null)
  const [person, setPerson] = useState<{ riding_since?: number | null } | null>(null)
  const [status, setStatus] = useState<"loading" | "valid" | "expired" | "claimed" | "error">("loading")

  useEffect(() => {
    if (!token) return

    async function loadInvite() {
      const { data, error } = await supabase
        .from("invites")
        .select("*")
        .eq("id", token)
        .single()

      if (error || !data) {
        setStatus("error")
        return
      }

      if (data.claimed_at) {
        setStatus("claimed")
        setInvite(data as InviteRecord)
        return
      }

      const expiresAt = new Date(data.expires_at)
      if (expiresAt < new Date()) {
        setStatus("expired")
        setInvite(data as InviteRecord)
        return
      }

      setInvite(data as InviteRecord)

      // Try to load person details for riding_since
      const { data: personData } = await supabase
        .from("people")
        .select("riding_since")
        .eq("id", data.person_id)
        .single()

      if (personData) setPerson(personData)

      setStatus("valid")
    }

    loadInvite()
  }, [token])

  function handleClaim() {
    if (!invite) return

    // Store prefill data for onboarding
    try {
      sessionStorage.setItem(
        "lineage_claim_prefill",
        JSON.stringify({
          display_name: invite.person_name,
          riding_since: person?.riding_since ?? null,
          invite_token: token,
          inviter_name: invite.inviter_name,
        })
      )
    } catch {
      // sessionStorage may not be available
    }

    router.push("/onboarding")
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-blue-400 text-3xl animate-pulse">⬡</div>
          <p className="text-muted text-sm">Loading your invite…</p>
        </div>
      </div>
    )
  }

  // ── Error / Not found ────────────────────────────────────────────────────────
  if (status === "error") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="text-4xl">🔍</div>
          <h1 className="text-xl font-bold text-foreground">Invite not found</h1>
          <p className="text-sm text-muted">This invite link doesn&apos;t exist or may have been removed.</p>
          <button
            onClick={() => router.push("/")}
            className="mt-4 px-6 py-2.5 rounded-xl bg-surface-hover border border-border-default text-sm text-foreground hover:bg-surface-active transition-colors"
          >
            Go to Lineage
          </button>
        </div>
      </div>
    )
  }

  // ── Expired ──────────────────────────────────────────────────────────────────
  if (status === "expired") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="text-4xl">⏳</div>
          <h1 className="text-xl font-bold text-foreground">This invite has expired</h1>
          <p className="text-sm text-muted">
            {invite?.inviter_name} can send you a new invite from their Lineage profile.
          </p>
          <button
            onClick={() => router.push("/")}
            className="mt-4 px-6 py-2.5 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
          >
            Visit Lineage
          </button>
        </div>
      </div>
    )
  }

  // ── Already claimed ──────────────────────────────────────────────────────────
  if (status === "claimed") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="text-4xl">✅</div>
          <h1 className="text-xl font-bold text-foreground">Profile already claimed</h1>
          <p className="text-sm text-muted">
            Someone has already claimed this profile. If that was you, sign in to see your lineage.
          </p>
          <button
            onClick={() => router.push("/onboarding")}
            className="mt-4 px-6 py-2.5 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
          >
            Sign in
          </button>
        </div>
      </div>
    )
  }

  // ── Valid invite ─────────────────────────────────────────────────────────────
  const verb = PREDICATE_VERBS[invite?.predicate ?? ""] ?? "rode with"

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-sm w-full space-y-6">

        {/* Logo */}
        <div className="text-center space-y-1">
          <div className="text-4xl">⬡</div>
          <p className="text-xs font-semibold text-muted uppercase tracking-widest">Lineage</p>
        </div>

        {/* Card */}
        <div className="bg-surface border border-border-default rounded-2xl overflow-hidden">

          {/* Invite context */}
          <div className="px-5 pt-5 pb-4 border-b border-border-default">
            <p className="text-sm text-muted leading-relaxed">
              <span className="text-foreground font-semibold">{invite?.inviter_name}</span>{" "}
              {verb} you — at least, that&apos;s what they put in their timeline.
            </p>
          </div>

          {/* Person preview */}
          <div className="px-5 py-4 flex items-center gap-4">
            {/* Avatar */}
            <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-base font-bold text-white shrink-0">
              {invite?.person_name?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div>
              <p className="font-bold text-foreground">{invite?.person_name}</p>
              {person?.riding_since && (
                <p className="text-xs text-muted mt-0.5">Riding since {person.riding_since}</p>
              )}
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="text-[10px] bg-amber-900/30 text-amber-600 border border-amber-900/50 rounded px-1.5 py-0.5">
                  unverified
                </span>
                <span className="text-[10px] text-muted">· added by {invite?.inviter_name}</span>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="px-5 pb-4">
            <p className="text-xs text-muted leading-relaxed">
              Lineage is a snowboard history app — your quiver, the mountains you&apos;ve ridden, and the crew you&apos;ve ridden with.
              Claim this profile to verify {invite?.inviter_name}&apos;s connection and start building your own lineage.
            </p>
          </div>

          {/* CTA */}
          <div className="px-5 pb-5 space-y-2">
            <button
              onClick={handleClaim}
              className="w-full py-3 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
            >
              Claim my profile →
            </button>
            <button
              onClick={() => router.push("/onboarding")}
              className="w-full py-2 text-xs text-muted hover:text-foreground transition-colors"
            >
              I already have an account — sign in
            </button>
          </div>
        </div>

        <p className="text-center text-[10px] text-muted">
          Not {invite?.person_name}? You can ignore this message.
        </p>
      </div>
    </div>
  )
}
