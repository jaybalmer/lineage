-- STEP 3: insert catalog boards that are genuinely new (IMPORT).
-- Additive. Run STEP 1 first (needs the new columns).
-- id = gen_random_uuid(); added_by = null (nullable); shape = null.
-- brand uses the existing spelling when the brand already exists in boards.

begin;

  -- Barfoot Twin Tip  (was fuzzy vs existing '161 twintip')
insert into boards (id, brand, model, model_year, shape, external_ref, community_status, added_by, model_id, first_year, year_basis, category, confidence, sources)
  values (gen_random_uuid(), 'Barfoot', 'Twin Tip', 1987, NULL, 'catalog:barfoot--twin-tip', 'verified', NULL, 'barfoot--twin-tip', 1987, 'introduced', NULL, 'verified', ARRAY['https://archive.org/details/ISM-87-91', 'https://www.snowboarder.com/news/snowboard-history-timeline-part-21980s', 'https://retrosnow.com/shop/barfoot/87/barfoot-twin-tip-freestyle/']);

  -- Burton Backhill (BB1)  (was fuzzy vs existing 'Backhill')
insert into boards (id, brand, model, model_year, shape, external_ref, community_status, added_by, model_id, first_year, year_basis, category, confidence, sources)
  values (gen_random_uuid(), 'Burton', 'Backhill (BB1)', 1978, NULL, 'catalog:burton--backhill-bb1', 'verified', NULL, 'burton--backhill-bb1', 1978, 'introduced', NULL, 'verified', ARRAY['https://boardvault.net/snowboards/year/1979', 'https://boardvault.net/snowboards/year/1982', 'https://boardvault.net/snowboards/year/1985', 'https://boardvault.net/snowboards/1979/backhill-1979', 'https://www.burton.com/en-us/blogs/the-burton-blog/burton-snowboards-history', 'https://www.michigansnowboardmuseum.com/burton---early-years-to-the-modern-twin.html', 'https://www.vintagewinter.com/blogs/blog/4555102-vintage-burton-snowboards', 'https://www.vintagewinter.com/collections/vintage-snowboards']);

  -- Capita Spring Break Powder Racers  (was fuzzy vs existing 'Spring Break')
insert into boards (id, brand, model, model_year, shape, external_ref, community_status, added_by, model_id, first_year, year_basis, category, confidence, sources)
  values (gen_random_uuid(), 'Capita', 'Spring Break Powder Racers', 2020, NULL, 'catalog:capita--spring-break-powder-racers', 'verified', NULL, 'capita--spring-break-powder-racers', 2020, 'introduced', NULL, 'verified', ARRAY['https://thegoodride.com/snowboard-reviews/capita-spring-break-powder-racers-snowboard-review/', 'https://www.evo.com/shop/snowboard/snowboards/capita']);

  -- Capita Super DOA  (was fuzzy vs existing 'DOA')
insert into boards (id, brand, model, model_year, shape, external_ref, community_status, added_by, model_id, first_year, year_basis, category, confidence, sources)
  values (gen_random_uuid(), 'Capita', 'Super DOA', 2020, NULL, 'catalog:capita--super-doa', 'verified', NULL, 'capita--super-doa', 2020, 'introduced', NULL, 'verified', ARRAY['https://thegoodride.com/snowboard-reviews/capita-super-doa-snowboard-review/', 'https://www.evo.com/shop/snowboard/snowboards/capita']);

  -- Lib Tech Grocer Shalom  (was fuzzy vs existing 'Grocer')
insert into boards (id, brand, model, model_year, shape, external_ref, community_status, added_by, model_id, first_year, year_basis, category, confidence, sources)
  values (gen_random_uuid(), 'Lib Tech', 'Grocer Shalom', 1995, NULL, 'catalog:lib-tech--grocer-shalom', 'verified', NULL, 'lib-tech--grocer-shalom', 1995, 'earliest_sourced', NULL, 'verified', ARRAY['https://retrosnow.com/product-category/lib-tech/', 'https://web.archive.org/web/200104/http://www.lib-tech.com/', 'https://web.archive.org/web/200107/http://www.lib-tech.com/', 'https://web.archive.org/web/19980218102632/http://gnu.com/libboards.html']);

  -- Never Summer Trooper  (was fuzzy vs existing 'Snowtrooper')
insert into boards (id, brand, model, model_year, shape, external_ref, community_status, added_by, model_id, first_year, year_basis, category, confidence, sources)
  values (gen_random_uuid(), 'Never Summer', 'Trooper', 2026, NULL, 'catalog:never-summer--trooper', 'verified', NULL, 'never-summer--trooper', 2026, 'earliest_sourced', NULL, 'verified', ARRAY['https://neversummer.com/collections/mens-snowboards', 'https://www.evo.com/shop/snowboard/snowboards/never-summer']);

commit;
