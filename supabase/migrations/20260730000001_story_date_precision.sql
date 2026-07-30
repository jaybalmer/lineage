-- Story Date Precision (feature brief: story-date-precision).
-- Members often post stories whose real date they only know to the year, or the
-- year and month. story_date stays a strict `date NOT NULL` holding a padded
-- anchor (year-only 1998 -> 1998-01-01, month-only Mar 1998 -> 1998-03-01);
-- date_precision records how much of that anchor is real so display can render
-- "1998" / "Mar 1998" / "15 Mar 1998" honestly.
--
-- Additive and non-breaking: existing rows default to 'day', which is exactly
-- what they meant when saved. No backfill (mis-dated stories are repaired by
-- hand via the new editor Fix date affordance).
--
-- HARD PRE-MERGE GATE: the write path sends date_precision unconditionally once
-- the app code deploys, so this must be applied in Supabase BEFORE the PR merges
-- or every story insert 500s (PGRST204) in the window between.

alter table stories
  add column date_precision text not null default 'day'
  check (date_precision in ('day','month','year'));
