// Server-only invite analytics helpers — touches service-role Supabase
// client and the Supabase admin API. Do not import this module from client
// components; see src/lib/invite-tracking.ts for the client-safe surface.

import { getServiceClient } from "@/lib/auth"
import { sendInviteEmail, showingUpMoreHtml } from "@/lib/emails/invite-emails"
import { nameToSlug } from "@/lib/utils"
import {
  TAG_THRESHOLD,
  TAG_THRESHOLD_NOTIFICATION_TYPE,
  trackInviteErrorServer,
  trackInviteEventServer,
} from "@/lib/invite-tracking"

interface TaggerSummary {
  distinct_count: number
  most_recent_actor: string | null
}

// Tag-threshold notification. Idempotent: relies on the UNIQUE constraint on
// person_invite_notifications (person_id, inviter_id, notification_type) and
// an explicit pre-check to avoid the cost of the count query when a row
// already exists. Never throws — all errors surface through Sentry tags.
//
// Acceptance behaviour (per the brief):
//   - Tag-source count crosses TAG_THRESHOLD for an unclaimed person.
//   - Recipient = people.invited_by if set, else most-recent distinct tagger.
//   - One email per (person, recipient) pair, ever. Re-tagging post-fire is a no-op.
//   - Path A claim resets the dedup ledger via the Session 3 RPC (see migration
//     20260512000002). Path B merge cascades via FK ON DELETE CASCADE.
export async function maybeFireThresholdNotification(
  origin: string,
  personId: string,
  taggerId: string,
): Promise<void> {
  if (!personId || !taggerId) return

  try {
    const db = getServiceClient()

    // 0. Read the target person. Skip if the row is gone, already claimed,
    //    or somehow not invitable. We re-check here even though callers
    //    typically gate too — the helper is the source of truth.
    const { data: person } = await db
      .from("people")
      .select("id, display_name, node_status, invited_by")
      .eq("id", personId)
      .maybeSingle()

    if (!person) return
    if (person.node_status !== "catalog" && person.node_status !== "unclaimed") return

    // 1. Pick the recipient up-front so we can run the EXISTS pre-check
    //    against a concrete inviter_id and skip the heavy count when this
    //    pair has already been notified.
    let inviterId: string | null = (person.invited_by as string | null) ?? null

    // 2. EXISTS pre-check (the approved optimisation). When invited_by is
    //    set, this short-circuits the count entirely. When invited_by is
    //    null we have to run the count to discover the most-recent tagger,
    //    so the pre-check happens AFTER the count in that branch.
    if (inviterId) {
      const { data: prior } = await db
        .from("person_invite_notifications")
        .select("id")
        .eq("person_id", personId)
        .eq("inviter_id", inviterId)
        .eq("notification_type", TAG_THRESHOLD_NOTIFICATION_TYPE)
        .maybeSingle()
      if (prior) return
    }

    // 3. Count + most-recent tagger via the SQL function (single round trip,
    //    UNION across claims/story_riders/riding_days).
    const summaryResult = await db.rpc("distinct_tagger_summary", { p_person_id: personId })
    if (summaryResult.error) {
      trackInviteErrorServer(origin, "threshold_count_query_failed", {
        person_id: personId,
        tagger_id: taggerId,
        message: summaryResult.error.message,
      })
      return
    }
    const summary = (summaryResult.data ?? { distinct_count: 0, most_recent_actor: null }) as TaggerSummary
    if (summary.distinct_count < TAG_THRESHOLD) return

    if (!inviterId) {
      inviterId = summary.most_recent_actor
      if (!inviterId) return

      // Pre-check again now that we know the recipient.
      const { data: prior } = await db
        .from("person_invite_notifications")
        .select("id")
        .eq("person_id", personId)
        .eq("inviter_id", inviterId)
        .eq("notification_type", TAG_THRESHOLD_NOTIFICATION_TYPE)
        .maybeSingle()
      if (prior) return
    }

    // 4. Resolve recipient email via the auth admin API. profiles has no
    //    email column — emails live in auth.users (same pattern as
    //    src/app/api/admin/memberships/route.ts).
    const { data: authUser } = await db.auth.admin.getUserById(inviterId)
    const recipientEmail = authUser?.user?.email
    if (!recipientEmail) return

    // 5. Build profile link and send.
    const personName = (person.display_name as string | null) ?? "this rider"
    const profileLink = `${origin}/people/${nameToSlug(personName)}`
    const sent = await sendInviteEmail({
      to: recipientEmail,
      subject: `${personName} is showing up more on Lineage.`,
      html: showingUpMoreHtml(personName, profileLink),
    })

    if (!sent) {
      trackInviteErrorServer(origin, "threshold_notification_send_failed", {
        person_id: personId,
        inviter_id: inviterId,
      })
      return
    }

    // 6. Insert the dedup row. UNIQUE constraint catches concurrent fires;
    //    treat the violation as a benign race and surface via Sentry tag.
    const { error: insertError } = await db
      .from("person_invite_notifications")
      .insert({
        person_id: personId,
        inviter_id: inviterId,
        notification_type: TAG_THRESHOLD_NOTIFICATION_TYPE,
        distinct_tagger_count_at_send: summary.distinct_count,
      })

    if (insertError) {
      // 23505 = unique_violation
      if (insertError.code === "23505") {
        trackInviteErrorServer(origin, "threshold_notification_dedup_violation", {
          person_id: personId,
          inviter_id: inviterId,
        })
      } else {
        trackInviteErrorServer(origin, "threshold_notification_send_failed", {
          person_id: personId,
          inviter_id: inviterId,
          message: insertError.message,
          code: insertError.code,
        })
      }
      return
    }

    trackInviteEventServer(origin, "tag_threshold_notification_sent", {
      person_id: personId,
      inviter_id: inviterId,
      distinct_tagger_count: summary.distinct_count,
    })
  } catch (err) {
    // Helper must never propagate. Wrap unexpected errors as a count-query
    // failure tag for visibility without crashing the calling endpoint.
    trackInviteErrorServer(origin, "threshold_count_query_failed", {
      person_id: personId,
      tagger_id: taggerId,
      message: err instanceof Error ? err.message : String(err),
    })
  }
}
