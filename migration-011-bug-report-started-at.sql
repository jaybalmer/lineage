-- ============================================================================
-- Bug widget replay timestamp capture: report_started_at
-- Run in Supabase SQL Editor (no local migrations in this project)
-- ============================================================================
--
-- The bug widget now captures its replay anchor when the widget OPENS (with a
-- 10 second lookback) instead of when Send is hit, so triage replays land just
-- before the reporter reached for the widget rather than mid-typing. This
-- column records that open time; created_at minus report_started_at is roughly
-- the time the reporter spent typing. Reporter-supplied, telemetry only.
-- Additive and safe to leave in place even if the code commit is reverted.
-- No backfill: existing rows stay NULL.

ALTER TABLE bug_reports ADD COLUMN IF NOT EXISTS report_started_at timestamptz;
