# Bug-fix brief: add-connection popover awards a token per tap (daily-cap token farm)

> Scope: BUG-151 (P1, HUMAN-RUN, diagnosis-first, economy-integrity).
> One PR. Name BUG-151 in the PR title or a commit message so the daily triage reconcile can close the loop.
> Append a `status: pending` entry to `bugs/SHIP-LOG.md` before wrapping.
> NOT auto-merge-safe: this touches the token economy and probably a prod token claw-back, both of which the autonomous pipeline excludes. Run this attended with Jay.
> No em dashes anywhere.

## Goal

Stop the "Add to {name}'s timeline" popover (opened from another rider's `/people/[id]`) from letting a member farm the daily contribution-token cap by tapping catalog items, and give the pickers real selected-state feedback so a tap is legible instead of silently writing a token-earning claim.

## DECISIONS (review before building)

1. Should a connection added to ANOTHER person's profile (which lands as a pending PB-009 tag the subject can decline) award the actor a contribution token immediately?
   - Recommended default: NO immediate award on this surface. Defer the contribution token until the tagged person approves the tag (award on approval), or, if that is too large for this session, suppress the award entirely for claims created through `AddPersonConnectionsPopover`. Rationale: the reward should follow a contribution that actually stands, not a pending tag on someone else that produces nothing on the actor's own timeline. This closes the farm at the source.
   - Alternative: keep the per-claim award but hard-cap this surface (for example only the first N distinct connections per subject per day earn), which is more code and still farmable across many profiles.

2. Claw back the tokens already farmed on the reporter's account?
   - Recommended default: YES, reconcile them. The award is tied to the claim via `source_ref` (the BUG-103 mechanism), so the farmed tokens can be reversed per claim. Do this as an attended one-off SQL step against the affected account(s) after the code fix lands, not an automated backfill. Quantify first (see pre-flight SQL), then reverse.
   - Alternative: leave existing balances and only fix forward. Not recommended during the equity-offer window, since weighted tokens feed the Sept 30 snapshot.

3. Picker interaction: keep immediate-write-per-tap, or move to select-then-submit?
   - Recommended default: keep the immediate-write model (it matches the June 23 person-profile-connections brief and the story popover), but fix the feedback: pass the real selected set to each `SearchPicker` so a tapped item shows as selected and cannot be silently re-tapped, and make the "+1 token" reward toast fire only when a token actually lands (see Decision 1). This addresses the reporter's "tapping does not add the name like it did before" without a full UX rebuild.
   - Alternative: rebuild the popover into a build-a-selection-then-Save flow. Larger; defer unless Jay wants it.

## Reports

- BUG-151, report 1 (July 9 03:08 UTC, `/people/cy_2`): "The add a connection button on other rider profiles brings up a popup that has several scroll lists. Tapping on any name does not add that name to the search field like how it did before. It trigger the +1 token instantly."
- BUG-151, report 2 (July 9 03:21 UTC, `/account/membership`): "By adding a connection to a rider with the recent previous bug i reported, you can potentially exploit the daily token limit. All the connect added shows up on my cy2 account as pending tags while this account accumulates the tokens. There is actually no timeline entries that are added anywhere that I can determine."
- Reporter: R1, iPhone Safari, PostHog session `S-35` (offsets ~735s and ~1308s).
- Screenshots (Drive "Linestry Bug Attachments"): `19f44d8cc5ab65a8__0__bug-screenshot.jpg` (the popover with the "+1 token earned" and "Already added." toasts), `19f44e57a9fa58ac__0__bug-screenshot.jpg` (the `/account/membership` balance showing the accrued tokens).

## Verified facts (grepped against current `src`)

- Surface component: `src/components/feed/add-person-connections-popover.tsx`. Opened from a person's public profile. Each of the four `SearchPicker`s passes `selected={[]}` (so items NEVER render as selected and stay re-tappable, per the in-file comment at ~line 44) and `onToggle={(id) => connectSection(kind, id)}`.
- `connectSection(kind, objectId)` (~line 76) has an in-session `connected` Set dedupe: a repeat tap on the SAME item shows the "Already added." info toast and returns. But distinct items each build a `Claim` and call `store.addClaim(claim)` (~line 96). The Set is per-open-popover only; it does not bound distinct entities and resets on reopen.
- `store.addClaim` (`src/store/lineage-store.ts` ~line 345) POSTs to the `/api/claims` route family.
- `POST /api/claims` (`src/app/api/claims/route.ts` ~line 256) calls `awardContributionTokens(db, user.id, 1, "contribution_entry", claimRef)` for a new claim (and +2 `contribution_source` when the claim carries a source). The award is best-effort and tied to `claimRef` (the claim id) as `source_ref`, so a per-claim reversal is possible (BUG-103 claw-back path; see DELETE `/api/claims/[id]`). Token award lives in `src/lib/tokens.ts` (`awardContributionTokens`).
- The reward toast ("+N token earned", type "reward") is fired in the store from the API's `tokens_awarded` response (`lineage-store.ts` ~line 1030). This is the "+1 token earned" toast the reporter sees.
- Claims from this surface are third-party tags: `subject_id = person.id` (the profile person), `asserted_by = viewerId` (the actor). They flow through the PB-009 pending pipeline, so they land as pending tags on the subject and do NOT appear on the actor's own timeline. That matches report 2 ("pending tags on my cy2 account ... no timeline entries added anywhere").
- Daily cap: contribution earning is capped at 20/day (see the `/account/membership` breakdown and `src/lib/tokens.ts`). Tapping distinct catalog items walks the actor to the cap quickly.

## Suggested implementation order

1. Diagnose and quantify first (attended). Run the pre-flight SQL below to count how many `contribution_entry` token awards on the reporter's account trace to claims created through this surface (third-party `rode_at`/`sponsored_by`/`competed_at`/`rode_with` claims where `asserted_by` is the actor and `subject_id` is someone else, still pending). Confirm the farm magnitude before changing anything.
2. Code fix, Decision 1 (award-on-approval or suppress-on-surface). Simplest safe version for this session: stop awarding a contribution token when the claim is a third-party pending tag from this popover. Prefer gating in the token-award decision (server-side, in `/api/claims` or `awardContributionTokens`) so the rule holds no matter which client writes the claim, rather than a client-only guard. If award-on-approval is chosen, wire the award into the tag-approval path (`/api/me/tags` decide) instead.
3. Code fix, Decision 3 (picker feedback). Track a local selected set in the popover and pass it to each `SearchPicker` `selected` prop so a tapped item shows selected and the "Already added." path is reached on re-tap. Keep the immediate-write model.
4. `npx tsc --noEmit` clean.
5. Claw-back, Decision 2 (attended one-off). After the code fix, reverse the farmed awards on the affected account using the `source_ref` per-claim reversal. Do this as a manual SQL step Jay applies, not an automated backfill. Verify the balance drops to the legitimate amount.

## Pre-flight SQL (diagnosis; read-only)

```sql
-- Contribution token awards on the reporter's account, by source kind, recent.
-- Replace :actor with the reporter's profile id (in5thgear / the account that accrued).
select source, count(*), sum(amount)
from token_events
where profile_id = :actor
  and created_at > now() - interval '3 days'
group by source
order by 2 desc;
```

```sql
-- Third-party pending tags this actor created that likely earned a token.
-- These are the farm claims: subject is someone else, asserted_by is the actor.
select c.id, c.predicate, c.subject_id, c.object_id, c.created_at, te.status
from claims c
left join tag_events te on te.claim_id = c.id
where c.asserted_by = :actor
  and c.subject_id <> :actor
  and c.created_at > now() - interval '3 days'
order by c.created_at desc;
```

Confirm the `token_events` / `tag_events` column names against the live schema before running (grep `src/lib/tokens.ts` and `src/lib/tag-events.ts`); the names above are the expected shape from the BUG-103 and PB-009 work.

## Acceptance

- Tapping a picker item in `AddPersonConnectionsPopover` gives clear selected-state feedback and cannot silently re-award a token on re-tap.
- Adding a connection to another person's profile no longer awards the actor a contribution token before the tagged person approves (award-on-approval), or does not award on this surface at all (suppress), per the locked Decision 1.
- A member can no longer walk the 20/day contribution cap by tapping catalog items on other profiles.
- A genuine connection still persists, is attributed to the actor, and still lands as a pending tag the subject can decline from `/me/tags` (the PB-009 control is unchanged).
- Any tokens already farmed on the reporter's account are reconciled to the legitimate balance (Decision 2), verified against the pre-flight counts.
- `npx tsc --noEmit` is clean.

## Notes

- Migration / claw-back gate: if the award rule moves server-side or the claw-back touches `token_events`, this is NOT auto-merge-safe. Surface any SQL as copy-paste in the session and apply it attended (migrate/claw-back before or right after merge, per the Ship sequence).
- Related history: BUG-103 (PR #127) added the token-farm claw-back mechanism (add/delete/re-add via `source_ref`); this bug is a different farm vector (third-party connection taps) that the same `source_ref` reversal can unwind. BUG-108/BUG-107 touched the token toast/earned-today surfaces. The June 23 `Operations/person-profile-connections-brief.md` is the original design for this popover.
- PR title reminder: include "BUG-151". SHIP-LOG reminder: append one `status: pending` entry (schema at the top of `bugs/SHIP-LOG.md`), record `migration:` (or the claw-back SQL) so the reconcile knows the gate.

---

## CROSS-LINK (2026-07-28, attended session): BUG-148 is the removal-side symptom of THIS bug

BUG-148 ("member cannot delete events from their timeline", `bugs/2026-07-05-delete-event-blocked.md`) was diagnosed to the SAME mechanism as this brief. When member A adds connections about member B through the add-person-connections popover, `POST /api/claims` writes `subject_id = B`, `asserted_by = A`, and a paired member tag_event (pending, shown on B's timeline under the permissive default). B sees these on their own timeline with a "Remove" button (`isOwn`), but `DELETE /api/claims/[id]` admits only the asserter or an editor, so B gets a 403 and the entry bounces back. Verified in prod: CY 1 (499deddd) asserted four rode_at/sponsored_by claims about Cy 3 (3f8ef433); Cy 3 cannot delete them.

So this session should cover BOTH sides of the cross-member connection model:
1. CREATION (BUG-151): the token-per-tap farm + selected-state + where these subject-claims should live / what status.
2. REMOVAL (BUG-148): the subject's timeline "Remove" must actually remove (recommended: route subject-not-asserter removals to a tag_event DECLINE, matching `/me/tags`, rather than the asserter-only hard DELETE that 403s).

Immediate workaround for any affected subject today: decline the tags at `/me/tags`.
