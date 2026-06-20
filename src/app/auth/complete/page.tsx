"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useLineageStore } from "@/store/lineage-store"
import { supabase } from "@/lib/supabase"
import { trackEvent, identifyUser } from "@/lib/analytics"
import { BrandMark } from "@/components/ui/brand-mark"
import { safeReturnTo } from "@/lib/safe-redirect"
import type { User } from "@supabase/supabase-js"

export default function AuthCompletePage() {
  const router = useRouter()
  const store = useLineageStore()
  const activeCommunitySlug = useLineageStore((s) => s.activeCommunitySlug)
  const [status, setStatus] = useState("Signing you in…")

  useEffect(() => {
    let handled = false

    // BUG-054: honor a validated returnTo (set by the sign-in entry and carried
    // through the callback / magic-link hop) after login, defaulting to My
    // Timeline when absent. Preserved on the expiry bounce so a re-attempt lands
    // in the right place too.
    const returnTo = safeReturnTo(new URLSearchParams(window.location.search).get("returnTo"))
    const expiredUrl = `/auth/signin?error=link_expired${returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ""}`

    async function saveAndRedirect(user: User) {
      if (handled) return
      handled = true

      setStatus("Saving your linestry…")

      // Stitch the anonymous FTUE funnel to this user before any identified
      // events fire, so signup_succeeded / ftue_completed attribute correctly.
      identifyUser(user.id)

      // Read state directly from the persisted store, not the render-time
      // closure. The closured `store` snapshot can hold an initial empty
      // sessionClaims array if Zustand persist hydration completed after
      // first render — which silently skips the migrate. getState() reads
      // live state at the moment we need it.
      const { onboarding, sessionClaims } = useLineageStore.getState()

      // ── 1. Profile upsert (new users only) ────────────────────────────────
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .single()

      if (!existingProfile) {
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
        else trackEvent("auth", "signup_succeeded", {}, { actorId: user.id })
      }

      // ── 2. Migrate session claims ─────────────────────────────────────────
      if (sessionClaims.length > 0) {
        const migrated = sessionClaims.map((claim) => ({
          ...claim,
          subject_id:   user.id,
          asserted_by:  user.id,
        }))
        const { error } = await supabase.from("claims").insert(migrated)
        if (error) console.error("Migrate session claims failed:", error)
        else store.clearSessionClaims()
      }

      // ── 3. Invite claim (email-invite flow) ───────────────────────────────
      // Finish an email invite if one is pending. The binding happens
      // server-side on the verified session email, so it works no matter where
      // the magic link was opened (a new tab or a different device both wipe the
      // browser storage the old inline merge depended on). A stored token is
      // still forwarded for the same-browser / different-signup-email cases. The
      // route restores the invited name onto the profile, fixing the
      // email-placeholder bug, and deletes the ghost before claim-complete runs.
      try {
        setStatus("Linking your profile…")
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

        await fetch("/api/invite/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(inviteToken ? { token: inviteToken } : {}),
        })

        try {
          localStorage.removeItem("lineage_invite_token")
          sessionStorage.removeItem("lineage_claim_prefill")
        } catch { /* storage not available */ }
      } catch (mergeErr) {
        console.error("Invite claim error:", mergeErr)
      }

      // ── 4. Public tag-to-claim completion (PB-010 Phase 4b) ───────────────
      // If this email was publicly tagged on someone's timeline (a Phase 4a
      // "I was there" ghost), promote that ghost into this account: repoint its
      // claims here, flip the paired tags to attributed, and remove the ghost.
      // The route is keyed server-side on the authenticated email, so it is safe
      // to call for everyone — it no-ops for a normal signup with no pending tag.
      try {
        setStatus("Claiming your spot…")
        await fetch("/api/public/claim-complete", { method: "POST" })
      } catch (claimErr) {
        console.error("Public claim completion error:", claimErr)
      }

      // ── 5. Read canonical profile back from DB ────────────────────────────
      // Read AFTER the claims above so a restored invited name lands in the
      // store on this same load — no refresh needed for the right name to show.
      const { data: savedProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()

      store.setProfileOverride({
        display_name:   savedProfile?.display_name  ?? onboarding.display_name?.trim(),
        birth_year:     savedProfile?.birth_year    ?? onboarding.birth_year,
        riding_since:   savedProfile?.riding_since  ?? onboarding.start_year,
        privacy_level: (savedProfile?.privacy_level ?? "public") as "private" | "shared" | "public",
      })
      store.setActivePersonId(user.id)
      store.completeOnboarding()
      // Only a brand-new account completes the FTUE funnel here. A returning
      // user landing on /auth/complete (magic-link or Google sign-in) already
      // finished onboarding, so firing ftue_completed for them would inflate
      // the funnel's final step. signup_succeeded above is already gated the
      // same way.
      if (!existingProfile) {
        trackEvent("ftue", "ftue_completed", {}, { actorId: user.id })
      }

      // Mark welcome explosion as pending — profile page picks this up and fires it
      if (!existingProfile) {
        store.setTriggerPrefs({ welcome_pending: true })
      }

      setStatus("Done! Opening your linestry…")
      router.replace(returnTo ?? `/${activeCommunitySlug}/profile`)
    }

    // ── Timeout: never hang indefinitely ──────────────────────────────────
    const timeout = setTimeout(() => {
      if (!handled) router.replace(expiredUrl)
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
      router.replace(expiredUrl)
    }

    init().catch(() => { if (!handled) router.replace(expiredUrl) })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="animate-pulse text-accent flex justify-center"><BrandMark size={30} /></div>
        <div className="text-muted text-sm">{status}</div>
      </div>
    </div>
  )
}
