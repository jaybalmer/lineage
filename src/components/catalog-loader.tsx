"use client"

import { useEffect } from "react"
import { useLineageStore, isAuthUser } from "@/store/lineage-store"
import { supabase } from "@/lib/supabase"

/**
 * Invisible component mounted at the root layout level.
 * 1. Loads the shared entity catalog (mock + Supabase public tables)
 * 2. Syncs activePersonId with the live Supabase auth session on mount so
 *    returning users get the right identity without signing in again.
 * 3. Listens for auth state changes to handle sign-in and sign-out reactively.
 */
export function CatalogLoader() {
  const { loadCatalog, activePersonId, setActivePersonId, setProfileOverride, completeOnboarding } = useLineageStore()

  // ── 1. Load public catalog ───────────────────────────────────────────────
  useEffect(() => {
    loadCatalog()
  }, [loadCatalog])

  // ── 2. Sync auth session → activePersonId on mount ──────────────────────
  useEffect(() => {
    async function syncSession() {
      const { data: { session } } = await supabase.auth.getSession()
      const uid = session?.user?.id

      if (!uid) {
        // No session — if activePersonId is a stale non-auth value, clear it
        if (activePersonId && !isAuthUser(activePersonId)) {
          setActivePersonId("")
        }
        return
      }

      if (activePersonId === uid) return  // already in sync

      // Session exists but store has a stale ID — load profile and fix it
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
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 3. Reactive auth state changes (sign-in / sign-out) ──────────────────
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        setActivePersonId("")
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
