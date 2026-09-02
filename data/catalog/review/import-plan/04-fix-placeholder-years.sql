-- ============================================================================
-- STEP 4 (cleanup): replace the placeholder 2010 model_year with the catalog's
-- sourced first_year.
--
-- Context: ~33 boards were bulk-entered with model_year = 2010 as a default.
-- After the import, 30 of them now carry a catalog first_year; this sets their
-- model_year to that sourced year. The 3 with no catalog match (Capita Spring
-- Break, Jones Solution, Never Summer Snowtrooper) have first_year IS NULL, so
-- the WHERE clause skips them and they stay at 2010, as decided.
--
-- GATED: UPDATEs existing rows. Run AFTER the import (needs the first_year column).
--
-- Caveat you accepted: first_year is the model's introduction year, so for a
-- long-running model this sets the board's year to that intro year. Preview
-- below shows exactly which rows change before you commit.
-- ============================================================================

-- Preview (run this SELECT first to eyeball the 30 rows and their new year):
-- select brand, model, model_year as old_year, first_year as new_year, year_basis
--   from boards
--  where model_year = 2010 and first_year is not null
--  order by brand, model;

begin;

update boards
   set model_year = first_year
 where model_year = 2010
   and first_year is not null;

commit;

-- Verify after commit (should return 3: the orphans with no catalog year):
-- select brand, model from boards where model_year = 2010 order by brand, model;
