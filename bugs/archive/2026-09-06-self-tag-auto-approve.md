# Bug-fix brief: tagging yourself in your own story lands in your own approval inbox

**Drafted:** September 6, 2026 (daily triage, auto-drafted)
**BUG id in scope:** BUG-180 (P1)
**Verified against:** `main` at `6b9b5ca`
**Migration:** none for the code fix. The backfill that clears existing rows IS a data change to `tag_events` and is **GATED**. See section 6.
**Risk:** ATTENDED. The code half is small and safe; the data half updates existing rows in the consent layer.

---

## 0. Goal

A `story_riders` tag whose subject is the story's own author should never be `pending`. Add the self-guard that the claims path already has, and clear the existing self-tags out of the owner inbox.

---

## 1. DECISIONS (review before building)

**D1. Skip the row, or write it approved.**
- **Recommended default: write the row with `status='approved'`, do not skip it.** `pairStoryRiderTagEvents` exists so that every `story_riders` row has a paired `tag_event`, which is what keeps the `story_riders_public` view coherent. Skipping the insert would leave `tag_event_id` null and rely on the grandfathered branch, which works today but muddies the invariant.
- Alternative: skip entirely, matching what `pairClaimTagEvents` does for claims (`tag-events.ts:396`). Simpler and consistent with the sibling function, but see the invariant note above. If you take this, check the `story_riders` insert does not set a non-null `tag_event_id` expectation anywhere.

**D2. What to do with the existing pending self-tags.**
- **Recommended default: flip them to `approved`**, preserving the row and its history, with `decision_by` set to the subject. Reversible, keeps the audit trail, and the owner inbox empties.
- Alternative: leave them and let the owner clear them by hand. Rejected: the reporter's complaint is precisely that they are being asked to approve themselves.

**D3. Scope of the backfill.**
- **Recommended default: only `tag_events` where `subject_id = asserter_id` AND `status = 'pending'` AND the moment is a story.** Narrow and defensible.
- Alternative: include claim-sourced rows too. There should be none (the claims path already guards), but if the pre-check in section 6 finds some, widen and say so in the PR.

**D4. Also guard the connections endpoint.**
- **Recommended default: yes.** `POST /api/stories/[id]/connections` has no self-guard either and is a live path to the same defect. Guard it in the same session.
- Alternative: fix only the pairing helper. The helper guard covers it anyway if D1's default is taken at the helper level, which is the reason to put the guard **in the helper**, not at the call sites.

---

## 2. The bug

Reported September 6, 2026 by OWNER (signed in, desktop Chrome, 948x952), on `https://linestry.com/me/tags`, replay `S-54`:

> I'm getting tag requests for stories that I created. Expect tags of myself are assumed approved. Plus, these are old so it feels like a recent change surfaced them

Two claims in one report. Both check out. The first is a straightforward missing guard. The second has a verified mechanism and is the more interesting half.

---

## 3. Verified facts (checked against `6b9b5ca`, do not re-derive)

**The status decision**, `src/lib/tag-events.ts:101-109`:

```ts
export function defaultStatusForSource(source: TagEventSource): TagEventStatus {
  switch (source) {
    case "member":               return "pending"
    case "editor":               return "approved"
    case "system":               return "approved"
    case "public_timeline_embed":return "pending"
    default:                     return "pending"
  }
}
```

`insertTagEvent` (`tag-events.ts:204-249`) has exactly one escape from `pending`, the `tag_trust` lookup at `:218-222`. A person has no `tag_trust` row trusting themselves, so a self-tag stays pending. **`insertTagEvent` never compares `input.subjectId` to `input.asserterId`.** Repo-wide grep confirms no code anywhere in `src/` or `supabase/migrations/` compares `asserter_id` to `subject_id`.

**The claims path already gets this right**, `tag-events.ts:396`:

```ts
if (!personId || personId === args.asserterId) continue
```

**`pairStoryRiderTagEvents` (`tag-events.ts:298-348`) has no equivalent.** Its own header comment at `:288-289` asserts the opposite of reality:

> "Self-tags (author tagging themselves in their own story) get a tag_event too, they're trivially approved, but having the row keeps the view filter coherent"

That comment is **stale**. It was written in PB-009 Phase 1 when `member` defaulted to `approved`. Commit `7bc79bd` (2026-05-13, Phase 2) flipped `member` to `pending` and nobody revisited the comment. Fix the comment in the same commit; it is actively misleading.

**Call sites of `pairStoryRiderTagEvents`**, none of which excludes the author:

| File:line | asserter (`authorId`) | subject (`riderIds`) |
|---|---|---|
| `src/app/api/stories/route.ts:398-400` (POST) | `user.id` | `rider_ids` from the payload, unfiltered |
| `src/app/api/stories/route.ts:674-676` (PATCH) | `user.id` | `addedRiderIds` from the diff |
| `src/app/api/stories/[id]/connections/route.ts:170-175` (POST) | `user.id`, the adder | `[entityId]` |

Story author column is `stories.author_id`, always from the session (`stories/route.ts:351`).

**The composer UI already filters self out of the picker**, `src/components/ui/add-story-modal.tsx:139`:

```ts
const allRiders = catalog.people.filter((p) => p.id !== activePersonId)
```

present since `d588397` (2026-03-23). So the composer picker is **not** the likely origin. The unguarded paths are the connections endpoint and the `defaults?.riderIds` / `editStory.rider_ids` prefill at `add-story-modal.tsx:131-133`.

**Note a related gap while you are in the PATCH diff.** `stories/route.ts:618-639` protects pending tags asserted by someone **other than** the author from being diffed away (`e.status === "pending" && e.asserter_id !== user.id` at `:629`). That guard does not protect a pending **self**-tag, since its `asserter_id === user.id`. Once self-tags are approved this stops mattering, but do not be surprised by it.

