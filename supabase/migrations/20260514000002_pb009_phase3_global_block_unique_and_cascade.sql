-- ============================================================================
-- PB-009 Phase 3 (Migration B) — global-block partial unique + cascade rewrite
-- ============================================================================
--
-- Two related changes:
--
-- 1. Add a partial UNIQUE index on (blocked_party, block_kind) WHERE scope =
--    'global'. The Phase 1 UNIQUE (subject_id, blocked_party, block_kind) does
--    not cover global blocks because NULL subject_id is treated as distinct by
--    Postgres — without this index two editors could each insert a global
--    block on the same asserter.
--
-- 2. Extend apply_block_cascade() so scope='global', block_kind='user' blocks
--    ALSO flip status='approved' → status='disabled' for the restricted
--    asserter's existing tag_events. Today the cascade only touches 'pending'
--    rows. Spam cleanup expectation: a global restrict should retroactively
--    take down the asserter's prior approved tags too.
--
-- 3. Write a tag_action_log row for each cascade-affected tag_event so the
--    rap sheet can attribute the status change to the cascade rather than a
--    decision_by-driven event. Same trigger function does this inline via
--    UPDATE ... RETURNING + INSERT in a single PL/pgSQL block.

-- ── Partial unique on global blocks (Q13) ─────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS tag_blocklist_global_party_kind
  ON public.tag_blocklist (blocked_party, block_kind)
  WHERE scope = 'global';

-- ── Cascade rewrite (Q7) ───────────────────────────────────────────────────
--
-- The existing trigger attachment from Phase 1 stays; CREATE OR REPLACE on
-- the function body is enough to upgrade the behaviour. The function body
-- below preserves every Phase 1 path and adds:
--
--   - On scope='global' AND block_kind='user': also UPDATE approved → disabled
--   - Each affected tag_event gets a tag_action_log row attributing the change
--
-- Embed-source paths (email/ip) keep the Phase 1 pending-only behaviour.
-- Approved-disable on embed-source global is a Phase 4 consideration — the
-- false-positive risk on email/ip hashing is higher than user-source.

CREATE OR REPLACE FUNCTION public.apply_block_cascade()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  affected RECORD;
BEGIN
  IF NEW.block_kind = 'user' THEN
    -- Pending → declined (existing Phase 1 behaviour, extended with log row)
    FOR affected IN
      UPDATE public.tag_events
         SET status                   = 'declined',
             decision_by              = NEW.created_by,
             decision_at              = now(),
             decision_reason_category = 'spam',
             updated_at               = now()
       WHERE status = 'pending'
         AND asserter_id IS NOT NULL
         AND asserter_id::text = NEW.blocked_party
         AND (NEW.scope = 'global' OR subject_id = NEW.subject_id::text)
       RETURNING id, asserter_id
    LOOP
      INSERT INTO public.tag_action_log (
        tag_event_id, asserter_id, actor_id, actor_role,
        action, prior_status, new_status, reason_category
      ) VALUES (
        affected.id, affected.asserter_id, NEW.created_by, 'editor',
        'block_cascade', 'pending', 'declined', 'spam'
      );
    END LOOP;

    -- Q7: scope='global' also flips approved → disabled
    IF NEW.scope = 'global' THEN
      FOR affected IN
        UPDATE public.tag_events
           SET status                   = 'disabled',
               decision_by              = NEW.created_by,
               decision_at              = now(),
               decision_reason_category = 'spam',
               updated_at               = now()
         WHERE status = 'approved'
           AND asserter_id IS NOT NULL
           AND asserter_id::text = NEW.blocked_party
         RETURNING id, asserter_id
      LOOP
        INSERT INTO public.tag_action_log (
          tag_event_id, asserter_id, actor_id, actor_role,
          action, prior_status, new_status, reason_category
        ) VALUES (
          affected.id, affected.asserter_id, NEW.created_by, 'editor',
          'block_cascade', 'approved', 'disabled', 'spam'
        );
      END LOOP;
    END IF;

  ELSIF NEW.block_kind = 'email' THEN
    FOR affected IN
      UPDATE public.tag_events
         SET status                   = 'declined',
             decision_by              = NEW.created_by,
             decision_at              = now(),
             decision_reason_category = 'spam',
             updated_at               = now()
       WHERE status = 'pending'
         AND source = 'public_timeline_embed'
         AND asserter_visitor_record->>'email_hash' = NEW.blocked_party
         AND (NEW.scope = 'global' OR subject_id = NEW.subject_id::text)
       RETURNING id, asserter_id
    LOOP
      INSERT INTO public.tag_action_log (
        tag_event_id, asserter_id, actor_id, actor_role,
        action, prior_status, new_status, reason_category
      ) VALUES (
        affected.id, affected.asserter_id, NEW.created_by, 'editor',
        'block_cascade', 'pending', 'declined', 'spam'
      );
    END LOOP;

  ELSIF NEW.block_kind = 'ip' THEN
    FOR affected IN
      UPDATE public.tag_events
         SET status                   = 'declined',
             decision_by              = NEW.created_by,
             decision_at              = now(),
             decision_reason_category = 'spam',
             updated_at               = now()
       WHERE status = 'pending'
         AND source = 'public_timeline_embed'
         AND asserter_visitor_record->>'ip_hash' = NEW.blocked_party
         AND (NEW.scope = 'global' OR subject_id = NEW.subject_id::text)
       RETURNING id, asserter_id
    LOOP
      INSERT INTO public.tag_action_log (
        tag_event_id, asserter_id, actor_id, actor_role,
        action, prior_status, new_status, reason_category
      ) VALUES (
        affected.id, affected.asserter_id, NEW.created_by, 'editor',
        'block_cascade', 'pending', 'declined', 'spam'
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger remains attached from Phase 1 (tag_blocklist_cascade AFTER INSERT).
