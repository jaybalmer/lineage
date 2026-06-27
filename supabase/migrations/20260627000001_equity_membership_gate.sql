-- Equity offer membership gate + contributor comp
-- (equity-offer-membership-gate brief, June 27 2026).
--
-- Additive, two columns on profiles. MIGRATE BEFORE MERGE: the comp-grant path,
-- the Stripe webhook, the gift-redeem route, and the admin membership route all
-- write membership_source unconditionally, so the column must exist first or
-- every membership write 500s in the window between deploy and migrate.

alter table profiles add column if not exists membership_source text;  -- 'paid' | 'comp' | null(free)
alter table profiles add column if not exists comp_earned_at timestamptz;  -- one-time comp latch (D-Q3), never cleared

-- Mark every existing active membership as paid so the comp revert never touches
-- it. Includes gifted memberships (status='gifted'): a gift is a real paid
-- membership and must stay out of the comp-revert path.
update profiles
  set membership_source = 'paid'
  where membership_tier in ('annual','lifetime','founding')
    and membership_source is null;
