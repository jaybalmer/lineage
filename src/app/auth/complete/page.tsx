"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useLineageStore } from "@/store/lineage-store"
import { supabase } from "@/lib/supabase"

export default function AuthCompletePage() {
  const router = useRouter()
  const store = useLineageStore()
  const [status, setStatus] = useState("Saving your lineage…")

  useEffect(() => {
    async function saveAndRedirect() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace("/onboarding?error=no_session")
        return
      }

      const { onboarding } = store

      // 1. Check if profile already exists (returning user via magic link)
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id, display_name")
        .eq("id", user.id)
        .single()

      if (!existingProfile) {
        // New user — upsert with onboarding data
        const { error: profileError } = await supabase.from("profiles").upsert({
          id: user.id,
          display_name:
            onboarding.display_name?.trim() ||
            user.email?.split("@")[0] ||
            "Rider",
          birth_year: onboarding.birth_year ?? null,
          riding_since: onboarding.start_year ?? null,
          privacy_level: "public",
          home_resort_id: onboarding.first_place_id ?? null,
        })
        if (profileError) {
          console.error("Profile save failed:", profileError)
        }
      }
      // Returning user — skip upsert, profile is already correct in DB

      // 2. Migrate any session claims to DB
      if (store.sessionClaims.length > 0) {
        const migratedClaims = store.sessionClaims.map((claim) => ({
          ...claim,
          subject_id: user.id,
          asserted_by: user.id,
        }))

        const { error: claimsError } = await supabase
          .from("claims")
          .insert(migratedClaims)

        if (!claimsError) {
          store.clearSessionClaims()
        }
      }

      // 3. Read the saved profile back from DB so we always get canonical values
      // (onboarding data may be empty if magic link opened on a different origin)
      const { data: savedProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()

      store.setProfileOverride({
        display_name: savedProfile?.display_name ?? onboarding.display_name?.trim(),
        birth_year: savedProfile?.birth_year ?? onboarding.birth_year,
        riding_since: savedProfile?.riding_since ?? onboarding.start_year,
        privacy_level: (savedProfile?.privacy_level ?? "public") as "private" | "shared" | "public",
      })
      store.setActivePersonId(user.id)
      store.completeOnboarding()

      // 4. Merge rider_xxx record if arriving via invite claim
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
            .from("invites")
            .select("*")
            .eq("id", inviteToken)
            .single()

          if (invite && !invite.claimed_at) {
            const oldId = invite.person_id as string

            // Migrate all claims where the rider_xxx is subject or object
            await supabase.from("claims").update({ subject_id: user.id }).eq("subject_id", oldId)
            await supabase.from("claims").update({ object_id: user.id }).eq("object_id", oldId)

            // Mark invite as claimed
            await supabase
              .from("invites")
              .update({ claimed_at: new Date().toISOString(), claimed_by: user.id })
              .eq("id", inviteToken)

            // Remove the stale unverified person entry
            await supabase.from("people").delete().eq("id", oldId)
          }

          try {
            localStorage.removeItem("lineage_invite_token")
            sessionStorage.removeItem("lineage_claim_prefill")
          } catch { /* storage not available */ }
        }
      } catch (mergeErr) {
        console.error("Invite merge error:", mergeErr)
        // Non-fatal — don't block the redirect
      }

      setStatus("Done! Opening your lineage…")
      router.replace("/profile")
    }

    saveAndRedirect()
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
