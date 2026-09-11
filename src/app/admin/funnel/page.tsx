import { redirect } from "next/navigation"
import { requireModerator } from "@/lib/auth"
import { FunnelClient } from "./funnel-client"

// Activation, retention, and funnel scoreboard. Same gate pattern as
// src/app/admin/activity/page.tsx: server component resolves auth, redirects on
// 401 to /onboarding and 403 to /admin. The client fetches after mount.

export const dynamic = "force-dynamic"

export default async function AdminFunnelPage() {
  const auth = await requireModerator()
  if (auth.response) {
    if (auth.response.status === 401) redirect("/onboarding")
    redirect("/admin")
  }
  return <FunnelClient />
}
