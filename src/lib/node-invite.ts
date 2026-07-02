import type { SupabaseClient } from "@supabase/supabase-js"
import { claimInviteHtml, sendClaimEmail } from "@/lib/emails/claim-emails"

export type NodeInviteResult =
  | { ok: true; personName: string }
  | { ok: false; reason: "node_not_found" }

// node-claim-by-admin-invite (PR #138). The post-approval steps shared by the
// visitor-submitted approval branch of PATCH /api/claim-requests/[id] and the
// editor-initiated POST /api/admin/invite-node. Stamps the node's invite_email
// so signup can bind on the verified email, flips a catalog node to unclaimed,
// and sends the account-creating invite magic link. Keeping both entry points on
// one helper means invite semantics stay single-sourced: admin-invite-complete
// then folds the node in at signup unchanged, regardless of which path sent it.
//
// Best-effort email: sendClaimEmail no-ops without RESEND_API_KEY and never
// throws, so a preview/dev run still stamps the node and returns ok.
export async function applyNodeInvite(
  db: SupabaseClient,
  args: { nodeId: string; email: string; origin: string },
): Promise<NodeInviteResult> {
  const { nodeId, email, origin } = args

  const { data: node } = await db
    .from("people")
    .select("id, display_name, node_status")
    .eq("id", nodeId)
    .maybeSingle()
  if (!node) return { ok: false, reason: "node_not_found" }
  const personName = (node as { display_name: string | null }).display_name ?? "your profile"

  // Stamp invite_email so completion binds on the verified email, and flip a
  // catalog node to unclaimed (completion + claim-complete both match unclaimed).
  const nodeUpdate: Record<string, unknown> = { invite_email: email }
  if ((node as { node_status: string | null }).node_status === "catalog") {
    nodeUpdate.node_status = "unclaimed"
  }
  await db.from("people").update(nodeUpdate).eq("id", nodeId)

  // Account-creating invite magic link. magiclink creates the user on first use,
  // so this is the invite-into-account step.
  try {
    const { data: linkData, error: linkErr } = await db.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${origin}/auth/complete` },
    })
    const link = linkData?.properties?.action_link
    if (!linkErr && link) {
      void sendClaimEmail({
        to: email,
        subject: `Your claim on ${personName} was approved`,
        html: claimInviteHtml({ personName, link }),
      })
    } else {
      console.error("[applyNodeInvite] generateLink failed:", linkErr?.message ?? linkErr)
    }
  } catch (err) {
    console.error("[applyNodeInvite email]", err)
  }

  return { ok: true, personName }
}
