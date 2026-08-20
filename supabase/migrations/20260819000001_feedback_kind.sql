-- General Feedback Form: the in-app "Report a bug" widget becomes "Send
-- feedback", taking a bug report OR a feature idea. The two are sorted at the
-- email-subject level ([Linestry Bug] vs [Linestry Idea]); this column records
-- the same split on the durable row.
--
-- Additive and SAFE: new column with a default, existing rows backfill to 'bug'.
-- The table keeps its name (bug_reports); renaming it would be a GATED change
-- against a table the intake path writes on every submit, for no user benefit.

alter table public.bug_reports
  add column if not exists kind text not null default 'bug';

alter table public.bug_reports
  add constraint bug_reports_kind_check
  check (kind in ('bug', 'idea'));
