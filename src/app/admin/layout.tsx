import type { ReactNode } from "react"
import { requireEditorPage } from "@/lib/auth"

// Authoritative server-side gate for the whole /admin/* tree: dataset editor,
// tag-queue, activity, results-scanner, claims, asserters. requireEditorPage()
// redirects non-editors before any admin HTML/JS is sent to the browser, so the
// editor UI is never exposed to anonymous or unauthorized visitors. Individual
// API routes still enforce their own checks (requireEditor / requireModerator).
export const dynamic = "force-dynamic"

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireEditorPage()
  return <>{children}</>
}
