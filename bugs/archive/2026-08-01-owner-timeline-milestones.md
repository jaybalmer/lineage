# Bug-fix brief: owner timeline missing milestones + statement + stat header (BUG-154)

> Self-contained Claude Code hand-off. Drafted by the August 1 daily triage.
> Scope is one bug, one PR. No em dashes anywhere. `npx tsc --noEmit` clean before commit.
> Name BUG-154 in the PR title. Append a `status: pending` SHIP-LOG entry before wrapping.

## Goal (one line)
Make a signed-in owner's own `/people/[id]` render the same statement, MILESTONES block and stat header that a logged-out visitor already sees, so the owner is not shown a thinner surface than the public.

## BUG in scope
- **BUG-154** [P1] [reproducible]: CY 1 reports "Members page extra area and milestones only show up in my timeline when I am offline." Logged out, `/people/cy_1` renders the stat header (BOARDS / PLACES / EVENTS / RIDING), the statement/bio, and a MILESTONES block. Signed in as the owner, those sections are gone.

## DECISIONS (review before building)
1. **Where the owner sees milestones/statement.** Recommended default: render the same `<MemberCuratedSections person isOwner />` and the public stat header INLINE in the owner view, so the owner sees and manages them in place. Alternative: leave the owner panel thin and add a link/banner pointing to the curated manage surface (`/me/public-view` or wherever curation is edited). Recommended default is inline parity.
2. **Stat header source.** Recommended default: reuse whatever component renders the public stat header (grep for the BOARDS/PLACES/EVENTS/RIDING block on the public fall-through) rather than re-deriving counts, to avoid a second count path. Alternative: compute from the owner's already-loaded unfiltered claims. Recommended default is reuse the shared header component.

## Root cause (code-verified this run)
- `src/app/people/[id]/page.tsx:209`:
  ```
  if (isAuthUser(activePersonId) && resolvedId === activePersonId) {
    return <OwnerTimelinePanel />
  }
  ```
  The owner is short-circuited to `<OwnerTimelinePanel />` (`src/components/profile/owner-timeline-panel.tsx`) and never reaches the public fall-through below, which renders `<MemberCuratedSections person={person} isOwner={isCurrentUser} />` (page.tsx:328, the PR #164 Curated Member Profile layer: statement + milestones + featured rail) plus the public stat header.
- So the owner branch and the public branch render two different surfaces. The public branch is the richer one. The owner is missing the curated sections and the stat header.

## Verified facts / suspected files
- `src/app/people/[id]/page.tsx` : owner short-circuit at line 209; public fall-through renders `MemberCuratedSections` at ~line 328 and the stat header nearby (grep the file for the BOARDS/PLACES/EVENTS/RIDING labels and the statement render to find the exact header component).
- `src/components/profile/owner-timeline-panel.tsx` : the owner surface that needs the curated sections + stat header added. Read it in full first to see what it already renders (it does its own unfiltered claims read per the comment at page.tsx:121-124, so it has the data).
- `src/components/profile/member-curated-sections.tsx` : the `<MemberCuratedSections person isOwner />` component (statement, milestones, featured rail). Already handles `isOwner` (owner-editable affordances), so passing `isOwner` here is expected.
- `src/app/api/me/profile-curation/route.ts` : the curation read/write path (context only; do not change unless the owner panel needs the curated payload and does not already have it).

## Suggested implementation order
1. Read `owner-timeline-panel.tsx` fully and identify where the statement + milestones + stat header should slot in relative to the timeline it already renders.
2. Read `people/[id]/page.tsx` around the public fall-through (lines ~300-340) to capture exactly how the public branch composes the stat header + `MemberCuratedSections`, so the owner branch can reuse the same components with the same props.
3. Add the stat header + `<MemberCuratedSections person isOwner />` to the owner panel (or lift the shared header/curated block so both branches render it). Ensure `person` is resolved in the owner branch (it comes from the merged catalog; confirm it is available where `OwnerTimelinePanel` renders).
4. Confirm no double-render: if `OwnerTimelinePanel` already shows a statement or header, do not duplicate it.
5. `npx tsc --noEmit` clean.

## Acceptance criteria (BUG-154)
- Signed in as the owner, `/people/[id]` (for your own id) shows the statement/bio, the MILESTONES block, and the stat header (BOARDS / PLACES / EVENTS / RIDING), matching what the same page shows when logged out.
- The logged-out public view is unchanged.
- The curated manage surface (`MemberCuratedSections` owner affordances / wherever curation is edited) still works; editing a milestone or statement reflects on the owner view.
- No duplicated header or statement in the owner view.

## DB / migration
- None. Client-side render change only. No `_public` view touched.

## Verification
- Local: sign in, open your own `/people/[id]`, confirm parity with the logged-out view (open the same URL in a private window). Confirm a second, non-owner account still sees the public view unchanged.

## Wrap
- One PR, title names **BUG-154**. Append a `status: pending` SHIP-LOG entry (`type: bugfix`, `ids: BUG-154`, `migration: none`). Do not edit the Shipped section of `bug-triage.md`; the next daily triage reconciles it.
