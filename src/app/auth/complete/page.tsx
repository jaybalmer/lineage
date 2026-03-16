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

    // ── Timeout: never hang indefinitely ──────────────────────────────────
    const timeout = setTimeout(() => {
      if (!handled) router.replace("/auth/signin?error=link_expired")
    }, 10000)

    async function init() {
      // ── 1. PKCE flow: ?code= query param ────────────────────────────────
      // Admin generateLink uses implicit flow, but handle PKCE defensively.
      // Wrap in try/catch — throws if no verifier stored locally.
      const code = new URLSearchParams(window.location.search).get("code")
      if (code) {
        try {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) console.error("PKCE exchange error:", error)
          else if (data.session?.user) { clearTimeout(timeout); saveAndRedirect(data.session.user); return }
        } catch (e) { console.error("exchangeCodeForSession threw:", e) }
      }

      // ── 2. Implicit flow: #access_token hash ────────────────────────────
      const hashParams = new URLSearchParams(window.location.hash.slice(1))
      const accessToken = hashParams.get("access_token")
      const refreshToken = hashParams.get("refresh_token")
      if (accessToken && refreshToken) {
        try {
          const { data, error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
          if (error) console.error("setSession error:", error)
          else if (data.session?.user) { clearTimeout(timeout); saveAndRedirect(data.session.user); return }
        } catch (e) { console.error("setSession threw:", e) }
      }

      // ── 3. createBrowserClient may have auto-processed the URL already ──
      // Poll briefly — the SDK processes tokens asynchronously on init.
      for (let i = 0; i < 10; i++) {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) { clearTimeout(timeout); saveAndRedirect(session.user); return }
        await new Promise(r => setTimeout(r, 300))
      }

      // ── 4. Nothing worked → expired or invalid ───────────────────────────
      clearTimeout(timeout)
      router.replace("/auth/signin?error=link_expired")
    }

    init().catch(() => { if (!handled) router.replace("/auth/signin?error=link_expired") })
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
