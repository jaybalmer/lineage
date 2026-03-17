"use client"

import { useEffect } from "react"
import { useLineageStore, isAuthUser } from "@/store/lineage-store"
import { supabase } from "@/lib/supabase"

/**
 * Invisible component mounted at the root layout level.
 * 1. Loads the shared entity catalog (mock + Supabase public tables)
 * 2. Syncs activePersonId + membership with the live Supabase auth session on mount.
 * 3. Listens for auth state changes to handle sign-in and sign-out reactively.
 */
export function CatalogLoader() {
  const { loadCatalog, activePersonId, setActivePersonId, setProfileOverride, setMembership, completeOnboarding } = useLineageStore()

  // ── 1. Load public catalog ───────────────────────────────────────────────
  useEffect(() => {
    loadCatalog()
  }, [loadCatalog])

  // ── 2. Sync auth session → activePersonId + membership on mount ──────────
  // Uses getUser() (server-validated) rather than getSession() (local cache)
  // so that expired JWTs are refreshed via the refresh token, or properly
  // signed out, rather than leaving stale UUIDs in the store.
  useEffect(() => {
    async function syncSession() {
      const { data: { user } } = await supabase.auth.getUser()
      const uid = user?.id

      if (!uid) {
        // No valid session — clear any stale auth state from Zustand
        if (activePersonId) {
          setActivePersonId("")
          setProfileOverride({})
        }
        return
      }

      if (activePersonId === uid) return  // already in sync

      await loadProfileAndMembership(uid)
      setActivePersonId(uid)
      completeOnboarding()
    }

    syncSession()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 3. Reactive auth state changes (sign-in / sign-out) ──────────────────
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Clear stale state on sign-out or when the initial session check finds no user
      if (event === "SIGNED_OUT" || (event === "INITIAL_SESSION" && !session)) {
        setActivePersonId("")
        setProfileOverride({})
        return
      }

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

  // ── Helper: load profile + membership fields from Supabase ───────────────
  async function loadProfileAndMembership(uid: string) {
    const { data: profile } = await supabase
      .from("profiles")
      .select(`
        display_name, birth_year, riding_since, privacy_level,
        bio, links, home_resort_id,
        membership_tier, membership_status, founding_badge, founding_member_number,
        token_founder, token_member, token_contribution,
        stripe_customer_id, stripe_subscription_id, membership_expires_at, pending_credit
      `)
      .eq("id", uid)
      .single()

    if (!profile) return

    setProfileOverride({
      display_name:    profile.display_name  ?? undefined,
      birth_year:      profile.birth_year    ?? undefined,
      riding_since:    profile.riding_since  ?? undefined,
      privacy_level:   (profile.privacy_level ?? "public") as "private" | "shared" | "public",
      bio:             (profile as Record<string, unknown>).bio             as string | undefined ?? undefined,
      links:           (profile as Record<string, unknown>).links           as import("@/types").ProfileLink[] | undefined ?? undefined,
      home_resort_id:  (profile as Record<string, unknown>).home_resort_id as string | undefined ?? undefined,
    })

    // Only update membership if DB has a non-free tier (respect local contribution tokens otherwise)
    const dbTier = profile.membership_tier ?? "free"
    if (dbTier !== "free" || profile.token_founder || profile.token_member) {
      setMembership({
        tier:                    dbTier as "free" | "annual" | "lifetime" | "founding",
        status:                  (profile.membership_status ?? "active") as "active" | "expired" | "gifted",
        founding_badge:          profile.founding_badge ?? false,
        founding_member_number:  profile.founding_member_number ?? undefined,
        token_balance: {
          founder:      profile.token_founder      ?? 0,
          member:       profile.token_member       ?? 0,
          contribution: profile.token_contribution ?? useLineageStore.getState().membership.token_balance.contribution,
        },
        stripe_customer_id:     profile.stripe_customer_id     ?? undefined,
        stripe_subscription_id: profile.stripe_subscription_id ?? undefined,
        membership_expires_at:  profile.membership_expires_at  ?? undefined,
        pending_credit:         profile.pending_credit         ?? 0,
      })
    }
  }
}
