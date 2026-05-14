import { redirect } from "next/navigation"
import { requireModerator } from "@/lib/auth"
import { AsserterRapSheetClient } from "./asserter-rap-sheet-client"

// PB-009 Phase 3 — asserter rap sheet.
//
// Server component resolves auth via requireModerator() (tighter than
// requireEditor — founding alone is not enough). Client fetches the
// rap-sheet payload after mount so the editor can refresh by reload.

export const dynamic = "force-dynamic"

export default async function AsserterRapSheetPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const auth = await requireModerator()
  if (auth.response) {
    if (auth.response.status === 401) redirect("/onboarding")
    redirect("/admin")
  }
  const { id } = await params
  return <AsserterRapSheetClient asserterId={id} />
}
