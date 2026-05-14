-- ============================================================================
-- PB-009 Phase 3 (Migration A) — tag_reports, tag_action_log, decision_notifications
-- ============================================================================
--
-- New tables for the editor moderation surface:
--
--   - tag_reports                  N:M member-filed abuse reports on tag_events
--   - tag_action_log               unified audit log for state changes that
--                                  tag_events.decision_* doesn't represent
--                                  (restricts, report state changes, lifecycle
--                                  disables, block cascades)
--   - tag_decision_notifications   per PB-008 convention, dedup-by-type record
--                                  of owner-notification fires when an editor
--                                  declines a pending tag
--
-- Phase 3 leaves the existing Phase 1 tables untouched — all new state lives
-- in the three tables above. Idempotent DO blocks + IF NOT EXISTS guards
-- mirror Phase 1's conventions.

-- ── New enums ──────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE tag_report_status AS ENUM (
    'open',
    'reviewed',                    -- editor closed by taking action on the tag_event
    'dismissed',                   -- editor closed with no action
    'resolved_moment_destroyed'    -- system auto-closed when the underlying moment was deleted
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tag_action_actor_role AS ENUM (
    'owner',     -- the tagged person
    'editor',    -- a moderator
    'asserter',  -- the person who created the tag (for completeness; rarely used)
    'reporter',  -- a member filing an abuse report
    'system'     -- background lifecycle (claim/story delete, cascade)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tag_action_kind AS ENUM (
    'approve',
    'decline',
    'override_approve',                  -- reserved for Phase 4+
    'override_decline',                  -- reserved for Phase 4+
    'block_cascade',                     -- triggered by tag_blocklist insert
    'trust_cascade',                     -- reserved; tag_trust insert hook (Phase 5+)
    'lifecycle_disable',                 -- story or claim DELETE
    'restrict_asserter',                 -- editor inserts scope=global block
    'unrestrict_asserter',               -- editor removes scope=global block
    'report_open',                       -- member files a report
    'report_close_action',               -- editor closed report by acting on tag_event
    'report_close_dismiss',              -- editor closed report without action
    'report_resolved_moment_destroyed'   -- system auto-closed report on moment delete
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Extend Phase 1's decline-category enum with a Phase 3 lifecycle reason.
-- Used when a story/claim DELETE flips paired tag_events to disabled. More
-- honest than reusing 'other'.
DO $$ BEGIN
  ALTER TYPE tag_event_decline_category ADD VALUE IF NOT EXISTS 'lifecycle_destroyed';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── tag_reports ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tag_reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_event_id    uuid NOT NULL REFERENCES public.tag_events(id) ON DELETE CASCADE,
  reported_by     uuid NOT NULL REFERENCES public.profiles(id),
  reason_category tag_event_decline_category NOT NULL,
  reason_note     text,                                    -- editor-only
  status          tag_report_status NOT NULL DEFAULT 'open',
  reviewed_by     uuid REFERENCES public.profiles(id),
  reviewed_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.tag_reports'::regclass
       AND conname  = 'tag_reports_tag_event_reporter_uniq'
  ) THEN
    ALTER TABLE public.tag_reports
      ADD CONSTRAINT tag_reports_tag_event_reporter_uniq
      UNIQUE (tag_event_id, reported_by);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS tag_reports_status_created
  ON public.tag_reports (status, created_at DESC);

CREATE INDEX IF NOT EXISTS tag_reports_tag_event
  ON public.tag_reports (tag_event_id);

CREATE INDEX IF NOT EXISTS tag_reports_reporter
  ON public.tag_reports (reported_by, created_at DESC);

-- Hot path for the queue's default Open view; partial keeps it tight as the
-- closed-state tail accumulates.
CREATE INDEX IF NOT EXISTS tag_reports_open_recent
  ON public.tag_reports (created_at DESC)
  WHERE status = 'open';

ALTER TABLE public.tag_reports ENABLE ROW LEVEL SECURITY;
-- No policies — service-role only, matches tag_events posture.

COMMENT ON TABLE public.tag_reports IS
  'PB-009 Phase 3. Member-filed abuse reports against tag_events. N:M with UNIQUE (tag_event_id, reported_by). Reporter identity visible to editors only.';

-- ── tag_action_log ─────────────────────────────────────────────────────────
--
-- tag_event_id is nullable: restrict_asserter / unrestrict_asserter actions
-- are scoped to an asserter, not a specific tag_event. A CHECK constraint
-- enforces NOT NULL for every other action kind.

CREATE TABLE IF NOT EXISTS public.tag_action_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_event_id    uuid REFERENCES public.tag_events(id) ON DELETE CASCADE,
  asserter_id     uuid REFERENCES public.profiles(id),    -- denormalised; rap-sheet hot path
  actor_id        uuid REFERENCES public.profiles(id),    -- NULL for system actions
  actor_role      tag_action_actor_role NOT NULL,
  action          tag_action_kind NOT NULL,
  prior_status    tag_event_status,
  new_status      tag_event_status,
  reason_category tag_event_decline_category,
  reason_note     text,                                   -- editor-only
  related_report  uuid REFERENCES public.tag_reports(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.tag_action_log'::regclass
       AND conname  = 'tag_action_log_tag_event_required'
  ) THEN
    ALTER TABLE public.tag_action_log
      ADD CONSTRAINT tag_action_log_tag_event_required
      CHECK (
        action IN ('restrict_asserter','unrestrict_asserter')
        OR tag_event_id IS NOT NULL
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS tag_action_log_tag_event
  ON public.tag_action_log (tag_event_id, created_at DESC)
  WHERE tag_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS tag_action_log_actor
  ON public.tag_action_log (actor_id, created_at DESC)
  WHERE actor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS tag_action_log_action
  ON public.tag_action_log (action, created_at DESC);

-- Hot path for the rap sheet: "all log entries where the related tag_event's
-- asserter was X". asserter_id is denormalised on log insert to keep this a
-- direct lookup rather than a join through tag_events.
CREATE INDEX IF NOT EXISTS tag_action_log_asserter
  ON public.tag_action_log (asserter_id, created_at DESC)
  WHERE asserter_id IS NOT NULL;

ALTER TABLE public.tag_action_log ENABLE ROW LEVEL SECURITY;
-- No policies — service-role only.

COMMENT ON TABLE public.tag_action_log IS
  'PB-009 Phase 3. Unified audit log for state changes that tag_events.decision_* does not represent (restricts, report state changes, lifecycle disables, block cascades). Indefinite retention.';

-- ── tag_decision_notifications ─────────────────────────────────────────────
--
-- Mirrors PB-008 Phase 2's person_invite_notifications dedup pattern. When an
-- editor declines a pending tag, the owner is notified by category (via
-- Resend). The notification row is the dedup key so a re-decline never sends
-- two emails.

CREATE TABLE IF NOT EXISTS public.tag_decision_notifications (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_event_id      uuid NOT NULL REFERENCES public.tag_events(id) ON DELETE CASCADE,
  subject_id        uuid NOT NULL REFERENCES public.profiles(id),  -- the owner being notified
  notification_type text NOT NULL,                                 -- 'editor_decline' today; future kinds slot in here
  decided_by        uuid REFERENCES public.profiles(id),
  reason_category   tag_event_decline_category,
  sent_at           timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.tag_decision_notifications'::regclass
       AND conname  = 'tag_decision_notifications_dedup'
  ) THEN
    ALTER TABLE public.tag_decision_notifications
      ADD CONSTRAINT tag_decision_notifications_dedup
      UNIQUE (tag_event_id, notification_type);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS tag_decision_notifications_subject
  ON public.tag_decision_notifications (subject_id, sent_at DESC);

ALTER TABLE public.tag_decision_notifications ENABLE ROW LEVEL SECURITY;
-- No policies — service-role only.

COMMENT ON TABLE public.tag_decision_notifications IS
  'PB-009 Phase 3. Dedup record of owner-notification emails fired on editor decline. Mirrors PB-008 person_invite_notifications convention. UNIQUE (tag_event_id, notification_type) guarantees one email per decision.';
