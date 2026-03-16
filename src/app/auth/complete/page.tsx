"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useLineageStore } from "@/store/lineage-store"
import { supabase } from "@/lib/supabase"
import type { User } from "@supabase/supabase-js"

export default function AuthCompletePage() {
  const router = useRouter()
  const store = useLineageStore()
  const [status, setStatus] = useState("Signing you in…")

  useEffect(() => {
    let handled = false

    async function saveAndRedirect(user: User) {
      if (handled) return
      handled = true

      setStatus("Saving your lineage…")

      // ── 1. Profile upsert (new users only) ────────────────────────────────
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .single()

      if (!existingProfile) {
        const { onboarding } = store
        const { error: profileError } = await supabase.from("profiles").upsert({
          id: user.id,
          display_name:
            onboarding.display_name?.trim() ||
            user.email?.split("@")[0] ||
            "Rider",
          birth_year:     onboarding.birth_year    ?? null,
          riding_since:   onboarding.start_year    ?? null,
          privacy_level:  "public",
          home_resort_id: onboarding.first_place_id ?? null,
        })
        if (profileError) console.error("Profile save failed:", profileError)
      }

      // ── 2. Migrate session claims ─────────────────────────────────────────
      if (store.sessionClaims.length > 0) {
        const migrated = store.sessionClaims.map((claim) => ({
          ...claim,
          subject_id:   user.id,
          asserted_by:  user.id,
        }))
        const { error } = await supabase.from("claims").insert(migrated)
        if (!error) store.clearSessionClaims()
      }

      // ── 3. Read canonical profile back from DB ────────────────────────────
      const { data: savedProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()

      store.setProfileOverride({
        display_name:   savedProfile?.display_name  ?? store.onboarding.display_name?.trim(),
        birth_year:     savedProfile?.birth_year    ?? store.onboarding.birth_year,
        riding_since:   savedProfile?.riding_since  ?? store.onboarding.start_year,
        privacy_level: (savedProfile?.privacy_level ?? "public") as "private" | "shared" | "public",
      })
      store.setActivePersonId(user.id)
      store.completeOnboarding()

      // ── 4. Invite claim merge ─────────────────────────────────────────────
      try {
        let inviteToken: string | null = null
        try {
          inviteToken = localStorage.getItem("lineage_invite_token")
          if (!inviteToken) {
            const prefillRaw = sessionStorage.getItem("lineage_claim_prefill")
            if (prefillRaw) {
              const prefill = JSON.parse(prefillRaw) as { invite_token?: string }
              inviteToken = prefill.invite_token ?? null
            }
          }
        } catch { /* storage not available */ }

        if (inviteToken) {
          setStatus("Linking your profile…")
          const { data: invite } = await supabase
            .from("invites").select("*").eq("id", inviteToken).single()

          if (invite && !invite.claimed_at) {
            const oldId = invite.person_id as string
            await supabase.from("claims").update({ subject_id: user.id }).eq("subject_id", oldId)
            await supabase.from("claims").update({ object_id: user.id }).eq("object_id", oldId)
            await supabase.from("invites")
              .update({ claimed_at: new Date().toISOString(), claimed_by: user.id })
              .eq("id", inviteToken)
            await supabase.from("people").delete().eq("id", oldId)
          }

          try {
            localStorage.removeItem("lineage_invite_token")
            sessionStorage.removeItem("lineage_claim_prefill")
          } catch { /* storage not available */ }
        }
      } catch (mergeErr) {
        console.error("Invite merge error:", mergeErr)
      }

      setStatus("Done! Opening your lineage…")
      router.replace("/profile")
    }

    // ── Primary path: wait for SIGNED_IN from the auth state machine ────────
    // This fires once the Supabase client detects and exchanges the token/code
    // in the URL (hash or query param), however long that takes.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        saveAndRedirect(session.user)
      }
    })

    // ── Fallback: if client already has a session (e.g. page re-mounted) ───
    // getSession() is sync-safe: it reads from the in-memory store.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) saveAndRedirect(session.user)
    })

    // ── Timeout: no session after 8 s → bail out ────────────────────────────
    const timeout = setTimeout(async () => {
      if (handled) return
      // One last try before giving up
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        saveAndRedirect(user)
      } else {
        router.replace("/auth/signin?error=link_expired")
      }
    }, 8000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="text-blue-400 text-3xl animate-pulse">⬡</div>
        <div className="text-muted text-sm">{status}</div>
      </div>
    </div>
  )
}
