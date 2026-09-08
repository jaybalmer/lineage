-- Post-import verification for the Linestry events catalog.
-- Run after the migration and seed. Every query below should return the stated expectation.
-- Anything else is a real problem, not a rounding difference.

\echo '== row counts (expect 121 / 615 / 3915) =='
select (select count(*) from public.event_series)   as series,
       (select count(*) from public.event_editions) as editions,
       (select count(*) from public.event_results)  as results;

\echo '== referential integrity (both must be 0) =='
select count(*) as orphan_editions from public.event_editions e
  left join public.event_series s using (series_id) where s.series_id is null;
select count(*) as orphan_results from public.event_results r
  left join public.event_editions e using (edition_id) where e.edition_id is null;

\echo '== no row without a source (both must be 0) =='
select count(*) as editions_without_source from public.event_editions where coalesce(array_length(sources,1),0)=0;
select count(*) as results_without_source  from public.event_results  where coalesce(array_length(sources,1),0)=0;

\echo '== dates agree with the edition year =='
-- Tour series are modelled one row per SEASON, keyed to the season-end year, so a 2001 World Cup row
-- legitimately starts in November 2000. Those are excluded here by design.
-- Expect exactly 1 row: fis-snowboard-junior-world-championships--2021, which is genuinely two
-- championships (Lachtal, Dec 2020 and Krasnoyarsk, Mar 2021) sharing one edition_id. Splitting it
-- is a known open item. Any OTHER row here is a real defect.
select e.edition_id, e.year, e.start_date
  from public.event_editions e join public.event_series s using (series_id)
 where e.start_date is not null
   and extract(year from e.start_date) <> e.year
   and s.category <> 'tour-series';

\echo '== an edition that never happened should have no podium (must be 0) =='
select count(*) as results_on_cancelled from public.event_results r
  join public.event_editions e using (edition_id) where e.status in ('cancelled','postponed');

\echo '== citation health: pending-recheck rows have an unverified archive link =='
select citation_status, count(*) from public.event_results group by 1 order by 2 desc;

\echo '== coverage: how much of the catalog is taggable and how much has a podium =='
select count(*) filter (where start_date is not null) as dated_editions,
       count(*) as total_editions,
       (select count(distinct edition_id) from public.event_results) as editions_with_a_podium
  from public.event_editions;

\echo '== the ten deepest series, as a smoke test that the joins work =='
select s.series_name, count(distinct e.edition_id) as editions, count(r.result_id) as results
  from public.event_series s
  join public.event_editions e using (series_id)
  left join public.event_results r using (edition_id)
 group by s.series_name order by results desc nulls last limit 10;

\echo '== division split: nothing should be null, unspecified is a legitimate value =='
select division_gender, division_class, count(*) from public.event_results group by 1,2 order by 3 desc;

\echo '== the shape the timeline will actually query: everything at one venue, in order =='
select e.year, e.edition_label, e.start_date, e.status
  from public.event_editions e
 where e.series_id = 'mt-baker-legendary-banked-slalom'
 order by e.year;
