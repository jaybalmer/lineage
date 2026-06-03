import { redirect } from "next/navigation"
import { requireModerator } from "@/lib/auth"
import { ActivityClient } from "./activity-client"

// Diagnostics Phase 1: in-app activity feed over analytics_events.
//
// Same structural pattern as src/app/admin/tag-queue/page.tsx: server
// component resolves auth, redirects on 401 to /onboarding and 403 to /admin.
// The client component fetches the feed after mount and handles all filtering.

export const dynamic = "force-dynamic"

export default async function AdminActivityPage() {
  const auth = await requireModerator()
  if (auth.response) {
    if (auth.response.status === 401) redirect("/onboarding")
    redirect("/admin")
  }
  return <ActivityClient />
}
