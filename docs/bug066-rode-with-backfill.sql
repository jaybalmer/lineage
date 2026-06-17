-- ============================================================================
-- BUG-066 backfill — run in the Supabase SQL editor AFTER applying the schema
-- migration 20260617000001_bug066_rode_with_parent_claim.sql (column +
-- claims_public rebuild) and BEFORE merging the PR.
--
-- This is a MANUAL, data-specific, partly destructive script. Run it phase by
-- phase. Each mutating phase is wrapped in BEGIN; ... and ends with a
-- verification SELECT: inspect it, then COMMIT; if it matches, or ROLLBACK; if
-- anything looks off. Nothing here is idempotent-by-design, so do not re-run a
-- committed phase.
--
-- Confirmed affected data (June 17 working session) is exactly two clusters:
--   A. Companion-edge leak: Jay -> Sean Balmer, 1986 — 3 rode_at + 3 rode_with
--      on the same year-only date. Fix: parent each rode_with 1:1 to a rode_at
--      so they fold into the place cards as chips.
--   B. Standalone duplicates: "Cy 2" -> Cory Yip, 2026 — 5 rode_with, 0 rode_at.
--      Fix: collapse to one crew row with start=min, end=max; drop the rest and
--      their paired tag_events. NO account merge ("Cy 2" stays a separate user).
--
-- TYPE NOTE: claims.id / subject_id / object_id / parent_claim_id are all TEXT.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- PHASE 0 — DISCOVERY (read-only). Run these four, share the output. Confirm
-- the ONLY clusters that show up are A and B above before running any mutation.
-- ────────────────────────────────────────────────────────────────────────────

-- 0.1  Duplicate crew clusters: any (subject, object) with >1 NULL-parent
--      rode_with. Expect exactly one row: Cy 2 -> Cory Yip, n=5.
select subject_id, object_id,
       count(*)                                            as n_rows,
       min(start_date)                                     as min_start,
       max(coalesce(end_date, start_date))                 as max_end
from public.claims
where predicate = 'rode_with' and parent_claim_id is null
group by subject_id, object_id
having count(*) > 1
order by n_rows desc;

-- 0.2  Companion candidates: each NULL-parent rode_with and how many rode_at
--      share its (subject, date) key. n_match=1 => unambiguous (Phase 1a);
--      n_match>1 with equal rode_with count => balanced (Phase 1b, Jay->Sean);
--      n_match=0 => standalone/crew (left for Phase 2).
select rw.subject_id, rw.object_id, rw.start_date, rw.end_date,
       count(ra.id) as n_matching_rode_at
from public.claims rw
left join public.claims ra
  on ra.predicate = 'rode_at'
 and ra.subject_id = rw.subject_id
 and coalesce(ra.start_date, '') = coalesce(rw.start_date, '')
 and coalesce(ra.end_date, '')   = coalesce(rw.end_date, '')
where rw.predicate = 'rode_with' and rw.parent_claim_id is null
group by rw.subject_id, rw.object_id, rw.start_date, rw.end_date
order by n_matching_rode_at desc, rw.subject_id;

-- 0.3  The balanced multi-match keys (rode_at count == NULL-parent rode_with
--      count, both > 1). Expect exactly one: Jay -> Sean's 1986 key, 3 == 3.
select rw.subject_id,
       coalesce(rw.start_date, '') as s,
       coalesce(rw.end_date, '')   as e,
       count(*) as n_rode_with,
       (select count(*) from public.claims ra
         where ra.predicate = 'rode_at' and ra.subject_id = rw.subject_id
           and coalesce(ra.start_date, '') = coalesce(rw.start_date, '')
           and coalesce(ra.end_date, '')   = coalesce(rw.end_date, '')) as n_rode_at
from public.claims rw
where rw.predicate = 'rode_with' and rw.parent_claim_id is null
group by rw.subject_id, coalesce(rw.start_date, ''), coalesce(rw.end_date, '')
having count(*) > 1
   and count(*) = (select count(*) from public.claims ra
         where ra.predicate = 'rode_at' and ra.subject_id = rw.subject_id
           and coalesce(ra.start_date, '') = coalesce(rw.start_date, '')
           and coalesce(ra.end_date, '')   = coalesce(rw.end_date, ''));

