"use client"

import { useEffect } from "react"
import { useLineageStore } from "@/store/lineage-store"
import { supabase } from "@/lib/supabase"
import type { ProfileLink } from "@/types"

// ── Module-level helper (no hooks — reads/writes store via getState) ──────────
async function loadProfileAndMembership(uid: string) {
  const { setProfileOverride, setMembership, membership } = useLineageStore.getState()

  const { data: profile } = await supabase
    .from("profiles")
    .select(`
      display_name, birth_year, riding_since, privacy_level,
      bio, links, home_resort_id, city, region, country, avatar_url, card_bg_url,
      membership_tier, membership_status, founding_badge, founding_member_number,
      token_founder, token_member, token_contribution,
      stripe_customer_id, stripe_subscription_id, membership_expires_at, pending_credit,
      is_editor
    `)
    .eq("id", uid)
    .single()

  if (!profile) return

  setProfileOverride({
    display_name:   profile.display_name  ?? undefined,
    birth_year:     profile.birth_year    ?? undefined,
    riding_since:   profile.riding_since  ?? undefined,
    privacy_level:  (profile.privacy_level ?? "public") as "private" | "shared" | "public",
    bio:            (profile as Record<string, unknown>).bio            as string | undefined ?? undefined,
    links:          (profile as Record<string, unknown>).links          as ProfileLink[] | undefined ?? undefined,
    home_resort_id: (profile as Record<string, unknown>).home_resort_id as string | undefined ?? undefined,
    city:           (profile as Record<string, unknown>).city           as string | undefined ?? undefined,
    region:         (profile as Record<string, unknown>).region         as string | undefined ?? undefined,
    country:        (profile as Record<string, unknown>).country        as string | undefined ?? undefined,
    avatar_url:     (profile as Record<string, unknown>).avatar_url     as string | undefined ?? undefined,
    card_bg_url:    (profile as Record<string, unknown>).card_bg_url    as string | undefined ?? undefined,
  })

  // Always sync is_editor (can be granted independently of membership tier)
  setMembership({ is_editor: (profile as Record<string, unknown>).is_editor === true })

  // Only update membership tier/tokens if DB has a non-free tier (respect local contribution tokens otherwise)
  const dbTier = profile.membership_tier ?? "free"
  if (dbTier !== "free" || profile.token_founder || profile.token_member) {
    setMembership({
      tier:                   dbTier as "free" | "annual" | "lifetime" | "founding",
      status:                 (profile.membership_status ?? "active") as "active" | "expired" | "gifted",
      founding_badge:         profile.founding_badge ?? false,
      founding_member_number: profile.founding_member_number ?? undefined,
      token_balance: {
        founder:      profile.token_founder      ?? 0,
        member:       profile.token_member       ?? 0,
        contribution: profile.token_contribution ?? membership.token_balance.contribution,
      },
      stripe_customer_id:     profile.stripe_customer_id     ?? undefined,
      stripe_subscription_id: profile.stripe_subscription_id ?? undefined,
      membership_expires_at:  profile.membership_expires_at  ?? undefined,
      pending_credit:         profile.pending_credit         ?? 0,
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