**Why old tags surfaced now, verified mechanism.** Nothing in the last 16 days touches `tag-events.ts`, `/me/tags`, or `require_tag_approval` (`git log -G` on those terms over that window is empty). But `supabase/migrations/20260906000001_merge_person_into.sql:167-173`, shipped **today** in PR #229, repoints the subject:

```sql
    -- tag_events.subject_id (drifted since 2026-05-11: PB-009)
    WITH r AS (
      UPDATE tag_events SET subject_id = p_canonical_id
       WHERE subject_id = p_ghost_id
       RETURNING id)
```

This is the **first** migration ever to repoint `tag_events.subject_id`; the older `merge_person` RPCs (`20260511000001`, `20260512000002`, `20260512000004`) contain no `tag_events` reference at all. It is reached from three live paths: `promoteGhostToAccount` (`src/lib/promote-ghost.ts:57`), `POST /api/admin/merge-person` (`route.ts:88`), and `merge_person` Path B delegation (migration `:550`, via `/api/claim-requests/[id]/route.ts:220`).

Implied mechanism, consistent with the evidence but **not confirmed against production data**: an old pending story tag whose subject was a ghost duplicate of the member was invisible to `/api/me/tags` (its `subject_id` did not equal `user.id`). Today's merges repointed `subject_id` onto the real profile, the row started matching the inbox filter, and because the member had authored the story the asserter was already them. Result: a pile of aged pending self-tags appearing at once. That is exactly what the reporter describes.

Also note `tag_events.asserter_id` is **not** repointed by the new RPC (it repoints `claims.asserted_by`, `people.added_by`, `people.invited_by` only). Worth a look, but out of scope here.

**The inbox filter**, `src/app/api/me/tags/route.ts:65-73`:

```ts
  let query = db
    .from("tag_events")
    .select("*")
    .eq("subject_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200)

  if (status !== "all") query = query.eq("status", status)
  if (source !== "all") query = query.eq("source", source)
```

Badge count at `:59-63`. Page is `src/app/me/tags/page.tsx`, fetching at `:87`, default status `"pending"` (`:60`). No `asserter_id <> subject_id` exclusion anywhere.

**Do not "fix" this at the inbox query.** Filtering self-tags out of `/api/me/tags` would hide the symptom and leave `pending` rows sitting in the consent layer, where the `_public` view rule (`supabase/migrations/20260616000001_bug060_tag_visibility_definer.sql:53-73`) would hide the member's own story riders from the public view for anyone who has `require_tag_approval = true`. Fix it at the source.

---

## 4. Files to touch

| File | Why |
|---|---|
| `src/lib/tag-events.ts` | the guard in `pairStoryRiderTagEvents` (`:298-348`), and the stale comment at `:288-289` |
| `src/app/api/stories/[id]/connections/route.ts` | per D4, if you do not put the guard in the helper |

That should be all. Do not touch `/api/me/tags`, the views, or `defaultStatusForSource`.

---

## 5. Suggested order

1. Run the section 6 pre-check SQL and record the counts.
2. Add the self-guard in `pairStoryRiderTagEvents` per D1. Fix the stale comment.
3. Confirm the three call sites need no change once the helper guards.
4. `npx tsc --noEmit`.
5. Open the PR. Then run the backfill per section 6 with Jay's approval, and verify.

---

## 6. Data work, GATED

The code fix stops new self-tags. It does not clear the ones already in the inbox, which is the reporter's actual complaint. This is an `UPDATE` of existing rows in the consent layer, so per the repo risk gate it is **GATED**: print it, state the risk, wait for Jay, then apply and verify.

Pre-check first, and paste the counts into the PR:

```sql
-- how many, and are any of them claim-sourced (they should not be)
select status,
       (moment_ref ? 'story_id') as is_story,
       count(*)
  from tag_events
 where subject_id = asserter_id::text
 group by 1, 2
 order by 3 desc;
```

Then, on approval:

```sql
update tag_events
   set status = 'approved',
       decision_by = subject_id,
       decided_at = now()
 where subject_id = asserter_id::text
   and status = 'pending'
   and moment_ref ? 'story_id';
```

Verify with the pre-check query re-run: the `pending` / `is_story = true` row should be zero.

**Two cautions.** `tag_events.subject_id` is text and `asserter_id` is uuid, so the comparison needs the cast shown. And confirm the `decided_at` and `decision_by` column names against the live table before running; they are named from the Phase 2 and Phase 3 work and this brief did not re-verify them against the deployed schema.

---

## 7. Acceptance criteria

- Tagging yourself as a rider in a story you author produces a `tag_events` row with `status='approved'` (D1 default), or no row at all (D1 alternative), and **nothing appears in `/me/tags`**.
- Tagging somebody else in your story is unchanged: still `pending`, still lands in their inbox.
- Somebody else tagging you is unchanged: still `pending`, still lands in yours.
- Adding yourself through `POST /api/stories/[id]/connections` behaves the same as through the composer.
- The PATCH rider diff still preserves other people's pending tags (`stories/route.ts:618-639` behaviour intact).
- After the backfill, the owner's pending count badge drops and no self-tag remains pending.
- The stale comment at `tag-events.ts:288-289` is corrected.
- `npx tsc --noEmit` clean.

---

## 8. Pipeline note

**Not legal for the unattended slot.** It touches the PB-009 consent layer and carries a GATED data update. Attended session.

---

## 9. Wrap

- Name **BUG-180** in the PR title or commit message.
- `bugs/SHIP-LOG.md` entry: `migration:` records the backfill if it ran, or `DEFERRED` if Jay held it.
- Do not edit the Shipped section of `bugs/bug-triage.md`.
- No em dashes anywhere you write.
