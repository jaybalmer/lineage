"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useLineageStore, isAuthUser } from "@/store/lineage-store"
import ConnectionsPage from "@/app/(community)/[community]/connections/page"

// /me/connections is the canonical global-scope URL for the viewer's connections
// (PB-011 Phase 3A). The connections page is already cross-community, so we render
// it directly. Unlike the profile page it does not self-gate (it is a public browse
// page under /{slug}/connections). The proxy already gates the whole /me/* namespace
// to /onboarding for logged-out users; this client-side check mirrors that same target
// so a soft navigation (where the proxy does not run) keeps /me/connections member-only.
export default function MeConnectionsPage() {
  const router = useRouter()
  const authReady = useLineageStore((s) => s.authReady)
  const activePersonId = useLineageStore((s) => s.activePersonId)

  useEffect(() => {
    if (authReady && !isAuthUser(activePersonId)) router.replace("/onboarding")
  }, [authReady, activePersonId, router])

  return <ConnectionsPage />
}
