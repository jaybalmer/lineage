import { redirect } from "next/navigation"
import { requireEditor, getServiceClient } from "@/lib/auth"
import { ClaimsAdminClient, type ClaimRequestWithContext } from "./claims-client"
import type { ClaimRequest } from "@/types"

export const dynamic = "force-dynamic"

export default async function AdminClaimsPage() {
  const { response } = await requireEditor()
  if (response) {
    // requireEditor returns 401 NextResponse for unauth, 403 for non-editor.
    // Pages can't return raw NextResponse, so redirect anon to onboarding
    // and forbidden users back to the home admin page.
    if (response.status === 401) redirect("/onboarding")
    redirect("/admin")
  }

  const db = getServiceClient()

  const { data: rows, error } = await db
    .from("claim_requests")
    .select("*")
    .in("status", ["pending", "vouched"])
    .order("created_at", { ascending: true })

  if (error) {
    return (
      <div className="min-h-screen bg-background p-8 text-sm text-red-400">
        Failed to load claim requests: {error.message}
      </div>
    )
  }

  const requests = (rows ?? []) as ClaimRequest[]
  const claimantIds = Array.from(new Set(requests.map((r) => r.claimant_id)))
  const nodeIds = Array.from(new Set(requests.map((r) => r.node_id)))

  const [{ data: profiles }, { data: people }] = await Promise.all([
    claimantIds.length
      ? db.from("profiles").select("id, display_name, avatar_url").in("id", claimantIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string; avatar_url: string | null }[] }),
    nodeIds.length
      ? db.from("people").select("id, display_name, node_status").in("id", nodeIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string; node_status: string }[] }),
  ])

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))
  const peopleMap = new Map((people ?? []).map((p) => [p.id, p]))

  // Pull voucher display names in one shot
  const voucherIds = Array.from(
    new Set(requests.flatMap((r) => (r.vouches_received ?? []).map((v) => v.voucher_id))),
  )
  const { data: voucherProfiles } = voucherIds.length
    ? await db.from("profiles").select("id, display_name").in("id", voucherIds)
    : { data: [] as { id: string; display_name: string }[] }
  const voucherNameMap = new Map((voucherProfiles ?? []).map((p) => [p.id, p.display_name as string]))

  const enriched: ClaimRequestWithContext[] = requests.map((r) => ({
    ...r,
    claimant: profileMap.get(r.claimant_id) ?? { id: r.claimant_id, display_name: "Unknown", avatar_url: null },
    person: peopleMap.get(r.node_id) ?? { id: r.node_id, display_name: r.node_id, node_status: "unknown" },
    voucher_names: (r.vouches_received ?? []).map((v) => voucherNameMap.get(v.voucher_id) ?? v.voucher_id),
  }))

  return <ClaimsAdminClient initialRequests={enriched} />
}
