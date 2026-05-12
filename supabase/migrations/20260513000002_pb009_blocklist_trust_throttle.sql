-- ============================================================================
-- PB-009 Phase 1 (Migration B) — tag_blocklist, tag_trust, tag_throttle
-- ============================================================================
--
-- Schema-only support for the owner-controlled trust + block features (Phase
-- 2) and the three-layer rate-limit logic (Phase 5). Phase 1 ALSO ships the
-- block-time cascade trigger so the data path is correct from day one — Phase
-- 2 just adds the UI that invokes it.
--
-- Idempotent enum DO blocks + IF NOT EXISTS table/index/constraint guards.

-- ── Enums ───────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE tag_block_kind AS ENUM ('user', 'email', 'ip');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tag_block_scope AS ENUM ('subject', 'global');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tag_throttle_actor AS ENUM ('ip', 'email', 'asserter');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tag_throttle_layer AS ENUM ('L1_email', 'L2_ip', 'L3_saturation');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── tag_blocklist ───────────────────────────────────────────────────────────
-- subject_id is the OWNER doing the blocking (the person being tagged who
-- wants to stop a specific party from tagging them again). blocked_party is
-- the asserter id (block_kind='user'), email hash, or ip hash being blocked.
-- scope='subject' blocks only against subject_id; scope='global' blocks
-- everywhere (created by editors during Phase 3 spam triage).

CREATE TABLE IF NOT EXISTS public.tag_blocklist (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id     uuid REFERENCES public.profiles(id),
  blocked_party  text NOT NULL,
  block_kind     tag_block_kind NOT NULL,
  scope          tag_block_scope NOT NULL DEFAULT 'subject',
  created_by     uuid NOT NULL REFERENCES public.profiles(id),
  reason         text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tag_blocklist
  ADD COLUMN IF NOT EXISTS scope      tag_block_scope NOT NULL DEFAULT 'subject',
  ADD COLUMN IF NOT EXISTS reason     text;

-- Idempotent composite UNIQUE for block-creation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.tag_blocklist'::regclass
       AND conname  = 'tag_blocklist_subject_party_kind_uniq'
  ) THEN
    ALTER TABLE public.tag_blocklist
      ADD CONSTRAINT tag_blocklist_subject_party_kind_uniq
      UNIQUE (subject_id, blocked_party, block_kind);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS tag_blocklist_subject
  ON public.tag_blocklist (subject_id, block_kind);

CREATE INDEX IF NOT EXISTS tag_blocklist_global
  ON public.tag_blocklist (block_kind) WHERE scope = 'global';

-- ── tag_trust ───────────────────────────────────────────────────────────────
-- Per-subject trust list. Phase 2 will auto-approve incoming tags from
-- trusted_asserter_id. Phase 1 creates the schema only.

CREATE TABLE IF NOT EXISTS public.tag_trust (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id           uuid NOT NULL REFERENCES public.profiles(id),
  trusted_asserter_id  uuid NOT NULL REFERENCES public.profiles(id),
  created_at           timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.tag_trust'::regclass
       AND conname  = 'tag_trust_subject_asserter_uniq'
  ) THEN
    ALTER TABLE public.tag_trust
      ADD CONSTRAINT tag_trust_subject_asserter_uniq
      UNIQUE (subject_id, trusted_asserter_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS tag_trust_lookup
  ON public.tag_trust (subject_id, trusted_asserter_id);

-- ── tag_throttle ────────────────────────────────────────────────────────────
-- Rolling-window counters for the three-layer rate limits (Phase 5).
-- Phase 1: schema only — no enforcement logic.

CREATE TABLE IF NOT EXISTS public.tag_throttle (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_kind      tag_throttle_actor NOT NULL,
  actor_key       text NOT NULL,
  scope_owner_id  uuid REFERENCES public.profiles(id),
  layer           tag_throttle_layer NOT NULL,
  window_start    timestamptz NOT NULL,
  tag_count       integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS tag_throttle_lookup
  ON public.tag_throttle (actor_kind, actor_key, scope_owner_id, layer, window_start DESC);

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.tag_blocklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tag_trust     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tag_throttle  ENABLE ROW LEVEL SECURITY;
-- No policies. Service role only. Owner-facing UI in Phase 2 reaches these
-- via API routes that authenticate with requireAuth + use getServiceClient.

-- ── Block-time cascade trigger ──────────────────────────────────────────────
-- Spec §7: blocking an asserter auto-declines their pending tags against the
-- subject (or globally if scope='global'). Implemented at the DB layer so
-- correctness is independent of which path inserts the block — Phase 2 owner
-- UI, Phase 3 editor escalation, future bulk imports all behave the same.
--
-- AFTER INSERT (not BEFORE) so the new row is committed before we cascade —
-- if the cascade UPDATE inside this trigger ever errors, the block insertion
-- still rolls back together (we're inside the same transaction), but
-- concurrent reads see the block first.

CREATE OR REPLACE FUNCTION public.apply_block_cascade()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.block_kind = 'user' THEN
    UPDATE public.tag_events
       SET status                   = 'declined',
           decision_by              = NEW.created_by,
           decision_at              = now(),
           decision_reason_category = 'spam',
           updated_at               = now()
     WHERE status = 'pending'
       AND asserter_id IS NOT NULL
       AND asserter_id::text = NEW.blocked_party
       AND (NEW.scope = 'global' OR subject_id = NEW.subject_id::text);

  ELSIF NEW.block_kind = 'email' THEN
    UPDATE public.tag_events
       SET status                   = 'declined',
           decision_by              = NEW.created_by,
           decision_at              = now(),
           decision_reason_category = 'spam',
           updated_at               = now()
     WHERE status = 'pending'
       AND source = 'public_timeline_embed'
       AND asserter_visitor_record->>'email_hash' = NEW.blocked_party
       AND (NEW.scope = 'global' OR subject_id = NEW.subject_id::text);

  ELSIF NEW.block_kind = 'ip' THEN
    UPDATE public.tag_events
       SET status                   = 'declined',
           decision_by              = NEW.created_by,
           decision_at              = now(),
           decision_reason_category = 'spam',
           updated_at               = now()
     WHERE status = 'pending'
       AND source = 'public_timeline_embed'
       AND asserter_visitor_record->>'ip_hash' = NEW.blocked_party
       AND (NEW.scope = 'global' OR subject_id = NEW.subject_id::text);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tag_blocklist_cascade ON public.tag_blocklist;
CREATE TRIGGER tag_blocklist_cascade
  AFTER INSERT ON public.tag_blocklist
  FOR EACH ROW EXECUTE FUNCTION public.apply_block_cascade();

COMMENT ON TABLE public.tag_blocklist IS
  'PB-009 Phase 1. Owner- and editor-managed block list. Insertion fires apply_block_cascade() which auto-declines the blocked party''s pending tag_events. Spec §7.';
COMMENT ON TABLE public.tag_trust     IS
  'PB-009 Phase 1. Per-subject trust list. Phase 2 auto-approves tags from trusted asserters; Phase 1 ships schema only.';
COMMENT ON TABLE public.tag_throttle  IS
  'PB-009 Phase 1. Rolling-window counters for three-layer rate limits (Phase 5). Schema only — no enforcement logic in Phase 1.';
