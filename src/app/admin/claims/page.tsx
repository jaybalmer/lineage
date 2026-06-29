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
  // claimant_id is null on email-first (public_invite) claims; only look up the
  // member ones (§6.3 null-claimant safety).
  const claimantIds = Array.from(
    new Set(requests.map((r) => r.claimant_id).filter((v): v is string => !!v)),
  )
  const nodeIds = Array.from(new Set(requests.map((r) => r.node_id)))

  const [{ data: profiles }, { data: people }, { data: nodeClaims }] = await Promise.all([
    claimantIds.length
      ? db.from("profiles").select("id, display_name, avatar_url").in("id", claimantIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string; avatar_url: string | null }[] }),
    nodeIds.length
      ? db.from("people").select("id, display_name, node_status, added_by").in("id", nodeIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string; node_status: string; added_by: string | null }[] }),
    // Claim count per node (corroboration signal on the review card, §6.2).
    nodeIds.length
      ? db.from("claims_public").select("subject_id").in("subject_id", nodeIds)
      : Promise.resolve({ data: [] as { subject_id: string }[] }),
  ])

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))
  const peopleMap = new Map((people ?? []).map((p) => [p.id, p]))

  // "Who added the node" display names (§6.2).
  const addedByIds = Array.from(
    new Set((people ?? []).map((p) => p.added_by).filter((v): v is string => !!v)),
  )
  const { data: addedByProfiles } = addedByIds.length
    ? await db.from("profiles").select("id, display_name").in("id", addedByIds)
    : { data: [] as { id: string; display_name: string }[] }
  const addedByNameMap = new Map((addedByProfiles ?? []).map((p) => [p.id, p.display_name as string]))

  const claimCountMap = new Map<string, number>()
  for (const c of (nodeClaims ?? []) as { subject_id: string }[]) {
    claimCountMap.set(c.subject_id, (claimCountMap.get(c.subject_id) ?? 0) + 1)
  }

  // Pull voucher display names in one shot
  const voucherIds = Array.from(
    new Set(requests.flatMap((r) => (r.vouches_received ?? []).map((v) => v.voucher_id))),
  )
  const { data: voucherProfiles } = voucherIds.length
    ? await db.from("profiles").select("id, display_name").in("id", voucherIds)
    : { data: [] as { id: string; display_name: string }[] }
  const voucherNameMap = new Map((voucherProfiles ?? []).map((p) => [p.id, p.display_name as string]))

  const enriched: ClaimRequestWithContext[] = requests.map((r) => {
    const node = peopleMap.get(r.node_id)
    return {
      ...r,
      claimant: r.claimant_id
        ? profileMap.get(r.claimant_id) ?? { id: r.claimant_id, display_name: "Unknown", avatar_url: null }
        : null,
      person: node
        ? { id: node.id, display_name: node.display_name, node_status: node.node_status }
        : { id: r.node_id, display_name: r.node_id, node_status: "unknown" },
      voucher_names: (r.vouches_received ?? []).map((v) => voucherNameMap.get(v.voucher_id) ?? v.voucher_id),
      added_by_name: node?.added_by ? addedByNameMap.get(node.added_by) ?? null : null,
      node_claim_count: claimCountMap.get(r.node_id) ?? 0,
    }
  })

  return <ClaimsAdminClient initialRequests={enriched} />
}
