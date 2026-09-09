# Bug-fix brief: add "create new" to the Story Connections popover (BUG-059)

> Build-ready. Self-contained. Drafted by the daily triage (June 16, 2026).
> Auto-merge eligible: pure client/store change, no migration, no `_public` view, no auth/payments/memberships. Still, one small UX decision below.

## Goal
In the add-connections popover, let a member create a brand-new rider (and place and event) when the search returns no match, then connect it to the story in one flow, matching how the Add Story modal already works.

## In scope
- **BUG-059** [P2]: the "+ Connect" / "I was there" story-connections popover has no "add a new rider" affordance when there is no match, unlike the Add Story modal and the other pickers.

## DECISIONS (review before building)
- **D1. Which entity types get the create affordance.** Recommended default: all three the popover already offers (rider, place, event), for full parity with Add Story. Alternative: riders only (the reporter named riders specifically), if you want the smallest change. Default is all three.
- **D2. Label wording.** Recommended default: reuse the Add Story labels exactly ("Add a rider", "Add a new place", "Add a new event") so copy stays consistent. Alternative: "Add a new rider" for symmetry; pick the Add Story strings to avoid drift.

## Root cause (verified against current main)
`src/components/feed/add-connections-popover.tsx` renders three `SearchPicker`s without the create props:
- riders picker at ~line 138
- places picker at ~line 148
- events picker at ~line 158

Each passes only `items` / `selected` / `onToggle` / `getLabel` / `placeholder`. `SearchPicker` (`src/components/ui/search-picker.tsx`) supports an optional `onAddNew` callback plus `addNewLabel`; when omitted it just renders "No matches". So the popover never surfaces a create action.

The established pattern is in `src/components/ui/add-story-modal.tsx`:
- each picker passes `onAddNew={() => setAddingEntity("place"|"event"|"org"|"person")}` and an `addNewLabel`
- an `addingEntity` state (`useState<AddableEntity | null>(null)`) drives a rendered `<AddEntityModal entityType={addingEntity} onClose={...} onAdded={(id) => handleEntityAdded(addingEntity, id)} />` (imported from `src/components/ui/add-entity-modal.tsx`)
- `handleEntityAdded` auto-selects the freshly created entity

The store already exposes the create actions used by AddEntityModal: `addUserPerson`, `addUserPlace`, `addUserOrg` (and `addUserBoard`) in `src/store/lineage-store.ts`. `addUserPerson` stamps `node_status='unclaimed'`; place/org stamp `community_status='unverified'`. The popover's existing `connect(type, entityId)` already POSTs a single connection per pick.

## Implementation (suggested order)
1. In `add-connections-popover.tsx`, add `const [addingEntity, setAddingEntity] = useState<"person" | "place" | "event" | null>(null)` (match the `AddableEntity` type AddEntityModal expects; note the rider type key is `"person"`).
2. Pass `onAddNew` + `addNewLabel` to each of the three SearchPickers:
   - riders: `onAddNew={() => setAddingEntity("person")}` `addNewLabel="Add a rider"`
   - places: `onAddNew={() => setAddingEntity("place")}` `addNewLabel="Add a new place"`
   - events: `onAddNew={() => setAddingEntity("event")}` `addNewLabel="Add a new event"`
3. Render `<AddEntityModal>` when `addingEntity` is set, mirroring AddStoryModal. On `onAdded(id)`, close the sub-modal and immediately call `connect(typeForEntity, id)` so the new entity is connected in one flow (map `"person" -> "rider"` for the `connect` type).
4. Confirm the popover re-reads the catalog so the new entity is selectable; it already calls `loadCatalog()` on mount, and AddEntityModal pushes the new row into the store, so the optimistic chip via `onAdded` should suffice. If the new id is not yet in `catalog` when `connect` runs, connect by the id returned from AddEntityModal directly (do not depend on a re-render).
5. Verify the create sub-modal renders above the popover (z-index) and that closing it returns to the popover, not the story card.

## Acceptance
- Searching a non-existent rider in the popover shows an "Add a rider" action; using it opens the create form, and on save the new rider is created (`node_status='unclaimed'`) and connected to the story, appearing as a chip.
- Same for place and event (if D1 = all three).
- Existing pick-an-existing-entity behavior is unchanged; the "I was there" fast path is unchanged.
- `npx tsc --noEmit` is clean.

## Standing rules
- Name **BUG-059** in the PR title or commit message (the daily reconcile reads merged-PR messages to close the loop).
- Append a `status: pending` entry to `bugs/SHIP-LOG.md` (schema at the top of that file). Do not edit earlier entries.
- Do not edit the **Shipped** section of `bugs/bug-triage.md`; the triage reconciles it after merge.
- No em dashes anywhere (code, comments, UI copy). Use periods, commas, parentheses, colons, or semicolons.
- One PR for the session; push the branch and let Jay merge.
