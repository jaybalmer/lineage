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

      // 1. Upsert profile
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

      // 3. Apply profile override and set real activePersonId
      store.setProfileOverride({
        display_name: onboarding.display_name?.trim(),
        birth_year: onboarding.birth_year,
        riding_since: onboarding.start_year,
      })
      store.setActivePersonId(user.id)
      store.completeOnboarding()

      setStatus("Done! Opening your lineage…")
      router.replace("/timeline")
    }

    saveAndRedirect()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="text-blue-400 text-3xl animate-pulse">⬡</div>
        <div className="text-zinc-400 text-sm">{status}</div>
      </div>
    </div>
  )
}
