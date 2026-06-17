-- ============================================================================
-- BUG-066 backfill — AS APPLIED to prod 2026-06-17 (after migration
-- 20260617000001 added claims.parent_claim_id + rebuilt claims_public).
--
-- This file records the actual, executed procedure. The discovery step found
-- the data had moved on from the original brief (both clusters grew and now
-- span multiple years), so the plan became "collapse-only, consent-aware"
-- rather than the brief's speculative parent-then-collapse. NO account merge.
--
-- TYPE NOTE: claims.id / subject_id / object_id / parent_claim_id are all TEXT.
-- ============================================================================
--
-- DISCOVERY FINDINGS (read-only Phase 0). Two duplicate (subject, object)
-- crew clusters of NULL-parent rode_with; everything else is n=1.
--
--   Jay (0394914d) -> Sean Balmer (06fc2b45): 4 rows
--     1986 x3  (swy0i approved [KEEP], 4csr3 approved, qsrps pending)
--     2026 x1  (nurv8 DECLINED)
--     -> 1986 has only 2 rode_at, so the 3 companions can't be 1:1 attributed
--        (ambiguous): collapse, do not parent. The 2026 row is DECLINED, so it
--        must NOT contribute its year to the surviving crew row (else the
--        collapse would re-assert a relationship Sean declined). Survivor stays
--        1986. Result card: "Rode with Sean, 1986".
--
--   Cy 2 (3a467197) -> Cory Yip (499deddd): 6 rows
--     2020 x1  (iukh7 approved)
--     2026 x5  (lag0s approved [KEEP], ierp5/8lzc9/u8b7e/agnq7 approved)
--     -> all approved. Collapse to one crew row spanning 2020-2026.
--        Result card: "Rode with Cory, 2020 - 2026".
--
-- (Note: the original 0.2 join double-counted rode_at as n_rode_with*n_rode_at;
--  the per-key scalar-subquery breakdown gave the true counts above. The kept
--  rows were verified `approved` via tag_events before the run.)
--
-- Net: 8 claims + their 8 paired tag_events deleted, 1 survivor widened, 1
-- survivor left as-is. NULL-parent rode_with universe 12 -> 4 (2 survivors +
-- 2 untouched singletons: 63c6a57a->Jay 1997, 63c6a57a->ad2d9ef4 1996).


-- ── EXECUTED MUTATION (run once with the trailing `rollback;` as a dry run,
--    confirmed the verify returned 0 dup rows, then re-ran with `commit;`). ───
begin;

-- Jay -> Sean: drop the 2 other 1986 dups AND the declined 2026 row.
-- Keep swy0i (approved, 1986); its year stays 1986 (declined 2026 not re-asserted).
delete from public.claims where id in (
  'claim_1773985566088_4csr3',   -- approved dup, 1986
  'qc-1781532682402-qsrps',      -- pending dup, 1986
  'claim_1778911741624_nurv8'    -- DECLINED, 2026 (consent: do not re-assert)
);

-- Cy 2 -> Cory: drop the 5 dups; keep lag0s (approved), widened below.
delete from public.claims where id in (
  'claim_1781456293125_iukh7',
  'qc-1781060378600-ierp5',
  'qc-1781060400398-8lzc9',
  'qc-1781062813651-u8b7e',
  'qc-1781062972839-agnq7'
);

-- Delete the paired tag_events for all 8 removed claims (by moment_ref->>claim_id).
-- Claims are deleted first above so no surviving claim still FKs these tag_events.
delete from public.tag_events where moment_ref->>'claim_id' in (
  'claim_1773985566088_4csr3','qc-1781532682402-qsrps','claim_1778911741624_nurv8',
  'claim_1781456293125_iukh7','qc-1781060378600-ierp5','qc-1781060400398-8lzc9',
  'qc-1781062813651-u8b7e','qc-1781062972839-agnq7'
);

-- Widen the surviving Cy 2 -> Cory crew row to span 2020-2026.
update public.claims set start_date = '2020-01-01', end_date = '2026-01-01'
  where id = 'qc-1781060310289-lag0s';

-- VERIFY: no duplicate crew pairs remain (returned 0 rows).
select subject_id, object_id, count(*) as dup_rows
from public.claims
where predicate = 'rode_with' and parent_claim_id is null
group by subject_id, object_id having count(*) > 1;

commit;


-- ── POST-COMMIT VERIFICATION (read-only, all passed) ────────────────────────
-- Survivors: swy0i = 1986-01-01/null ("Rode with Sean, 1986");
--            lag0s = 2020-01-01/2026-01-01 ("Rode with Cory, 2020 - 2026").
select id, subject_id, object_id, start_date, end_date
from public.claims where id in ('claim_1773701395039_swy0i','qc-1781060310289-lag0s');

-- Universe shrank 12 -> 4.
select count(*) as null_parent_rode_with
from public.claims where predicate = 'rode_with' and parent_claim_id is null;

-- Browser: /people/cy_2 dropped from 6 cards to one "Rode with Cory, 2020 - 2026".
