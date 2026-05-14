# PB-009 Phase 3 — Deploy plan

Phase 3 lands the editor moderation surface on top of Phase 2's Owner Inbox:
member abuse reports, editor queue + rap sheet, asserter restriction with
cascade, unified action log, lifecycle wiring on story/claim DELETE.

## Pre-deploy assertion queries

Run these against PROD before applying the migrations. Each MUST return 0.

```sql
-- A1: tag_events status enum integrity
SELECT count(*) FROM tag_events
WHERE status NOT IN ('pending','approved','declined','disabled');

-- A2: no existing global blocks (Phase 3 introduces them)
SELECT count(*) FROM tag_blocklist WHERE scope = 'global';

-- A3: tag_blocklist no NULL subject_id today
SELECT count(*) FROM tag_blocklist WHERE subject_id IS NULL;

-- A4: tag_events with NULL asserter_id are only system/embed sources
SELECT count(*) FROM tag_events
WHERE asserter_id IS NULL AND source NOT IN ('system','public_timeline_embed');
```

If any returns non-zero, STOP and surface to Jay before continuing.

## Apply migrations

In order, via Supabase SQL editor:

1. `20260514000001_pb009_phase3_reports_and_action_log.sql`
   - 3 new enums (`tag_report_status`, `tag_action_actor_role`, `tag_action_kind`)
   - 1 enum extension (`tag_event_decline_category` += `lifecycle_destroyed`)
   - 3 new tables (`tag_reports`, `tag_action_log`, `tag_decision_notifications`)
   - All RLS-enabled, no policies (service-role only).

2. `20260514000002_pb009_phase3_global_block_unique_and_cascade.sql`
   - Partial UNIQUE index on `tag_blocklist (blocked_party, block_kind) WHERE scope='global'`
   - `apply_block_cascade()` function rewrite — same trigger, extended behaviour
     - Adds approved→disabled cascade for `scope='global'`
     - Writes `tag_action_log action='block_cascade'` rows inline per affected tag_event

## Post-deploy assertion queries

```sql
-- A5: tag_reports status enum integrity
SELECT count(*) FROM tag_reports
WHERE status NOT IN ('open','reviewed','dismissed','resolved_moment_destroyed');

-- A6: tag_action_log actor_role enum integrity
SELECT count(*) FROM tag_action_log
WHERE actor_role NOT IN ('owner','editor','asserter','reporter','system');

-- A7: tag_action_log NULL tag_event_id only on restrict/unrestrict
SELECT count(*) FROM tag_action_log
WHERE tag_event_id IS NULL
  AND action NOT IN ('restrict_asserter','unrestrict_asserter');

-- A8: no duplicate (tag_event_id, reported_by) pairs
SELECT tag_event_id, reported_by, count(*)
FROM tag_reports
GROUP BY tag_event_id, reported_by
HAVING count(*) > 1;
```

All MUST return 0 / no rows.

## Acceptance criteria pointers

See §12 of `pb009-phase3-editor-queue-brief.md` for the full 10-test list.
Quick summary (each runnable in <5 min):

- 12.1 Member can report a tag → `/me/tags` Report button + `tag_reports` insert
- 12.2 Editor sees the queue → `/admin/tag-queue` badge + card render
- 12.3 Editor dismisses a report → tag_event unchanged, report `status='dismissed'`
- 12.4 Editor declines a pending tag → `tag_events.status='declined'`, owner notified
- 12.5 Editor restricts an asserter → cascade declines pending + disables approved
- 12.6 Restricted asserter cannot tag → 403 on `/api/stories` POST or `/api/post-tag-event`
- 12.7 Editor unrestricts → blocklist row removed, prior cascade not reversed
- 12.8 Story DELETE during open report → reports auto-close, tag disabled
- 12.9 Claim DELETE during open report → same lifecycle
- 12.10 Moderation gate → founding-only blocked from `/admin/tag-queue`

## Rollback recipe

- Schema rollback (destructive): drop `tag_reports`, `tag_action_log`,
  `tag_decision_notifications`. Restore Phase 1 cascade function source.
- Code rollback (non-destructive): revert Phase 3 commits on main. Tables
  remain, but reports accumulate unread until re-deploy.
- Partial rollback: revert `apply_block_cascade()` to Phase 1 only (drops the
  approved-disable path). Editors can still moderate; restricts no longer
  retroactively cascade.

Pre-deploy: tag the pre-deploy SHA as `pre-pb009-phase3`.

## What this PR ships

**New tables:** `tag_reports`, `tag_action_log`, `tag_decision_notifications`.

**New enums / extensions:** `tag_report_status`, `tag_action_actor_role`,
`tag_action_kind`, `tag_event_decline_category` += `lifecycle_destroyed`.

**New library code:**
- `src/lib/decline-categories.ts` (extracted; replaces 3 inline copies)
- `src/components/ui/decline-modal.tsx` (extracted from `/me/tags`)
- `src/components/ui/report-tag-modal.tsx`
- `src/components/ui/restrict-asserter-modal.tsx`
- `src/lib/tag-action-log.ts` (`logTagAction`, `logTagActions`)
- `src/lib/emails/tag-decision-emails.ts` (Resend + dedup)
- `src/lib/tag-events.ts` — `isAsserterGloballyBlocked()` + pair-helper precheck
- `src/lib/auth.ts` — `requireModerator()` (tighter than `requireEditor()`)

**New API routes:**
- `GET /api/me/can-tag` (client precheck)
- `POST /api/me/tags/[id]/report`
- `GET /api/admin/tag-queue`
- `GET /api/admin/tag-queue/count`
- `PATCH /api/admin/tag-events/[id]/decide`
- `POST /api/admin/tag-events/bulk-dismiss-reports`
- `POST /api/admin/asserters/[id]/restrict`
- `DELETE /api/admin/asserters/[id]/restrict`
- `GET /api/admin/asserters/[id]` (rap sheet)

**Modified routes / state:**
- `/api/admin` claim DELETE — Q10 lifecycle fix
- `/api/stories` POST / PATCH / DELETE — block precheck + report auto-close + log
- `/api/me/tags/[id]/decide`, `/api/me/tags/bulk-decide` — owner-decide auto-close + log
- `/api/post-tag-event` — server-side block rollback
- `lineage-store.addClaim` — Q2a precheck before client claim insert
- Store: `editorQueuePendingCount` slice + `refreshEditorQueuePendingCount()`
- `PendingTagPoller` — extended to poll editor queue when `is_editor`

**New pages:**
- `/admin/tag-queue` (server + client component)
- `/admin/asserters/[id]` (server + client component)

**Wired surfaces:**
- `/me/tags` Report button → `ReportTagModal` → POST `/api/me/tags/[id]/report`
- `/admin` header → "Tag Queue" link gated on `is_editor`, amber badge with
  `editorQueuePendingCount`
