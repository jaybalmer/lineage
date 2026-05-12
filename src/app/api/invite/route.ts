import { NextRequest, NextResponse } from "next/server"
import { requireAuth, getServiceClient } from "@/lib/auth"
import {
  isInvitableNodeStatus,
  trackInviteErrorServer,
  trackInviteEventServer,
} from "@/lib/invite-tracking"
import { inviteEmailHtml } from "@/lib/emails/invite-emails"

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

// ─── POST /api/invite ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { user, response: authResponse } = await requireAuth()
  if (authResponse) return authResponse

  try {
    const body = await req.json() as {
      person_id: string
      person_name: string
      inviter_name: string
      predicate: string
      email?: string
    }

    const { person_id, person_name, inviter_name, predicate, email } = body

    if (!person_id) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Escape user-supplied names before using in HTML email
    const safeInviterName = escapeHtml(inviter_name || "Someone")
    const safePersonName = escapeHtml(person_name || "a rider")

    const token = crypto.randomUUID()
    const origin = req.headers.get("origin") || "https://lineage.wtf"
    const link = `${origin}/claim/${token}`

    const supabase = getServiceClient()

    // Verify the target is still invitable before doing anything else.
    // node_status changes (catalog/unclaimed → claimed/verified) can race
    // against stale client UI, so we check server-side and surface the
    // mismatch via tracking.
    const { data: targetRow } = await supabase
      .from("people")
      .select("node_status")
      .eq("id", person_id)
      .maybeSingle()

    if (targetRow && !isInvitableNodeStatus(targetRow.node_status)) {
      trackInviteErrorServer(origin, "invite_target_not_claimable", {
        person_id,
        node_status: targetRow.node_status,
        inviter_id: user.id,
      })
      return NextResponse.json(
        { error: "This rider has already claimed their profile." },
        { status: 409 },
      )
    }

    // Insert invite record -- use authenticated user's ID
    const { error: insertError } = await supabase.from("invites").insert({
      id: token,
      person_id,
      invited_by: user.id,
      email: email ?? null,
      person_name,
      inviter_name,
      predicate,
    })

    if (insertError) {
      console.error("Invite insert error:", insertError)
      trackInviteErrorServer(origin, "invite_db_insert_failed", {
        person_id,
        inviter_id: user.id,
        code: insertError.code,
        message: insertError.message,
      })
      // Don't hard-fail — still return a usable link
    }

    // Update the person node with invite info and elevate to unclaimed if catalog
    try {
      const updateFields: Record<string, unknown> = {
        invited_by: user.id,
      }
      if (email) updateFields.invite_email = email
      // Elevate catalog → unclaimed (being invited means someone knows them)
      updateFields.node_status = "unclaimed"
      await supabase.from("people").update(updateFields).eq("id", person_id)
    } catch (updateErr) {
      console.error("Person update error:", updateErr)
    }

    // Send email via Resend (if API key is configured and email provided)
    const resendKey = process.env.RESEND_API_KEY
    if (email && resendKey) {
      try {
        const { Resend } = await import("resend")
        const resend = new Resend(resendKey)
        await resend.emails.send({
          from: "Lineage <noreply@lineage.wtf>",
          to: email,
          subject: `${safeInviterName} added you to their snowboard lineage`,
          html: inviteEmailHtml(safeInviterName, safePersonName, link),
        })
      } catch (emailErr) {
        console.error("Resend error:", emailErr)
        trackInviteErrorServer(origin, "invite_resend_failed", {
          person_id,
          inviter_id: user.id,
          message: emailErr instanceof Error ? emailErr.message : String(emailErr),
        })
        // Don't fail the request if email sending fails
      }
    }

    trackInviteEventServer(origin, "invite_link_created", {
      surface: "server",
      person_id,
      predicate,
      has_email: Boolean(email),
      inviter_id: user.id,
    })

    return NextResponse.json({ token, link })
  } catch (err) {
    console.error("Invite route error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
