"use client"

import { useEffect } from "react"
import { useLineageStore } from "@/store/lineage-store"
import { supabase } from "@/lib/supabase"
import type { ProfileLink } from "@/types"

// ── Module-level helper (no hooks — reads/writes store via getState) ──────────
async function loadProfileAndMembership(uid: string) {
  const { setProfileOverride, setMembership, membership } = useLineageStore.getState()

  // Fetch via /api/me which uses the service role key — bypasses RLS entirely.
  // Direct browser-client reads of profiles can silently return null if RLS
  // policies don't permit the anon/user key to read certain columns.
  const res = await fetch("/api/me")
  if (!res.ok) return
  const { profile } = await res.json() as { uid: string; profile: Record<string, unknown> }
  if (!profile) return

  const p = profile  // already Record<string, unknown> from /api/me

  setProfileOverride({
    display_name:   p.display_name   as string  | undefined ?? undefined,
    birth_year:     p.birth_year     as number  | undefined ?? undefined,
    riding_since:   p.riding_since   as number  | undefined ?? undefined,
    privacy_level:  ((p.privacy_level ?? "public") as "private" | "shared" | "public"),
    bio:            p.bio            as string  | undefined ?? undefined,
    links:          p.links          as ProfileLink[] | undefined ?? undefined,
    home_resort_id: p.home_resort_id as string  | undefined ?? undefined,
    city:           p.city           as string  | undefined ?? undefined,
    region:         p.region         as string  | undefined ?? undefined,
    country:        p.country        as string  | undefined ?? undefined,
    avatar_url:     p.avatar_url     as string  | undefined ?? undefined,
    card_bg_url:    p.card_bg_url    as string  | undefined ?? undefined,
  })

  // is_editor: true if DB column set OR if tier is founding
  const dbTier        = (p.membership_tier as string) ?? "free"
  const isEditorFromDb = !!p.is_editor
  const isEditorByTier = dbTier === "founding"
  setMembership({ is_editor: isEditorFromDb || isEditorByTier })

  if (dbTier !== "free" || p.token_founder || p.token_member) {
    setMembership({
      tier:                   dbTier as "free" | "annual" | "lifetime" | "founding",
      status:                 ((p.membership_status ?? "active") as "active" | "expired" | "gifted"),
      founding_badge:          (p.founding_badge as boolean) ?? false,
      founding_member_number:  p.founding_member_number as number | undefined ?? undefined,
      token_balance: {
        founder:      (p.token_founder      as number) ?? 0,
        member:       (p.token_member       as number) ?? 0,
        contribution: (p.token_contribution as number) ?? membership.token_balance.contribution,
      },
      stripe_customer_id:      p.stripe_customer_id     as string | undefined ?? undefined,
      stripe_subscription_id:  p.stripe_subscription_id as string | undefined ?? undefined,
      membership_expires_at:   p.membership_expires_at  as string | undefined ?? undefined,
      pending_credit:          (p.pending_credit as number) ?? 0,
    })
  }
}

/**
 * Invisible component mounted at the root layout level.
 * 1. Loads the shared entity catalog (mock + Supabase public tables)
 * 2. Syncs activePersonId + membership with the live Supabase auth session on mount.
 * 3. Listens for auth state changes to handle sign-in and sign-out reactively.
 *
 * Auth design:
 * - getUser() (effect #2) is the AUTHORITATIVE check — it validates the JWT
 *   server-side, and if the access token is expired, Supabase auto-refreshes
 *   via the refresh token. authReady is set to true once it resolves.
 * - Protected pages must wait for authReady before redirecting, so a user with
 *   an expired-but-refreshable JWT is never kicked out prematurely.
 * - INITIAL_SESSION with null is intentionally NOT used to clear state — it
 *   fires before token refresh, causing false sign-outs on stale JWTs.
 */
export function CatalogLoader() {
  const {
    loadCatalog,
    setActivePersonId,
    setProfileOverride,
    setAuthReady,
    completeOnboarding,
  } = useLineageStore()

  // ── 1. Load public catalog ───────────────────────────────────────────────
  useEffect(() => {
    loadCatalog()
  }, [loadCatalog])

  // ── 2. Server-validated auth check on mount ──────────────────────────────
  useEffect(() => {
    async function syncSession() {
      const { data: { user } } = await supabase.auth.getUser()
      const uid = user?.id

      if (!uid) {
        // Genuinely no valid session (refresh token also gone or invalid)
        setActivePersonId("")
        setProfileOverride({})
        setAuthReady(true)
        return
      }

      // Always re-fetch profile on mount so persisted store values (e.g. is_editor,
      // membership tier) are never stale after a DB change.
      await loadProfileAndMembership(uid)
      if (useLineageStore.getState().activePersonId !== uid) {
        setActivePersonId(uid)
        completeOnboarding()
      }
      setAuthReady(true)
    }

    syncSession()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 3. Reactive auth state changes ───────────────────────────────────────
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // SIGNED_OUT is the only event that clears auth state here.
      // We deliberately ignore INITIAL_SESSION with null — it fires before
      // the Supabase client has had a chance to use the refresh token,
      // so reacting to it would sign out users with valid refresh tokens.
      if (event === "SIGNED_OUT") {
        setActivePersonId("")
        setProfileOverride({})
        return
      }

      // SIGNED_IN / TOKEN_REFRESHED — update the active user
      const uid = session?.user?.id
      if (!uid) return
      if (useLineageStore.getState().activePersonId === uid) return

      await loadProfileAndMembership(uid)
      setActivePersonId(uid)
      completeOnboarding()
    })

    return () => subscription.unsubscribe()
  }, [setActivePersonId, setProfileOverride, completeOnboarding]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
