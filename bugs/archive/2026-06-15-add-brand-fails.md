# Bug-fix brief: Adding a brand fails with "Failed to save brand" (BUG-042)

> Build-ready. Self-contained. Drafted June 15, 2026 by the daily triage. Root cause verified against the live repo. Name **BUG-042** in the PR title or commit message.

## Goal
Let a non-editor member add a brand on `/snowboarding/brands` without it failing. The brand should persist as `community_status='unverified'` and award a contribution token, exactly like adding a place or a board does today.

## DECISIONS (review before building)
No open product decisions. One implementation choice with a recommended default:
- **Where the org create routes.** Recommended default: route `addUserOrg` through the existing member-allowed `/api/catalog/entity` endpoint with `type: "org"`, mirroring `addUserPlace` and `addUserBoard`. Alternative (not recommended): open `/api/admin` to non-editors, which would weaken the editor gate. Use the default.

## Root cause (verified)
`addUserOrg` in `src/store/lineage-store.ts` (around line 589 to 614) still POSTs new brands to `/api/admin`:

```
fetch("/api/admin", { method: "POST", ...
  body: JSON.stringify({ operation: "insert", table: "orgs", data: { ... added_by: get().activePersonId } }) })
```

`/api/admin` is `requireEditor`-gated, so a non-editor member (for example a Lifetime member who is not `is_editor`) gets a 403, the optimistic insert rolls back, and the store fires the `"Failed to save brand. Please try again."` toast (lines 610 and 612). This is the same class of bug already fixed for claims (BUG-022), places, and boards. Those now post to the member-allowed `/api/catalog/entity` route:
- `addUserPlace` (`src/store/lineage-store.ts:548`) posts `{ type: "place", data: {...} }` to `/api/catalog/entity`.
- `addUserBoard` (`src/store/lineage-store.ts:573`) posts `{ type: "board", data: {...} }` to `/api/catalog/entity`.

Both routes whitelist fields, dedupe on name, and award a contribution token server-side. Brands (`addUserOrg`) were missed in that migration and are the only `addUser*` catalog create still hitting `/api/admin`.

## Suspected files (verified present)
- `src/store/lineage-store.ts`: `addUserOrg` (the only change needed on the client).
- `src/app/api/catalog/entity/route.ts`: confirm it accepts `type: "org"` and whitelists the org fields; add the `org` branch if it is missing (places and boards are already handled there).
- For reference only (do not change the gate): `src/lib/auth.ts` (`requireEditor`), `src/app/api/admin/route.ts`.

## Implementation order
1. Read `src/app/api/catalog/entity/route.ts`. Confirm whether it already handles an `org`/brand type. If not, add an `org` branch that inserts into `orgs` with a whitelisted field set: `id, name, org_type, brand_category, founded_year, country, website, description`, plus `community_status: 'unverified'` and `added_by` from the authed user (server-side, not from the client body). Match the place/board branches for dedupe-on-name and contribution-token award.
2. In `src/store/lineage-store.ts`, change `addUserOrg` to POST `{ type: "org", data: {...} }` to `/api/catalog/entity` instead of `/api/admin`, matching the shape of `addUserPlace` / `addUserBoard`. Keep the optimistic insert and the rollback-on-failure; keep the existing toast text for genuine failures.
3. Confirm the org fields the modal collects map to the whitelisted set (`add-entity-modal.tsx` / the brands add flow). Drop `added_by` from the client body if the route stamps it server-side.

## Acceptance criteria
- Signed in as a NON-editor member, adding a brand on `/snowboarding/brands` succeeds: the brand persists (survives reload), no "Failed to save brand" toast.
- The new brand lands with `community_status='unverified'`.
- Adding a brand awards a contribution token to the member, like place/board adds (verify a `token_events` row, consistent with BUG-012 / PR #61).
- Editors can still add brands (no regression).
- `npx tsc --noEmit` is clean.

## Pre-flight / verification SQL
After a member adds a test brand "FNRad Test":
```
select id, name, org_type, community_status, added_by from orgs where name ilike 'FNRad Test%';
select * from token_events where person_id = '<member uuid>' order by created_at desc limit 3;
```

## Notes
- No migration. Pure client + (possibly) one API-route branch.
- No `_public` view change: orgs are not read through a `*_public` view in the same way claims/story_riders are; confirm during the read pass, but this is additive insert behavior, not a publicly-read new column.
- No em dashes anywhere you write (code, comments, copy). Append a `status: pending` SHIP-LOG entry naming BUG-042 before you close.
