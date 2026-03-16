"use client"

import { useEffect } from "react"
import { useLineageStore, isAuthUser } from "@/store/lineage-store"
import { supabase } from "@/lib/supabase"

/**
 * Invisible component mounted at the root layout level.
 * 1. Loads the shared entity catalog (mock + Supabase public tables)
 * 2. Syncs the active person ID with the live Supabase auth session so that
 *    a user with a valid cookie but a stale "u1" in localStorage gets fixed
 *    automatically — no sign-out/sign-in required.
 */
export function CatalogLoader() {
  const { loadCatalog, activePersonId, setActivePersonId, setProfileOverride, completeOnboarding } = useLineageStore()

  // ── 1. Load public catalog ───────────────────────────────────────────────
  useEffect(() => {
    loadCatalog()
  }, [loadCatalog])

  // ── 2. Sync auth session → activePersonId ───────────────────────────────
  useEffect(() => {
    async function syncSession() {
      const { data: { session } } = await supabase.auth.getSession()
      const uid = session?.user?.id
      if (!uid) return                       // not logged in
      if (activePersonId === uid) return     // already in sync

      // activePersonId is stale (probably "u1") — fix it
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, birth_year, riding_since, privacy_level")
        .eq("id", uid)
        .single()

      if (profile) {
        setProfileOverride({
          display_name:  profile.display_name  ?? undefined,
          birth_year:    profile.birth_year    ?? undefined,
          riding_since:  profile.riding_since  ?? undefined,
          privacy_level: (profile.privacy_level ?? "public") as "private" | "shared" | "public",
        })
      }

      setActivePersonId(uid)
      completeOnboarding()
    }

    syncSession()
  }, []) // run once on mount; intentionally omit deps to avoid re-running on store updates

  // ── 3. Keep in sync when auth state changes (sign-in / sign-out) ─────────
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        // Reset to the mock user so the app still works when logged out
        setActivePersonId("u1")
        setProfileOverride({})
        return
      }

      const uid = session?.user?.id
      if (!uid) return
      if (useLineageStore.getState().activePersonId === uid) return

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, birth_year, riding_since, privacy_level")
        .eq("id", uid)
        .single()

      if (profile) {
        setProfileOverride({
          display_name:  profile.display_name  ?? undefined,
          birth_year:    profile.birth_year    ?? undefined,
          riding_since:  profile.riding_since  ?? undefined,
          privacy_level: (profile.privacy_level ?? "public") as "private" | "shared" | "public",
        })
      }

      setActivePersonId(uid)
      completeOnboarding()
    })

    return () => subscription.unsubscribe()
  }, [setActivePersonId, setProfileOverride, completeOnboarding])

  return null
}
