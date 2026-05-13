# PB-009 Phase 1 — deploy runbook

Five migrations + code changes. Run order is load-bearing; the backfill must
run AFTER the code is deployed so existing rows stay visible during the
window between schema and pairing.

## Migration files

| Order | File | What it does |
|---|---|---|
| 1 | `20260513000001_pb009_tag_events.sql` | enums + `tag_events` table + indexes + updated_at trigger + RLS |
| 2 | `20260513000002_pb009_blocklist_trust_throttle.sql` | `tag_blocklist`, `tag_trust`, `tag_throttle` + `apply_block_cascade()` trigger |
| 3 | `20260513000003_pb009_additive_columns.sql` | `tag_event_id` on `story_riders`/`claims`, tier cache + visitor-display columns on `profiles`/`events`/`places`/`stories` |
| 4 | `20260513000004_pb009_public_views.sql` | `story_riders_public` + `claims_public` views with `security_invoker = true` |
| 5 | `20260513000005_pb009_backfill.sql` | system-approved `tag_event` per existing `story_riders` row and per person-implicating `claims` row |

All migrations are **idempotent** — enum DO blocks, `IF NOT EXISTS` table /
index / column guards, `WHERE tag_event_id IS NULL` clauses on the backfill.
Safe to re-run.

## Deploy sequence

### A. Apply schema (no code change yet)

In Supabase dashboard SQL editor, run migrations 1 → 4 in order. Each
returns silently on success. After 4:

```sql
-- sanity check that the views exist
SELECT count(*) FROM story_riders_public;
SELECT count(*) FROM claims_public;
```

These should return the same counts as `story_riders` / `claims` (the
grandfathered NULL clause keeps everything visible).

### B. Deploy code

Merge the PR. Vercel auto-deploys to production. The deploy includes:

- new `src/lib/tag-events.ts` helper module
- write-path wiring in `src/app/api/stories/route.ts`, `src/app/api/post-tag-event/route.ts`, `src/app/api/admin/scan-results/confirm/route.ts`
- client wiring in `src/store/lineage-store.ts` to pass `claim_id` + `predicate`
- read paths repointed to `claims_public` / `story_riders_public`

After deploy, **immediately** create a test story tagging a rider and confirm
in SQL editor:

```sql
SELECT te.id, te.source, te.status, te.subject_id, te.predicate, te.moment_ref
  FROM tag_events te
 ORDER BY te.created_at DESC
 LIMIT 1;
-- → source='member', status='approved', predicate='story_tag', moment_ref has story_id

SELECT sr.story_id, sr.rider_id, sr.tag_event_id
  FROM story_riders sr
 WHERE sr.tag_event_id IS NOT NULL
 ORDER BY sr.story_id DESC
 LIMIT 1;
-- → tag_event_id matches the row above
```

### C. Run the backfill

After confirming new writes pair correctly, run migration 5:

```sql
-- Migration 5: backfill
-- Returns NOTICE lines with row counts pre / post.
```

Verify acceptance criterion #2:

```sql
SELECT count(*) AS unpaired_story_riders
  FROM story_riders WHERE tag_event_id IS NULL;
-- → 0

SELECT count(*) AS unpaired_person_claims
  FROM claims c
 WHERE c.tag_event_id IS NULL
   AND c.asserted_by IS NOT NULL
   AND (
     (c.subject_type = 'person' AND c.subject_id <> c.asserted_by::text)
     OR
     (c.object_type  = 'person' AND c.object_id  <> c.asserted_by::text)
   );
-- → 0
```

Self-claims (subject = asserter, object is a place/board/event) intentionally
keep `tag_event_id = NULL` — they're not tags, they're first-person history.
The `claims_public` view treats NULL as approved, so they stay visible.

## Verification checklist (acceptance criteria §5)

- [ ] Migrations 1-4 ran cleanly. `tag_events`, `tag_blocklist`, `tag_trust`,
      `tag_throttle` tables exist. Views `story_riders_public` /
      `claims_public` exist.
- [ ] Production UX unchanged. `/profile` and `/people/*` show every existing
      claim / story / rider tag as before.
- [ ] New story → paired tag_event row appears in SQL with
      `source='member'`, `status='approved'`, `predicate='story_tag'`,
      matching `tag_event_id` on `story_riders`.
- [ ] Block-cascade trigger fires. Manual test in SQL:
      ```sql
      BEGIN;
      -- Insert a pending tag_event manually
      INSERT INTO tag_events (source, asserter_id, subject_id, subject_tier_at_assert, predicate, moment_ref, status)
      VALUES ('public_timeline_embed', NULL, '<some-user-id>', 'standard', 'test', '{}'::jsonb, 'pending');
      -- Block the same email_hash globally
      INSERT INTO tag_blocklist (subject_id, blocked_party, block_kind, scope, created_by)
      VALUES (NULL, 'fake_email_hash', 'email', 'global', '<your-user-id>');
      -- Update the test row's visitor record to match
      UPDATE tag_events SET asserter_visitor_record = '{"email_hash": "fake_email_hash"}'::jsonb
       WHERE predicate = 'test';
      -- Re-insert a duplicate block (should cascade)
      ROLLBACK;
      ```
      (The cascade fires on the second INSERT into `tag_blocklist`; rollback
      to avoid persisting test data.)
- [ ] Backfill verification queries return 0 unpaired rows.
- [ ] `npx tsc --noEmit` clean (verified in worktree).
- [ ] No regressions on PB-008 Phase 2 — re-create a story with a rider
      tag, confirm the ambient-growth `person_invite_notifications` flow
      still fires (it runs in parallel with the new tag_event pairing).

## Rollback plan

If the deploy goes wrong **after migration 5**:

1. The code is the part most likely to break. Revert the PR; Vercel
   redeploys the previous version. The views remain, but old code reads
   directly from the underlying tables (where every row is still present and
   `tag_event_id` is just an extra column it ignores).
2. The tag_events / tag_blocklist tables are additive — they can stay. No
   data loss.
3. If a column needs to be removed, the additive columns in Migration C are
   the only schema dependency; reverting them is `ALTER TABLE ... DROP
   COLUMN IF EXISTS tag_event_id;`.

If a migration fails partway:

- All migrations are idempotent — re-run the failing one. Enum creation,
  table creation, index creation, and column addition all use `IF NOT
  EXISTS` or `EXCEPTION WHEN duplicate_object` guards.

## Phase-2 handoff notes

The single point of behaviour change for Phase 2 is `defaultStatusForSource`
in `src/lib/tag-events.ts` (renamed from `defaultStatusForPhase1` at the
start of Phase 2). Flip the `case "member"` branch to return `"pending"`
and the `/me/tags` build can begin.

The block-cascade trigger and the `tag_trust` table are ready for Phase 2
without further migration. The owner inbox should:

- Read pending tags from `tag_events WHERE subject_id = $me AND status = 'pending'`
- Approve → `UPDATE tag_events SET status = 'approved', decision_by, decision_at`
- Decline → same with `decision_reason_category`
- Block + decline (composite) → `INSERT INTO tag_blocklist (...)` which auto-cascades
- Trust → `INSERT INTO tag_trust (...)`
