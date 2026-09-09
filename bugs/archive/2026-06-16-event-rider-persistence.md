# Diagnosis + fix brief: event +Add rider does not persist on the event roster (BUG-060)

> Drafted from the June 16 Cowork code trace + Jay's confirmed repro. P1, the only open P1.
> DIAGNOSIS-FIRST: confirm the root cause with the step-1 queries before changing code, then apply the matching fix.
> One PR. Name BUG-060 in the PR title.
> NOTE: depending on the confirmed cause this may touch a `_public` view / RLS, which is excluded from autonomous auto-merge. Human-reviewed session.

## Confirmed repro (Jay, June 16)
- Added 33 riders to a STORY about an event: all showed up instantly AND persisted. (story path works.)
- Added the same riders to the EVENT page via "+Add rider": they appear when added, then ALL disappear on page refresh. Expected them to stay as event participants.
- Live page: https://linestry.com/snowboarding/events/Westbeach_Classic_1993

## What the code trace already established (do not re-derive)
- **Write path is correct and persists.** Event "+Add rider" calls `addRiderClaim` (`src/app/(community)/[community]/events/[id]/page.tsx:493`) which fires the store `addClaim` with `{subject_id: riderId, subject_type:"person", predicate: competed_at|spectated_at|organized_at, object_id: eventId, object_type:"event", asserted_by: me}`. `addClaim` (`src/store/lineage-store.ts:327`) optimistically pushes to `sessionClaims` (so it APPEARS immediately), then POSTs to `/api/claims`. On success it removes from `sessionClaims` and pushes the claim into IN-MEMORY `dbClaims` (line 396-399) — this is why it stays visible for the rest of the session but is not backed by a persistent read.
- `/api/claims` (`src/app/api/claims/route.ts:162`) inserts the row with the service-role client (bypasses RLS) and pairs a `tag_event` via `pairClaimTagEvents` (`src/lib/tag-events.ts`): `source:"member"` so the tag_event status is `'pending'`, subject = the rider; the first tag_event is linked back to `claims.tag_event_id`.
- **Read path on refresh:** the event roster reads `allClaims = [...catalog.claims, ...sessionClaims, ...dbClaims]` (`events/[id]/page.tsx:36`) filtered to `object_id === eventId`. After refresh, `dbClaims` (in-memory) is gone and `sessionClaims` no longer holds the row, so the roster depends entirely on **`catalog.claims`, which `loadCatalog` reloads from `supabase.from("claims_public").select("*")`** (`lineage-store.ts:181`).
- `claims_public` (latest def: `supabase/migrations/20260514000001_pb009_permissive_tag_visibility.sql`) is **`WITH (security_invoker = true)`** and shows a row when `tag_event_id IS NULL OR status='approved' OR (status='pending' AND COALESCE(profiles.require_tag_approval,false)=false)`. The pending + ghost-subject case is permissive, so the visibility filter alone should NOT hide these.

So: the row persists, the visibility predicate is permissive, yet it vanishes on reload. The gap is on the READ, and the leading suspect is the view's `security_invoker` re-applying the caller's RLS on the base `claims` table.

## Ranked hypotheses (diagnose in this order)
1. **LEAD: `security_invoker=true` on `claims_public` re-applies a restrictive SELECT RLS policy on `claims`.** BUG-022 established the `claims` INSERT policy only admits `subject_id = auth.uid()` rows. If the SELECT policy is the same subject=self shape, then a `security_invoker` view runs under the caller's role and RLS, so a `competed_at` claim whose subject is the RIDER (not the asserter, not the viewer) is filtered out on read for everyone except that rider, EVEN THOUGH it persisted via the service-role insert. This exactly fits: appears in-session (in-memory `dbClaims`), gone on refresh (`claims_public` RLS-filters it). It does NOT affect the story path because `story_riders` / `story_events` are a different table with their own (public) read policy. The `_public` views were designed to BE the visibility gate, so double-gating them with the legacy subject=self SELECT policy via `security_invoker` is very likely the defect.
2. **PostgREST 1000-row default cap** on `claims_public.select("*")` in `loadCatalog` (no `.range`/`.limit`). If prod has >1000 public claims, rows beyond the cap drop out of `catalog.claims`; freshly added event claims may fall outside the returned window. Would also cause other rosters to be sporadically incomplete.
3. **Tag_event status / subject mismatch:** the paired tag_event landed `declined`/`disabled`, or the subject is a real member profile with `require_tag_approval=true`, hiding the pending row. (Default is false, so lower likelihood, but the 33 riders include real members.)
4. **`claims.tag_event_id` linkage:** `pairClaimTagEvents` only FKs the FIRST tag_event to `claims.tag_event_id`; confirm the linked tag_event's `subject_id` matches the rider the view joins `profiles` on.

