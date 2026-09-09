# Bug-fix brief: "Riding since" edit not reflected in the Riders list (BUG-089)

> Self-contained, build-ready, DIAGNOSIS-FIRST. Drafted June 19, 2026 by the daily triage with the live repo grepped. A data-staleness papercut: editing your own profile "Riding since" year does not update the Riders list until a hard reload. The pointer below is strong, but confirm the persist-vs-render split before changing code (diagnosis-first); likely client/store only, no migration.

## Goal

After a member edits their own "Riding since" year, the Riders list should show the new value (and group/sort by it) without a hard reload.

## Scope

- **BUG-089** (P2): editing your own "Riding since" (e.g. 2002 to 1999) is not reflected in the Riders list.

## DECISIONS (review before building)

1. **Where to apply the fresh value.** Recommended default: overlay the active user's `profileOverride` onto their entry in the people list so local edits show immediately (mirroring how the rest of the app reads the logged-in user's live profile). Alternative: refetch the catalog after a profile save. Default = overlay `profileOverride` for the active user (no refetch needed, instant).

## Diagnosis pointers (verified on live main)

- `src/app/people/page.tsx`
  - Reads from the store: `const { activePersonId, userEntities, catalog, activeCommunitySlug } = useLineageStore()` (line 179). It does NOT pull `profileOverride`.
  - The list is built at line 193: `const merged = [...catalog.people, ...(userEntities.people ?? [])]` (comment line 192: "catalog.people already merges the people table + registered profiles"). It does not apply the active user's `profileOverride`.
  - Renders `person.riding_since` (lines 104 to 105) and groups/sorts by it (lines 258 to 266).
- `src/store/lineage-store.ts`
  - `profileOverride: Partial<Person>` (line 77) holds the logged-in user's local edits; `updateProfile` merges updates into it (lines ~857 to 859: `set((s) => ({ profileOverride: { ...s.profileOverride, ...updates } }))`).
  - `catalog.people` is fetched once and is not persisted (per the codebase `CLAUDE.md` gotcha #4); it keeps the pre-edit `riding_since` until a fresh fetch.
- Lead hypothesis: the Riders list renders stale `catalog.people` for the active user because it never overlays `profileOverride`. Editing `riding_since` updates `profileOverride.riding_since` (and presumably persists to `profiles` via the profile PATCH), but the list does not read the override, so it shows the old year until the catalog is refetched on reload.
- Confirm: (a) the profile edit DOES persist to the DB (open `/people/cory_yip` directly after the edit; if the fresh value shows there, persistence is fine and this is purely the list overlay). (b) Whether other list surfaces (e.g. `/compare`, connections) share the same stale-`catalog.people` read for the active user.

## Suggested fix (on the default decision)

- In `src/app/people/page.tsx`, pull `profileOverride` from the store and, when building `merged`, replace the active user's entry with `{ ...person, ...profileOverride }` for `person.id === activePersonId` (only the active user has an override). Apply before the `riding_since` group/sort so the new year sorts correctly.
- If the diagnosis shows the edit does NOT persist to the DB at all (the value is also wrong on `/people/[id]` after a real reload), STOP and re-scope: that is a write-path bug in the profile-edit save, not a list-overlay bug. Note which case it was in the PR.

## Implementation order (suggested)

1. Reproduce: sign in, edit own "Riding since", check `/people` (stale) vs `/people/[id]` (fresh?) to confirm persistence.
2. Apply the `profileOverride` overlay for the active user in `people/page.tsx`.
3. `npx tsc --noEmit` clean. Smoke: edit "Riding since", return to `/people` without a hard reload, confirm the new year shows and the riding-since grouping/sort reflects it.

## Acceptance criteria

- Editing "Riding since" updates the value shown for that rider in the Riders list without a hard reload (or after the documented refetch), and the riding-since grouping/sort reflects the new year.
- No regression to other riders' values or to the community/all-communities filter.
- `npx tsc --noEmit` clean.

## Notes / guardrails

- Diagnosis-first; likely client/store only, no migration. If it turns out to be a write-path persistence bug, re-scope and do not ship the overlay alone.
- Auto-merge eligible ONLY if the fix is the client-side overlay (no migration, no auth/payments). If it becomes a write-path fix, treat as human-reviewed.
- Name **BUG-089** in the PR title or commit message (the daily reconcile greps for the ids).
- Append a `status: pending` entry to `bugs/SHIP-LOG.md` at session end. Do not edit earlier entries.
- No em dashes anywhere (code, comments, copy). Use periods, commas, parentheses, colons, or semicolons.