-- 0.4  Sanity: total NULL-parent rode_with rows (the universe this touches).
select count(*) as null_parent_rode_with from public.claims
where predicate = 'rode_with' and parent_claim_id is null;


-- ────────────────────────────────────────────────────────────────────────────
-- PHASE 1a — Parent the UNAMBIGUOUS companions (exactly one matching rode_at).
-- Safe: only sets parent where the date key maps to a single place. Standalone
-- crew rows (zero matching rode_at) are untouched and stay NULL-parent.
-- ────────────────────────────────────────────────────────────────────────────
begin;

-- preview the rows that will be parented (run, eyeball, then continue)
select rw.id as rode_with_id, rw.subject_id, rw.object_id, rw.start_date,
       ra.id as parent_rode_at_id
from public.claims rw
join public.claims ra
  on ra.predicate = 'rode_at'
 and ra.subject_id = rw.subject_id
 and coalesce(ra.start_date, '') = coalesce(rw.start_date, '')
 and coalesce(ra.end_date, '')   = coalesce(rw.end_date, '')
where rw.predicate = 'rode_with' and rw.parent_claim_id is null
  and (select count(*) from public.claims ra2
        where ra2.predicate = 'rode_at' and ra2.subject_id = rw.subject_id
          and coalesce(ra2.start_date, '') = coalesce(rw.start_date, '')
          and coalesce(ra2.end_date, '')   = coalesce(rw.end_date, '')) = 1;

update public.claims rw
set parent_claim_id = ra.id
from public.claims ra
where rw.predicate = 'rode_with' and rw.parent_claim_id is null
  and ra.predicate = 'rode_at'
  and ra.subject_id = rw.subject_id
  and coalesce(ra.start_date, '') = coalesce(rw.start_date, '')
  and coalesce(ra.end_date, '')   = coalesce(rw.end_date, '')
  and (select count(*) from public.claims ra2
        where ra2.predicate = 'rode_at' and ra2.subject_id = rw.subject_id
          and coalesce(ra2.start_date, '') = coalesce(rw.start_date, '')
          and coalesce(ra2.end_date, '')   = coalesce(rw.end_date, '')) = 1;

-- COMMIT; if the updated count matches the preview, else ROLLBACK;


-- ────────────────────────────────────────────────────────────────────────────
-- PHASE 1b — Parent the BALANCED multi-match companions 1:1 (Jay -> Sean 1986).
-- Pairs each rode_with to a distinct rode_at of the same date by row number.
-- Only runs on keys where rode_at count == NULL-parent rode_with count > 1
-- (confirm Phase 0.3 shows ONLY the Jay->Sean key before committing).
-- ────────────────────────────────────────────────────────────────────────────
begin;

with rode_at_n as (
  select id, subject_id,
         coalesce(start_date, '') as s, coalesce(end_date, '') as e,
         row_number() over (partition by subject_id, coalesce(start_date, ''), coalesce(end_date, '')
                            order by id) as rn
  from public.claims
  where predicate = 'rode_at'
),
rode_with_n as (
  select id, subject_id,
         coalesce(start_date, '') as s, coalesce(end_date, '') as e,
         row_number() over (partition by subject_id, coalesce(start_date, ''), coalesce(end_date, '')
                            order by id) as rn
  from public.claims
  where predicate = 'rode_with' and parent_claim_id is null
),
balanced as (
  select rw.subject_id, rw.s, rw.e
  from rode_with_n rw
  group by rw.subject_id, rw.s, rw.e
  having count(*) > 1
     and count(*) = (select count(*) from rode_at_n ra
                     where ra.subject_id = rw.subject_id and ra.s = rw.s and ra.e = rw.e)
)
update public.claims c
set parent_claim_id = ra.id
from rode_with_n rw
join rode_at_n ra
  on ra.subject_id = rw.subject_id and ra.s = rw.s and ra.e = rw.e and ra.rn = rw.rn
