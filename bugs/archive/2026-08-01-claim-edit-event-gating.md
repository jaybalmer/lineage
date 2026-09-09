# Bug-fix brief: "Edit event" on a timeline claim card exposes the catalog editor to non-editors (BUG-155)

> Self-contained Claude Code hand-off. Drafted by the August 1 daily triage.
> Scope is one bug, one PR. No em dashes anywhere. `npx tsc --noEmit` clean before commit.
> Name BUG-155 in the PR title. Append a `status: pending` SHIP-LOG entry before wrapping.
> HUMAN-RUN: touches authorization + shared-catalog mutation. Do NOT auto-merge.

## Goal (one line)
Stop a non-editor member from opening the shared catalog "Edit event" modal from a timeline claim card, so a personal timeline claim can no longer surface an affordance that would rename a shared catalog event.

## BUG in scope
- **BUG-155** [P2] [reproducible]: CY 2 reports "Added a spectated at an event to my timeline. And in my timeline i can edit the Event name. I don't think i should be able to do this." The screenshot shows the full catalog "Edit event" modal (Event name "World Championships", Type Contest, Year 1986, Place, Series, Brands) reached from a spectated_at claim on their own timeline.

## DECISIONS (review before building)
1. **Gate vs remove.** Recommended default: **gate the "Edit event" button on `membership.is_editor`** (is_editor OR founding, matching the existing `/api/admin` write gate) so only editors see it. Alternative: remove the inline "Edit event" affordance from claim cards entirely and route all catalog-event edits through the event page / `/admin`. Recommended default is gate on editor, because it aligns the affordance with the write permission and keeps a working editor path; pick remove-entirely if the product call is that catalog edits should never originate from a personal timeline claim.
2. **Pre-flight diagnosis (do this first, it may change the fix).** Run the pre-flight SQL below to confirm (a) whether cy_2 actually has `is_editor` (if yes, the modal saves succeeded and this is a mis-placed-but-authorized affordance, not a 403 dead button) and (b) whether "World Championships" was renamed in prod by this session (an unintended edit to revert). If a rename happened and was not intended, revert the event name as part of the session (GATED data change: print the UPDATE and confirm the correct prior name before applying).

## Root cause (code-verified this run)
- `src/components/timeline/claim-card.tsx`: the "Edit event" menu item (around line 147) renders whenever `isOwn && userEvent`:
  ```
  {userEvent && (
    <button onClick={() => { setMenuOpen(false); setEditingEvent(true) }}>
      <span>📋</span> Edit event
    </button>
  )}
  ```
  `userEvent = userEntities.events.find((e) => e.id === claim.object_id)` (claim-card.tsx:51), i.e. the referenced event is a user-created catalog entity. There is NO editor-permission check on the button; the only gates are `isOwn` (own timeline) and the entity being user-created. `<EditEventModal>` (opened at claim-card.tsx:70) saves via `POST /api/admin` (`src/components/ui/edit-event-modal.tsx:149` and `:171`).
- Per the codebase CLAUDE.md, mutating `/api/admin` routes enforce `requireEditor` (is_editor OR founding). So the server already blocks a non-editor save; the bug is that the CLIENT shows the affordance regardless, which is at best misleading (403 on save) and at worst, for an editor, a mis-placed path to rename shared catalog data from a personal claim.

## Verified facts / suspected files
- `src/components/timeline/claim-card.tsx` : the "Edit event" button (line ~147) and its `isOwn && userEvent` gate; `ClaimCard({ claim, isOwn })` signature at line 26. NOTE: `claim-card.tsx` does NOT currently import `membership` from the store; you will need to pull `membership` (or an `isEditor` boolean) from `useLineageStore()` or thread it in as a prop.
- `src/store/lineage-store.ts` : `membership` slice carries `is_editor` (see the Membership section of the codebase CLAUDE.md). Prefer reading `membership?.is_editor` in `claim-card.tsx` over a new prop, unless the card is rendered somewhere without store access.
- `src/components/ui/edit-event-modal.tsx` : the modal; saves via `POST /api/admin` at lines 149/171. No change needed here unless Decision 1 = remove-entirely.
- `/api/admin` route (server): already enforces `requireEditor`; confirm this by reading the route handler so the brief's assumption is verified before you rely on it as the security backstop.

## Pre-flight SQL (read-only diagnosis; run first)
```sql
-- Is cy_2 an editor? (join the person node to its profile/membership)
select p.id, p.display_name, m.is_editor, m.tier
from profiles p
left join memberships m on m.profile_id = p.id
where p.id = 'cy_2' or p.display_name ilike '%cy 2%' or p.display_name ilike '%cory%';

-- Did the "World Championships" event get renamed / who created it?
select id, name, type, year, community_status, created_by, updated_at
from events
where name ilike '%World Championships%' or name ilike '%champ%'
order by updated_at desc
limit 20;
```

## Suggested implementation order
1. Run the pre-flight SQL. Record whether cy_2 is an editor and whether the event was renamed. If an unintended rename happened, stage the revert as a GATED change (print the UPDATE, confirm the prior name, apply only after confirmation).
2. In `claim-card.tsx`, read `membership?.is_editor` from the store (add to the existing `useLineageStore()` destructure).
3. Change the "Edit event" button condition from `userEvent && ...` to `userEvent && isEditor && ...` (keep `isOwn` as the outer gate it already sits inside). Founding tier counts as editor per `requireEditor`; if the store exposes a helper, use it, else check `membership?.is_editor === true`.
4. `npx tsc --noEmit` clean.

## Acceptance criteria (BUG-155)
- A signed-in non-editor viewing their own timeline no longer sees an "Edit event" option on a claim card whose object is a catalog event.
- An editor (is_editor or founding) still sees the option if the current product call keeps it (Decision 1 default); the editor's `/api/admin` save path is unchanged.
- "Edit claim" and "Delete" on the same menu are unaffected (those are the member's own claim, not the shared catalog entity).
- Any unintended prod rename found in diagnosis is reverted.

## DB / migration
- None for the code fix. The only DB write is an OPTIONAL, GATED one-off event-name revert if diagnosis shows an unintended rename (print it, confirm, then apply).

## Wrap
- One PR, title names **BUG-155**. Append a `status: pending` SHIP-LOG entry (`type: bugfix`, `ids: BUG-155`, `migration: none` unless a revert was applied). Do not edit the Shipped section of `bug-triage.md`; the next daily triage reconciles it.
