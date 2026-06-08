-- ============================================================================
-- Bug Report Widget: bug_reports table
-- Run in Supabase SQL Editor (no local migrations in this project)
-- ============================================================================
--
-- Backs the in-app "Report a bug" widget. Rows are written server-side by
-- POST /api/bug-report using the service-role client, after requireAuth().
-- There is no client read path in v1, so no SELECT policy is needed. RLS is
-- enabled with no policies: the service role bypasses it, and anon/session
-- clients get nothing.

CREATE TABLE IF NOT EXISTS bug_reports (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  reporter_id         uuid REFERENCES profiles(id),
  reporter_email      text,
  note                text NOT NULL,
  expected            text,
  url                 text,
  viewport            text,
  user_agent          text,
  posthog_session_url text,
  status              text NOT NULL DEFAULT 'new'
);

-- Triage reads newest first.
CREATE INDEX IF NOT EXISTS bug_reports_created_at_idx ON bug_reports (created_at DESC);

-- Lock down direct client access; all writes go through the service role.
ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;
