import { redirect } from "next/navigation"
import { requireModerator } from "@/lib/auth"
import { TagQueueClient } from "./tag-queue-client"

// PB-009 Phase 3 — editor moderation queue.
//
// Same structural pattern as src/app/admin/claims/page.tsx: server component
// resolves auth, redirects on 401→/onboarding and 403→/admin. Client
// component handles all state + interactions. Initial data is fetched
// client-side after mount so a moderator can refresh by reload.
//
// PB-009 Phase 4+: auto-surfacing (high-volume asserters, blocklist patterns)
// lands here. Phase 3 manual reports only.

export const dynamic = "force-dynamic"

export default async function AdminTagQueuePage() {
  const auth = await requireModerator()
  if (auth.response) {
    if (auth.response.status === 401) redirect("/onboarding")
    redirect("/admin")
  }
  return <TagQueueClient />
}
