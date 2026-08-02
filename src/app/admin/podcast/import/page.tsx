import { redirect } from "next/navigation"
import { requireEditor } from "@/lib/auth"
import { PodcastImportClient } from "./import-client"

// Podcast mention import page.
//
// Same structural pattern as src/app/admin/tag-queue/page.tsx: server component
// resolves auth and redirects (401 -> /onboarding, 403 -> /admin), client
// component holds all state. The /admin/* tree is already gated by
// src/app/admin/layout.tsx; this is the per-page check, and
// POST /api/admin/mentions/import enforces its own requireEditor regardless.

export const dynamic = "force-dynamic"

export default async function AdminPodcastImportPage() {
  const auth = await requireEditor()
  if (auth.response) {
    if (auth.response.status === 401) redirect("/onboarding")
    redirect("/admin")
  }
  return <PodcastImportClient />
}
