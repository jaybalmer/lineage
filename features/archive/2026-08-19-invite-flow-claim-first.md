# Build Brief: Claim-First Invite Flow

**Type:** Feature session (small to medium, single PR)
**Date drafted:** July 5, 2026
**Estimated:** 1 to 2 hours
**Separate from:** `Operations/email-deliverability-code-brief.md` (in progress). That brief changes how emails are *sent* (plaintext, reply-to, unsubscribe headers). THIS brief changes *when and whether* an invite email is offered at all, and shifts the product emphasis to the claim ("that's me") flow. No overlap in the files touched beyond both being deliverability-motivated.

---

## Why

Jay's call (July 5): the outbound invite email is the one part of the loop that reaches people who did not opt in, and it is the main deliverability liability for a young domain. Rather than remove the capability (it is the ambient-growth bridge that the first-wave push and FTUE activation both rely on), shift the center of gravity to the consensual claim flow and make the email invite a deliberate, warm, account-aware action.

## Premise correction (verified against the live repo July 5, 2026)

The system does NOT auto-email on tag today. Accurate current state:

- **Tagging is already silent.** Adding a rider creates a ghost node at `node_status: "unclaimed"` (`store/lineage-store.ts`), no email. Good, keep it.
- **Invites are already deliberate.** An email only sends when a human acts through one of: `InviteToClaimSheet` -> `POST /api/admin/invite-node` (editor), `app/api/invite/route.ts` (member supplies an email), or admin approval of a public claim request -> `applyNodeInvite` (`lib/node-invite.ts`).
- **Claim flow already exists.** `ClaimNodeSheet` -> `POST /api/public/claim-node` on public timelines; `HelpConnectCard` "This is me" on `/people/[id]`; "Claim your spot in the graph" on the public profile view.
- **The invite prompt surfaces** are `BulkInvitePrompt` (banner on the owner's own timeline, `owner-timeline-panel.tsx`), `HelpConnectCard` (`/people/[id]`), and `people-in-timeline.tsx`. All gate on `isInvitableNodeStatus(status)` which returns true for `catalog | unclaimed` only (`lib/invite-tracking.ts:83`).

So the work is emphasis + guarding + consent, not deleting an auto-blast.

---

## Scope

**1. Lead with claim, demote the email invite.**
On the shared surfaces where both a "This is me / that's me" claim action and an "invite by email" action appear (`HelpConnectCard`, `people-in-timeline`, and the `BulkInvitePrompt` expanded rows), make the claim action the visually primary CTA and the email invite the secondary, quieter action. No change to what either does, only hierarchy and copy.

**2. Never offer or send an invite to someone who already has an account.**
Today the gate is `isInvitableNodeStatus` = `catalog | unclaimed`, which excludes `claimed`/`verified` by node_status. But a person can have a bound auth account while their node_status still reads `unclaimed` (orphan / lagging status, noted in `project_lineage_codebase_quirks`). Add a hard "has a bound account" check so those people are never shown an invite affordance and the invite API rejects them. This is the previously flagged bug (invite prompt fires for riders who already have accounts). The exact "bound account" signal (a `profiles` row, `claimed_by` set, `invite_email` already bound, or membership presence) must be confirmed at build time. The guard belongs BOTH in the surfaces (hide the affordance) AND in the invite API routes (reject server-side, so a stale client cannot send).

**3. Add a consent line to the deliberate invite sheets.**
In `InviteToClaimSheet` and the member invite modal, add one muted line before the send button: something like "Only invite people you know and have given a heads-up. A surprised recipient marking this as spam hurts delivery for everyone." (final copy per Decision 3). This is the cheapest reputation protection and keeps the warm-invite behaviour Jay wants.

## Out of scope

- Email mechanics (plaintext part, reply-to, List-Unsubscribe): the other in-progress brief owns those.
- Removing the invite capability entirely. Explicitly rejected; the warm deliberate invite stays.
- Any change to the claim completion / merge path (`applyNodeInvite` fold-in, `merge_person`). Untouched.
- DNS / DMARC. Handled in `Operations/email-deliverability-brief.md`.
- No schema change expected. If the "bound account" check needs a column that does not exist, stop and flag it rather than adding a migration inside this session.

---

## DECISIONS (review before building)

**Decision 1: How aggressively to demote the email invite.**
Recommended default: keep the email invite present but visually secondary on every surface, with claim primary. Alternative (heavier): move the email invite behind a "..." / "More" affordance so it is one tap less prominent. Recommend the lighter version first.

**Decision 2: Who may send a member invite.**
Recommended default: leave member-initiated invites enabled (they are already deliberate) but gated by the account-exists guard and the consent line. Alternative: restrict all outbound invites to editors only (members can create ghost nodes and claim, but only editors send email). Recommend keeping member invites for launch reach; revisit if complaint data comes in.

**Decision 3: Consent-line copy.** Jay to approve the exact wording. Draft above. No em dashes.

**Decision 4: BulkInvitePrompt banner.**
Recommended default: keep it but make claim-primary and apply the account guard. Alternative: convert it from an always-shown banner to a quieter, dismissible link. Recommend keeping for now; it is already dismissible via localStorage.

---

## Acceptance criteria

1. `npx tsc --noEmit` clean.
2. On `HelpConnectCard`, `people-in-timeline`, and `BulkInvitePrompt`, the claim ("This is me" / "that's me") action is the primary CTA; the email invite is visually secondary.
3. No invite affordance renders for a person who has a bound auth account, even if their `node_status` is `unclaimed`. Verified with a test person who has an account but a lagging status.
4. The invite API routes (`/api/admin/invite-node`, `/api/invite`) reject a send targeting a person with a bound account, returning a clear error, so a stale client cannot send. Server-side guard, not just UI.
5. The two deliberate invite sheets show the consent line above the send button.
6. The claim flow and the warm deliberate invite both still work end to end (create ghost, claim it; and send one deliberate invite to a genuinely unclaimed node).

## Suggested order

1. Confirm the "bound account" signal against the schema (Decision on which field is authoritative). This gates everything else.
2. Add a shared `hasBoundAccount(person)` helper (mirror where `isInvitableNodeStatus` lives, `lib/invite-tracking.ts`) and use it to tighten the invitable check in all three surfaces.
3. Add the same guard server-side in the invite API routes.
4. Rework CTA hierarchy + copy on the three surfaces (claim primary, invite secondary).
5. Add the consent line to `InviteToClaimSheet` and the member invite modal.
6. `tsc`, then smoke: (a) claim a ghost, (b) confirm no invite shows for an accounted person with a stale status, (c) send one deliberate invite to a real unclaimed node and confirm it still works.

## Notes

- No migration expected. State that explicitly in the Ship sequence; if a schema gap appears for the account check, stop and flag rather than migrate mid-session.
- No em dashes anywhere.
- This pairs with, but does not depend on, the email-deliverability-code brief. Either can ship first.