join balanced b
  on b.subject_id = rw.subject_id and b.s = rw.s and b.e = rw.e
where c.id = rw.id and c.parent_claim_id is null;

-- verify (expect the 3 Jay->Sean rows now parented):
select id, subject_id, object_id, start_date, parent_claim_id
from public.claims
where predicate = 'rode_with' and parent_claim_id is not null
order by subject_id, start_date;

-- COMMIT; if correct, else ROLLBACK;


-- ────────────────────────────────────────────────────────────────────────────
-- PHASE 2 — Collapse standalone crew duplicates (Cy 2 -> Cory 2026, 5 -> 1).
-- Keep the earliest row per (subject, object), widen its range, delete the rest
-- and their paired tag_events. Delete claims first so no claim still references
-- the tag_event via tag_event_id, then delete the orphaned tag_events by
-- moment_ref->>'claim_id'.
-- ────────────────────────────────────────────────────────────────────────────
begin;

-- 2.0  Stage the duplicates (rn>1 = to delete) and the keep target + new range.
create temporary table bug066_dups on commit drop as
with ranked as (
  select id, subject_id, object_id, created_at,
         row_number() over (partition by subject_id, object_id
                            order by created_at asc, id asc) as rn,
         min(start_date) over (partition by subject_id, object_id)               as keep_start,
         max(coalesce(end_date, start_date)) over (partition by subject_id, object_id) as keep_end
  from public.claims
  where predicate = 'rode_with' and parent_claim_id is null
)
select * from ranked
where (subject_id, object_id) in (
  select subject_id, object_id from public.claims
  where predicate = 'rode_with' and parent_claim_id is null
  group by subject_id, object_id having count(*) > 1
);

-- preview: rows to delete (rn>1) and the paired tag_events that will go with them
select * from bug066_dups where rn > 1 order by subject_id, object_id, created_at;
select te.id, te.status, te.moment_ref->>'claim_id' as claim_id
from public.tag_events te
where te.moment_ref->>'claim_id' in (select id from bug066_dups where rn > 1);

-- 2.1  Delete the duplicate claims (rn>1). Removes their claims.tag_event_id refs.
delete from public.claims
where id in (select id from bug066_dups where rn > 1);

-- 2.2  Delete the now-orphaned paired tag_events for those removed claims.
delete from public.tag_events
where moment_ref->>'claim_id' in (select id from bug066_dups where rn > 1);

-- 2.3  Widen the kept row (rn=1) to span the full [min, max] year range.
update public.claims c
set start_date = d.keep_start,
    end_date   = case when d.keep_end = d.keep_start then c.end_date else d.keep_end end
from bug066_dups d
where d.rn = 1 and c.id = d.id;

-- verify (expect exactly one crew row per pair, with the widened range):
select subject_id, object_id, count(*) as n_rows,
       min(start_date) as start_date, max(coalesce(end_date, start_date)) as end_date
from public.claims
where predicate = 'rode_with' and parent_claim_id is null
group by subject_id, object_id
having count(*) > 1;   -- expect ZERO rows

-- COMMIT; if the dup-pair count is now zero, else ROLLBACK;


-- ────────────────────────────────────────────────────────────────────────────
-- PHASE 3 — Final verification (read-only).
-- ────────────────────────────────────────────────────────────────────────────

-- No (subject, object) crew pair has more than one NULL-parent rode_with:
select count(*) as remaining_dup_pairs from (
  select subject_id, object_id from public.claims
  where predicate = 'rode_with' and parent_claim_id is null
  group by subject_id, object_id having count(*) > 1
) x;   -- expect 0

-- The Jay->Sean companions are now parented (chips, not standalone cards):
select count(*) as parented_companions from public.claims
where predicate = 'rode_with' and parent_claim_id is not null;   -- expect 3 (Jay->Sean)

-- No orphaned tag_events left pointing at deleted claims:
select count(*) as orphan_tag_events from public.tag_events te
where te.moment_ref ? 'claim_id'
  and not exists (select 1 from public.claims c where c.id = te.moment_ref->>'claim_id');