## Step 1 — diagnosis queries (run against prod before any code change)
Resolve the event id for `Westbeach_Classic_1993` first (slug -> id), then with the SERVICE-ROLE client:
- `select count(*) from claims where object_id = '<eventId>' and predicate in ('competed_at','spectated_at','organized_at');`  -- did the rows persist? (expect ~33)
- `select c.id, c.subject_id, c.tag_event_id, t.status, t.subject_id as tag_subject, p.require_tag_approval from claims c left join tag_events t on t.id=c.tag_event_id left join profiles p on p.id::text=t.subject_id where c.object_id='<eventId>';`  -- statuses + gate per row.
- `select count(*) from claims_public where object_id='<eventId>';`  -- run this as SERVICE ROLE and again as the ASSERTER/anon role. **If the service-role count >> the caller-role count, Hypothesis 1 is confirmed.**
- Check the `claims` table RLS SELECT policy directly (Supabase dashboard -> Auth -> Policies, or `select polname, polcmd, pg_get_expr(polqual, polrelid) from pg_policy where polrelid='public.claims'::regclass;`). A `subject_id = auth.uid()` (or similar self-only) USING expr on the SELECT policy confirms the lead.
- `select count(*) from claims_public;`  -- if near or above 1000, factor in Hypothesis 2.

## Fixes (apply the one the diagnosis confirms)
- **If Hypothesis 1 (lead):** the `_public` views are meant to be the visibility authority, so the base-table SELECT RLS should not also gate them. Two safe options, pick per the diagnosis:
  - (a) Recreate `claims_public` (and, for parity, `story_riders_public`) WITHOUT `security_invoker` (i.e. security-definer view owned by a role that can read all `claims`), so the view's WHERE clause is the sole visibility filter. This matches the documented design intent ("public reads must query this view"). MIGRATION + `_public` view rebuild: human-reviewed, NOT auto-merge.
  - (b) Add a permissive public SELECT policy on `claims` for `visibility='public'` rows so `security_invoker` reads succeed, leaving the restrictive INSERT policy intact. MIGRATION/RLS change: human-reviewed.
  - Whichever is chosen, re-run the asserter-role `claims_public` count to confirm the 33 rows now return, and confirm anon (logged-out) sees them on the live event page.
- **If Hypothesis 2:** paginate the `claims_public` read in `loadCatalog` (range loop) or scope the event roster to a per-event fetch. No migration.
- **If Hypothesis 3/4:** correct the tag_event status default or the pairing/subject linkage for event-rider claims; re-run the per-row query.

## Acceptance
- 33 riders added to `Westbeach_Classic_1993` via "+Add rider" persist on the event roster after a hard refresh, in the correct pending/approved state.
- A logged-out visitor sees the same event participants on the live page (the roster is not asserter-only).
- The story-connected riders still render (no regression to the working story path).
- If a moderation gate is ever intended, the UI tells the user the add is pending rather than silently dropping it on reload.
- `npx tsc --noEmit` clean.

## Notes
Diagnosis-first; do not ship a blind fix. If the fix touches a `_public` view or RLS (Hypotheses 1 / 3 / 4 likely do), it is a migration + view rebuild: human-reviewed session, excluded from autonomous auto-merge, and remember the `_public` view freeze rule (rebuild the view, do not rely on `SELECT c.*` picking up changes). One PR, BUG-060 in the title. Append a `status: pending` SHIP-LOG entry. No em dashes anywhere. `bugs/` is gitignored; do not commit it.
PostHog replay for the report: `S-08` (offset 841s).
