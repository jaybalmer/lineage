-- STEP 2: enrich existing boards from their catalog match (MERGE).
-- GATED: this UPDATEs existing rows. Run STEP 1 first.
-- Backfills catalog_* provenance; FUZZY typo fixes also correct model name.
-- Wrapped in a transaction so it is all-or-nothing.

begin;

  -- Capita Snowboards Photo Fetish 160 "Pendygrasse"  (FUZZY: rename -> Photo Fetish)
update boards set
    model = 'Photo Fetish',
    model_id = 'capita--photo-fetish',
    first_year = 2008,
    year_basis = 'earliest_sourced',
    confidence = 'likely',
    sources = ARRAY['https://web.archive.org/web/200712/http://www.capitasnowboarding.com/', 'https://web.archive.org/web/200809/http://www.capitasnowboarding.com/']
  where id in ('board_1788060224263_33wh3');

  -- Crazy Banana Chili Willi  (FUZZY: rename -> Chilli Willi)
update boards set
    model = 'Chilli Willi',
    model_id = 'crazy-banana--chilli-willi',
    first_year = 1990,
    year_basis = 'introduced',
    confidence = 'verified',
    sources = ARRAY['https://archive.org/details/tws-89-93', 'https://archive.org/details/ISM-87-91']
  where id in ('board_1787849145205_v0ps8');

  -- Gnu Temple Cummings  (FUZZY: rename -> Temple Cummins)
update boards set
    model = 'Temple Cummins',
    model_id = 'gnu--temple-cummins',
    first_year = 1998,
    year_basis = 'earliest_sourced',
    confidence = 'verified',
    sources = ARRAY['https://www.agnarchy.com/1988-gnu-antigravity/', 'https://web.archive.org/web/200311/http://www.gnu.com/', 'https://web.archive.org/web/200708/http://www.gnu.com/', 'https://web.archive.org/web/19980218102239/http://gnu.com/gnuboards.html', 'https://web.archive.org/web/19991010235729/http://www.gnu.com/gnuboards.html', 'https://web.archive.org/web/20000122204522/http://www.gnu.com/tcboards.html']
  where id in ('board_1781820591038_udkjs');

  -- Lib Tech Emma Peele  (FUZZY: rename -> Emma Peel)
update boards set
    model = 'Emma Peel',
    model_id = 'lib-tech--emma-peel',
    first_year = 1992,
    year_basis = 'earliest_sourced',
    confidence = 'verified',
    sources = ARRAY['https://www.michigansnowboardmuseum.com/the-neon-era--other-80s-decks.html', 'https://retrosnow.com/product-category/lib-tech/', 'https://web.archive.org/web/200308/http://www.lib-tech.com/', 'https://web.archive.org/web/200311/http://www.lib-tech.com/', 'https://web.archive.org/web/19980218102632/http://gnu.com/libboards.html', 'https://web.archive.org/web/19991011030105/http://www.gnu.com/libboards.html']
  where id in ('board_1781818739676_h45vp', 'board_1772833958120_hx3ek');

  -- Lib Tech Jamie Lynn Wahle  (FUZZY: rename -> Jamie Lynn)
update boards set
    model = 'Jamie Lynn',
    model_id = 'lib-tech--jamie-lynn',
    first_year = 1994,
    year_basis = 'earliest_sourced',
    confidence = 'verified',
    sources = ARRAY['https://retrosnow.com/product-category/lib-tech/', 'https://www.lib-tech.com/about-lib-tech/history', 'https://www.lib-tech.com/snowboards', 'https://www.evo.com/shop/snowboard/snowboards/lib-technologies', 'https://www.snowboard.international/news/30-years-of-jamie-lynn-x-lib-tech/', 'https://web.archive.org/web/200109/http://www.lib-tech.com/', 'https://web.archive.org/web/200204/http://www.lib-tech.com/', 'https://web.archive.org/web/19980218102632/http://gnu.com/libboards.html']
  where id in ('board_1781819028297_3ctg4');

  -- Arbor A-Frame
update boards set
    model_id = 'arbor--a-frame',
    first_year = 2004,
    year_basis = 'earliest_sourced',
    confidence = 'verified',
    sources = ARRAY['https://www.snowdb.com/catalog/arbor', 'https://www.evo.com/shop/snowboard/snowboards/arbor', 'https://thegoodride.com/snowboard-reviews/?brand=jones', 'https://web.archive.org/web/200309/http://www.arborsports.com/', 'https://web.archive.org/web/200701/http://www.arborsports.com/']
  where id in ('8cac327e-e937-404f-ac5b-33a3967c5eb6');

  -- Arbor Coda
update boards set
    model_id = 'arbor--coda',
    first_year = 2009,
    year_basis = 'earliest_sourced',
    confidence = 'verified',
    sources = ARRAY['https://www.snowdb.com/catalog/arbor', 'https://www.evo.com/shop/snowboard/snowboards/arbor']
  where id in ('d66a0928-2f9f-41a2-b571-462c89d96b48');

  -- Arbor Element
update boards set
    model_id = 'arbor--element',
    first_year = 2004,
    year_basis = 'earliest_sourced',
    confidence = 'verified',
    sources = ARRAY['https://www.snowdb.com/catalog/arbor', 'https://www.evo.com/shop/snowboard/snowboards/arbor', 'https://web.archive.org/web/200308/http://www.arborsports.com/', 'https://web.archive.org/web/200701/http://www.arborsports.com/']
  where id in ('b25');

  -- Arbor Westmark
update boards set
    model_id = 'arbor--westmark',
    first_year = 2008,
    year_basis = 'earliest_sourced',
    confidence = 'likely',
    sources = ARRAY['https://www.snowdb.com/catalog/arbor']
  where id in ('b1468b5c-1ae6-4995-b066-db692ac5bb69');

  -- Barfoot Freestyle
update boards set
    model_id = 'barfoot--freestyle',
    first_year = 1986,
    year_basis = 'introduced',
    confidence = 'verified',
    sources = ARRAY['https://archive.org/details/ISM-87-91', 'https://retrosnow.com/shop/barfoot/barfoot-86/barfoot-freestyle-155/']
  where id in ('bf1981', 'board_1772833525919_63isk');

  -- Bataleon Disaster
update boards set
    model_id = 'bataleon--disaster',
    first_year = 2012,
    year_basis = 'introduced',
    confidence = 'verified',
    sources = ARRAY['https://bataleon.com/pages/board-archive']
  where id in ('b26');

  -- Bataleon Evil Twin
update boards set
    model_id = 'bataleon--evil-twin',
    first_year = 2006,
    year_basis = 'introduced',
    confidence = 'verified',
    sources = ARRAY['https://bataleon.com/pages/board-archive', 'https://whitelines.com/snowboard-gear/bataleon-evil-twin-snowboard.html']
  where id in ('4d03fed5-8dfd-415f-9572-f9d38a8f418e');

  -- Bataleon Goliath
update boards set
    model_id = 'bataleon--goliath',
    first_year = 2005,
    year_basis = 'introduced',
    confidence = 'verified',
    sources = ARRAY['https://bataleon.com/pages/board-archive', 'https://thegoodride.com/snowboard-reviews/bataleon-goliath-snowboard-review/']
  where id in ('47866924-f399-4058-9d0e-c5d40cabfb40');

  -- Burton Air
update boards set
    model_id = 'burton--air',
    first_year = 1987,
    year_basis = 'earliest_sourced',
    confidence = 'verified',
    sources = ARRAY['https://boardvault.net/snowboards/year/1987', 'https://boardvault.net/snowboards/year/1994', 'https://boardvault.net/snowboards/year/2008', 'https://boardvault.net/snowboards/1987/air-1987', 'https://archive.org/details/burton-snowboards-1988', 'https://www.burton.com/en-us/blogs/the-burton-blog/burton-snowboards-history', 'https://retrosnow.com/product-category/burton/', 'https://snowboarding8090.com/boards-1980-1995/', 'https://archive.org/details/burton-1993-catalog-advanced-snowboard-science', 'https://www.michigansnowboardmuseum.com/burton---firsts--unique-decks.html', 'https://snowboardmag.com/stories/lineage-the-infallible-burton-custom', 'https://www.burton.com/en-us/blogs/the-burton-blog/burton-archives-team-rider-favorites']
  where id in ('98a431c2-d515-4515-892c-3d27f14ca531');

  -- Burton Cruzer
update boards set
    model_id = 'burton--cruzer',
    first_year = 1985,
    year_basis = 'introduced',
    confidence = 'verified',
    sources = ARRAY['https://boardvault.net/snowboards/year/1986', 'https://boardvault.net/snowboards/year/2003', 'https://boardvault.net/snowboards/year/2009', 'https://boardvault.net/snowboards/1986/cruzer-1986', 'https://www.michigansnowboardmuseum.com/burton---early-years-to-the-modern-twin.html', 'https://snowboarding8090.com/boards-1980-1995/', 'https://retrosnow.com/product-category/burton/', 'https://archive.org/details/burton-snowboards-1988', 'https://www.vintagewinter.com/blogs/blog/4555102-vintage-burton-snowboards']
  where id in ('9530e3e1-7f6e-47dc-a4fc-d53ac291076a');

  -- Burton Custom
update boards set
    model_id = 'burton--custom',
    first_year = 1996,
    year_basis = 'earliest_sourced',
    confidence = 'verified',
    sources = ARRAY['https://boardvault.net/snowboards/year/1996', 'https://boardvault.net/snowboards/year/2005', 'https://boardvault.net/snowboards/year/2013', 'https://boardvault.net/snowboards/1996/custom-1996', 'https://www.burton.com/en-us/blogs/the-burton-blog/burton-snowboards-history', 'https://www.michigansnowboardmuseum.com/burton---firsts--unique-decks.html', 'https://snowboardmag.com/stories/lineage-the-infallible-burton-custom', 'https://snowboarder.com/transworld-snowboarding-archive/snowboarding-photos/snowboard-reviews-1999', 'https://www.snowdb.com/catalog/burton', 'https://www.snowboard-review.com/snowboard_reviews/c/burton/2021/', 'https://www.burton.com/en-us/collections/snowboards', 'https://web.archive.org/web/199610/http://www.burton.com/', 'https://web.archive.org/web/199706/http://www.burton.com/']
  where id in ('b1');

  -- Burton Elite 140
update boards set
    model_id = 'burton--elite',
    first_year = 1987,
    year_basis = 'earliest_sourced',
    confidence = 'verified',
    sources = ARRAY['https://boardvault.net/snowboards/year/1987', 'https://boardvault.net/snowboards/year/2007', 'https://boardvault.net/snowboards/year/2008', 'https://boardvault.net/snowboards/1987/elite-1987', 'https://retrosnow.com/product-category/burton/', 'https://snowboarding8090.com/boards-1980-1995/', 'https://www.burton.com/en-us/blogs/the-burton-blog/iconic-burton-snowboards', 'https://archive.org/details/burton-snowboards-1988', 'https://www.vintagewinter.com/collections/vintage-snowboards']
  where id in ('board_1788135239727_1o3mr');

  -- Burton Elite 150
update boards set
    model_id = 'burton--elite',
    first_year = 1987,
    year_basis = 'earliest_sourced',
    confidence = 'verified',
    sources = ARRAY['https://boardvault.net/snowboards/year/1987', 'https://boardvault.net/snowboards/year/2007', 'https://boardvault.net/snowboards/year/2008', 'https://boardvault.net/snowboards/1987/elite-1987', 'https://retrosnow.com/product-category/burton/', 'https://snowboarding8090.com/boards-1980-1995/', 'https://www.burton.com/en-us/blogs/the-burton-blog/iconic-burton-snowboards', 'https://archive.org/details/burton-snowboards-1988', 'https://www.vintagewinter.com/collections/vintage-snowboards']
  where id in ('board_1781891034048_vjah5');

  -- Burton Fish
update boards set
    model_id = 'burton--fish',
    first_year = 2002,
    year_basis = 'earliest_sourced',
    confidence = 'verified',
    sources = ARRAY['https://boardvault.net/snowboards/year/2002', 'https://boardvault.net/snowboards/year/2008', 'https://boardvault.net/snowboards/year/2013', 'https://boardvault.net/snowboards/2002/fish-2002', 'https://www.burton.com/en-us/blogs/the-burton-blog/burton-snowboards-history', 'https://www.snowdb.com/catalog/burton', 'https://www.snowboard-review.com/snowboard_reviews/c/burton/2018/', 'https://www.snowboard-review.com/snowboard_reviews/c/burton/2021/', 'https://snowboardingprofiles.com/2023-burton-snowboards-overview', 'https://blauerboardshop.com/blogs/snowboarding/2025-burton-snowboards-overview', 'https://www.burton.com/en-us/collections/snowboards']
  where id in ('b2');

  -- Burton Flight Attendant
update boards set
    model_id = 'burton--flight-attendant',
    first_year = 2015,
    year_basis = 'introduced',
    confidence = 'verified',
    sources = ARRAY['https://www.evo.com/outlet/snowboards/burton-family-tree-flight-attendant-snowboard-2015', 'https://www.saltypeaks.com/2015-burton-snowboards-buyers-guide/', 'https://thegoodride.com/snowboard-reviews/burton-flight-attendant-2015-2020-snowboard-review/', 'https://www.snowboard-review.com/snowboard_reviews/c/burton/2021/', 'https://snowboardingprofiles.com/2023-burton-snowboards-overview', 'https://steepdb.com/b/burton/']
  where id in ('b4');

  -- Burton Hometown Hero
update boards set
    model_id = 'burton--hometown-hero',
    first_year = 2020,
    year_basis = 'introduced',
    confidence = 'verified',
    sources = ARRAY['https://www.snowboard-review.com/snowboard_reviews/c/burton/2020/', 'https://www.snowboard-review.com/snowboard_reviews/c/burton/2021/', 'https://snowboardingprofiles.com/2023-burton-snowboards-overview', 'https://blauerboardshop.com/blogs/snowboarding/2025-burton-snowboards-overview', 'https://www.burton.com/en-us/collections/snowboards']
  where id in ('ec706bfd-7a5a-46bc-bfca-8c7c4ebe3ad8');

  -- Burton Kilroy
update boards set
    model_id = 'burton--kilroy',
    first_year = 2018,
    year_basis = 'introduced',
    confidence = 'verified',
    sources = ARRAY['https://www.snowboard-review.com/snowboard_reviews/c/burton/2018/', 'https://www.snowboard-review.com/snowboard_reviews/c/burton/2021/']
  where id in ('bd2514f6-ab44-4018-8dbd-a69625b5011e');

  -- Burton Mystery Air
update boards set
    model_id = 'burton--mystery-air',
    first_year = 1989,
    year_basis = 'earliest_sourced',
    confidence = 'verified',
    sources = ARRAY['https://boardvault.net/snowboards/year/1989', 'https://boardvault.net/snowboards/year/1990', 'https://boardvault.net/snowboards/1989/mystery-1989', 'https://www.michigansnowboardmuseum.com/burton---early-years-to-the-modern-twin.html', 'https://retrosnow.com/product-category/burton/', 'https://www.burton.com/blogs/the-burton-blog/what-are-burtons-rarest-snowboards/', 'https://www.burton.com/en-us/blogs/the-burton-blog/burton-snowboards-history', 'https://snowboarding8090.com/boards-1980-1995/', 'https://www.vintagewinter.com/blogs/blog/4555102-vintage-burton-snowboards']
  where id in ('833f8a5b-7d17-4c8e-a507-87070dc6d8b5');

  -- Burton Name Dropper
update boards set
    model_id = 'burton--name-dropper',
    first_year = 2017,
    year_basis = 'introduced',
    confidence = 'verified',
    sources = ARRAY['https://www.snowboard-review.com/snowboard_reviews/c/burton/2017/', 'https://www.snowboard-review.com/snowboard_reviews/c/burton/2021/', 'https://snowboardingprofiles.com/2023-burton-snowboards-overview']
  where id in ('ce984abe-3be2-49e7-93c6-35fcde96678b');

  -- Burton Performer
update boards set
    model_id = 'burton--performer',
    first_year = 1983,
    year_basis = 'earliest_sourced',
    confidence = 'verified',
    sources = ARRAY['https://boardvault.net/snowboards/year/1983', 'https://boardvault.net/snowboards/year/1985', 'https://boardvault.net/snowboards/year/1986', 'https://boardvault.net/snowboards/1983/performer-1983', 'https://retrosnow.com/product-category/burton/', 'https://www.michigansnowboardmuseum.com/burton---early-years-to-the-modern-twin.html', 'https://snowboarding8090.com/boards-1980-1995/', 'https://www.burton.com/en-us/blogs/the-burton-blog/burton-innovation', 'https://www.burton.com/en-us/blogs/the-burton-blog/burton-snowboards-history', 'https://www.vintagewinter.com/blogs/blog/4555102-vintage-burton-snowboards']
  where id in ('2db45218-23db-4d91-afcb-9a833051534f');

  -- Burton Performer Elite
update boards set
    model_id = 'burton--performer-elite',
    first_year = 1985,
    year_basis = 'earliest_sourced',
    confidence = 'verified',
    sources = ARRAY['https://boardvault.net/snowboards/year/1985', 'https://boardvault.net/snowboards/year/1986', 'https://boardvault.net/snowboards/1985/performer-elite-1985', 'https://retrosnow.com/product-category/burton/', 'https://www.vintagewinter.com/blogs/blog/4555102-vintage-burton-snowboards', 'https://www.vintagewinter.com/collections/vintage-snowboards']
  where id in ('board_1787783875784_3su', 'ad180384-b164-4842-be1f-226c1a2af5d5');

  -- Burton Process
update boards set
    model_id = 'burton--process',
    first_year = 2011,
    year_basis = 'earliest_sourced',
    confidence = 'verified',
    sources = ARRAY['https://boardvault.net/snowboards/year/2011', 'https://boardvault.net/snowboards/year/2012', 'https://boardvault.net/snowboards/year/2013', 'https://boardvault.net/snowboards/2011/process-v-2011', 'https://www.snowdb.com/catalog/burton', 'https://archive.org/details/burton-hardgoods-2014-d.-d.-teoli-jr.-a.-c.', 'https://www.snowboard-review.com/snowboard_reviews/c/burton/2021/', 'https://snowboardingprofiles.com/2023-burton-snowboards-overview', 'https://blauerboardshop.com/blogs/snowboarding/2025-burton-snowboards-overview', 'https://www.burton.com/en-us/collections/snowboards']
  where id in ('b3');

  -- Burton Talent Scout
update boards set
    model_id = 'burton--talent-scout',
    first_year = 2017,
    year_basis = 'introduced',
    confidence = 'verified',
    sources = ARRAY['https://www.snowboard-review.com/snowboard_reviews/c/burton/2017/', 'https://www.snowboard-review.com/snowboard_reviews/c/burton/2021/', 'https://snowboardingprofiles.com/2023-burton-snowboards-overview', 'https://blauerboardshop.com/blogs/snowboarding/2025-burton-snowboards-overview', 'https://www.burton.com/en-us/collections/snowboards']
  where id in ('124c81c8-b02c-4ae7-8fa0-bfaf6038d363');

  -- Burton Woody 135
update boards set
    model_id = 'burton--woody',
    first_year = 1987,
    year_basis = 'earliest_sourced',
    confidence = 'verified',
    sources = ARRAY['https://boardvault.net/snowboards/year/1987', 'https://boardvault.net/snowboards/year/1988', 'https://boardvault.net/snowboards/1987/woody-1987', 'https://www.michigansnowboardmuseum.com/burton---early-years-to-the-modern-twin.html', 'https://retrosnow.com/product-category/burton/', 'https://www.vintagewinter.com/blogs/blog/4555102-vintage-burton-snowboards', 'https://www.vintagewinter.com/collections/vintage-snowboards']
  where id in ('board_1782795147595_d3j80');

  -- Capita Black Snowboard of Death
update boards set
    model_id = 'capita--black-snowboard-of-death',
    first_year = 2004,
    year_basis = 'earliest_sourced',
    confidence = 'verified',
    sources = ARRAY['https://thegoodride.com/snowboard-reviews/capita-black-snowboard-of-death-review/', 'https://www.evo.com/shop/snowboard/snowboards/capita', 'https://web.archive.org/web/200312/http://www.capitasnowboarding.com/', 'https://web.archive.org/web/200402/http://www.capitasnowboarding.com/', 'https://web.archive.org/web/20040214020619/http://www.capitasnowboarding.com/catalog/details/bsod_details.htm']
  where id in ('b28');

  -- Capita Defenders of Awesome
update boards set
    model_id = 'capita--defenders-of-awesome',
    first_year = 2013,
    year_basis = 'introduced',
    confidence = 'verified',
    sources = ARRAY['https://thegoodride.com/snowboard-reviews/capita-defenders-of-awesome-snowboard-review/', 'https://www.evo.com/shop/snowboard/snowboards/capita']
  where id in ('a14c2553-442a-4741-91b1-0a38234bf0d6');

  -- Capita Mega Mercury
update boards set
    model_id = 'capita--mega-mercury',
    first_year = 2023,
    year_basis = 'introduced',
    confidence = 'verified',
    sources = ARRAY['https://thegoodride.com/snowboard-reviews/capita-mega-merc-snowboard-review/', 'https://www.evo.com/shop/snowboard/snowboards/capita']
  where id in ('c4eedfd4-2be0-412d-8b1a-1f6a32dcda64');

  -- Capita Mercury
update boards set
    model_id = 'capita--mercury',
    first_year = 2016,
    year_basis = 'introduced',
    confidence = 'verified',
    sources = ARRAY['https://thegoodride.com/snowboard-reviews/capita-mercury-snowboard-review/', 'https://www.evo.com/shop/snowboard/snowboards/capita']
  where id in ('b6');

  -- Capita Ultrafear
update boards set
    model_id = 'capita--ultrafear',
    first_year = 2011,
    year_basis = 'introduced',
    confidence = 'verified',
    sources = ARRAY['https://thegoodride.com/snowboard-reviews/capita-ultrafear-2021-snowboard-review/', 'https://thegoodride.com/snowboard-reviews/capita-ultrafear-snowboard-review/']
  where id in ('b7');

  -- Gentemstick Mantaray
update boards set
    model_id = 'gentemstick--mantaray',
    first_year = 2019,
    year_basis = 'earliest_sourced',
    confidence = 'verified',
    sources = ARRAY['https://thegoodride.com/snowboard-reviews/gentemstick-mantaray-snowboard-review/', 'https://gentemstick.com/en/collections/snowboards']
  where id in ('1786a006-b8bf-46fb-b1de-af94b44c7267');

  -- Gentemstick Stingray
update boards set
    model_id = 'gentemstick--stingray',
    first_year = 2015,
    year_basis = 'introduced',
    confidence = 'likely',
    sources = ARRAY['https://thegoodride.com/snowboard-reviews/gentemstick-stingray-snowboard-review/']
  where id in ('4c44c137-77b8-4947-beca-d8a1352f707a');

  -- Gentemstick TT
update boards set
    model_id = 'gentemstick--t-t',
    first_year = NULL,
    year_basis = 'unknown',
    confidence = 'likely',
    sources = ARRAY['https://gentemstick.com/en/collections/snowboards']
  where id in ('72a6fb96-7c85-4523-a58a-6b5004f3fd3e');

  -- Gnu Antigravity
update boards set
    model_id = 'gnu--antigravity',
    first_year = 1988,
    year_basis = 'earliest_sourced',
    confidence = 'verified',
    sources = ARRAY['https://www.michigansnowboardmuseum.com/the-neon-era--other-80s-decks.html', 'https://www.agnarchy.com/1988-gnu-antigravity/', 'https://www.gnu.com/1920-antigravity', 'https://www.gnu.com/gnu-snowboards', 'https://thegoodride.com/snowboard-reviews/gnu-antigravity-snowboard-review/']
  where id in ('board_1787669361279_8xhw7');

  -- Gnu Bas
update boards set
    model_id = 'gnu--bas',
    first_year = 1995,
    year_basis = 'introduced',
    confidence = 'likely',
    sources = ARRAY['https://retrosnow.com/product-category/gnu/']
  where id in ('board_1781820560522_a2q2b');

  -- Gnu Carbon Credit
update boards set
    model_id = 'gnu--carbon-credit',
    first_year = 2010,
    year_basis = 'earliest_sourced',
    confidence = 'likely',
    sources = ARRAY['https://www.snowdb.com/catalog/gnu']
  where id in ('b17');

  -- Gnu Ladies Choice
update boards set
    model_id = 'gnu--ladies-choice',
    first_year = 2015,
    year_basis = 'earliest_sourced',
    confidence = 'verified',
    sources = ARRAY['https://www.snowboarder.com/transworld-snowboarding-archive/snowboarding-gear/gnu-ladies-choice-snowboard-review-2014-2015/', 'https://www.gnu.com/gnu-snowboards', 'https://www.evo.com/shop/snowboard/snowboards/gnu']
  where id in ('159e5b42-5d95-4bba-a932-2969c62e8d57');

  -- Gnu Money
update boards set
    model_id = 'gnu--money',
    first_year = 2025,
    year_basis = 'earliest_sourced',
    confidence = 'verified',
    sources = ARRAY['https://www.gnu.com/gnu-snowboards', 'https://www.evo.com/shop/snowboard/snowboards/gnu']
  where id in ('6276d840-aead-4d1a-89b5-8110860aa9fd');

  -- Gnu Riders Choice
update boards set
    model_id = 'gnu--riders-choice',
    first_year = 2004,
    year_basis = 'earliest_sourced',
    confidence = 'verified',
    sources = ARRAY['https://www.snowdb.com/catalog/gnu', 'https://snowboarder.com/transworld-snowboarding-archive/snowboarding-gear/gnu-riders-choice-snowboard-review-2014-2015', 'https://thegoodride.com/snowboard-reviews/gnu-riders-choice-2010-2019-snowboard-review/', 'https://www.evo.com/shop/snowboard/snowboards/gnu', 'https://web.archive.org/web/200311/http://www.gnu.com/', 'https://web.archive.org/web/200812/http://www.gnu.com/']
  where id in ('6f5f31ec-fd4f-4361-94d6-0af83d470782');

  -- Jones Explorer
update boards set
    model_id = 'jones--explorer',
    first_year = 2016,
    year_basis = 'introduced',
    confidence = 'likely',
    sources = ARRAY['https://thegoodride.com/snowboard-reviews/jones-explorer-2016-2019-snowboard-review/']
  where id in ('b15');

  -- Jones Flagship
update boards set
    model_id = 'jones--flagship',
    first_year = 2011,
    year_basis = 'introduced',
    confidence = 'verified',
    sources = ARRAY['https://thegoodride.com/snowboard-reviews/jones-flagship-snowboard-review/', 'https://www.jonessnowboards.com/collections/mens-snowboards']
  where id in ('b16');

  -- Jones Frontier
update boards set
    model_id = 'jones--frontier',
    first_year = 2020,
    year_basis = 'introduced',
    confidence = 'verified',
    sources = ARRAY['https://thegoodride.com/snowboard-reviews/jones-frontier-2-0-snowboard-review/', 'https://www.jonessnowboards.com/collections/mens-snowboards']
  where id in ('7ab11450-b3f6-47aa-96ff-d8cd01089fb8');

  -- Jones Hovercraft
update boards set
    model_id = 'jones--hovercraft',
    first_year = 2011,
    year_basis = 'introduced',
    confidence = 'verified',
    sources = ARRAY['https://thegoodride.com/snowboard-reviews/jones-hovercraft-2-0-snowboard-review/', 'https://en.wikipedia.org/wiki/Jones_Snowboards']
  where id in ('76a50e90-3a80-456a-8b94-5eb2b0fcde28');

  -- Jones Mountain Twin
update boards set
    model_id = 'jones--mountain-twin',
    first_year = 2011,
    year_basis = 'introduced',
    confidence = 'verified',
    sources = ARRAY['https://thegoodride.com/snowboard-reviews/jones-mountain-twin-snowboard-review/', 'https://www.jonessnowboards.com/collections/mens-snowboards']
  where id in ('47bdcd4b-0882-4330-b2fe-475640015e43');

  -- Jones Solution
update boards set
    model_id = 'jones--solution',
    first_year = NULL,
    year_basis = 'unknown',
    confidence = 'likely',
    sources = ARRAY['https://thegoodride.com/snowboard-reviews/jones-solution-split-review-by-jay/', 'https://thegoodride.com/snowboard-reviews/jones-womens-solution-splitboard-2020-2024-review-by-steph-w/']
  where id in ('63540c26-3242-40ad-8279-2541a180f6e6');

  -- Jones Stratos
update boards set
    model_id = 'jones--stratos',
    first_year = 2020,
    year_basis = 'introduced',
    confidence = 'verified',
    sources = ARRAY['https://thegoodride.com/snowboard-reviews/jones-stratos-2020-2025-snowboard-review', 'https://www.jonessnowboards.com/collections/mens-snowboards']
  where id in ('acc12b77-1305-44cd-a7d6-8095a8f36ea5');

  -- K2 Antidote
update boards set
    model_id = 'k2--antidote',
    first_year = 2024,
    year_basis = 'introduced',
    confidence = 'verified',
    sources = ARRAY['https://thegoodride.com/snowboard-reviews/k2-antidote-snowboard-review/', 'https://www.evo.com/shop/snowboard/snowboards/k2']
  where id in ('06b2ddc3-3dae-4978-8255-5c5902df6cb4');

  -- K2 Broadcast
update boards set
    model_id = 'k2--broadcast',
    first_year = 2019,
    year_basis = 'introduced',
    confidence = 'likely',
    sources = ARRAY['https://thegoodride.com/snowboard-reviews/k2-broadcast-2019-snowboard-review/']
  where id in ('f7dc3b85-3d82-4731-a8cd-3dcedd6f933c');

  -- K2 Gyrator
update boards set
    model_id = 'k2--gyrator',
    first_year = 1988,
    year_basis = 'introduced',
    confidence = 'verified',
    sources = ARRAY['https://www.michigansnowboardmuseum.com/the-neon-era--other-80s-decks.html', 'https://retrosnow.com/shop/k2/k2-88/k2-gyrator/']
  where id in ('4fd9db14-e106-476f-b010-e2328190be8e');

  -- K2 Manifest
update boards set
    model_id = 'k2--manifest',
    first_year = 2019,
    year_basis = 'introduced',
    confidence = 'verified',
    sources = ARRAY['https://thegoodride.com/snowboard-reviews/k2-manifest-snowboard-review/', 'https://www.evo.com/shop/snowboard/snowboards/k2']
  where id in ('bac26e81-3a34-4540-b288-d0654d30c29d');

  -- K2 Party Platter
update boards set
    model_id = 'k2--party-platter',
    first_year = 2017,
    year_basis = 'introduced',
    confidence = 'likely',
    sources = ARRAY['https://thegoodride.com/snowboard-reviews/k2-party-platter-2017-2019-snowboard-review/', 'https://thegoodride.com/snowboard-reviews/k2-womens-party-platter-2020-2024-snowboard-review-by-steph-w/']
  where id in ('b23');

  -- K2 Raygun
update boards set
    model_id = 'k2--raygun',
    first_year = 2010,
    year_basis = 'introduced',
    confidence = 'likely',
    sources = ARRAY['https://thegoodride.com/snowboard-reviews/k2-raygun-2010-2019-snowboard-review/']
  where id in ('b22');

  -- Korua Cafe Racer
update boards set
    model_id = 'korua-shapes--cafe-racer',
    first_year = 2020,
    year_basis = 'introduced',
    confidence = 'verified',
    sources = ARRAY['https://thegoodride.com/snowboard-reviews/korua-cafe-racer-2020-2024-snowboard-review/', 'https://www.koruashapes.com/collections/snowboards']
  where id in ('e7cfb454-0cdd-48f0-880c-4f221b722b52');

  -- Korua Dart
update boards set
    model_id = 'korua-shapes--dart',
    first_year = 2019,
    year_basis = 'earliest_sourced',
    confidence = 'verified',
    sources = ARRAY['https://thegoodride.com/snowboard-reviews/korua-dart-2019-2020-snowboard-review/', 'https://www.koruashapes.com/collections/snowboards']
  where id in ('452fd83d-f81b-4f49-9f63-30f097203d98');

  -- Korua Otto
update boards set
    model_id = 'korua-shapes--otto',
    first_year = 2018,
    year_basis = 'introduced',
    confidence = 'verified',
    sources = ARRAY['https://thegoodride.com/snowboard-reviews/korua-otto-classic-snowboard-review/', 'https://www.koruashapes.com/collections/snowboards']
  where id in ('6adcfb33-5199-4708-8cdc-3ec01ee231cc');

  -- Korua Pencil
update boards set
    model_id = 'korua-shapes--pencil',
    first_year = 2018,
    year_basis = 'introduced',
    confidence = 'verified',
    sources = ARRAY['https://thegoodride.com/snowboard-reviews/korua-pencil-snowboard-review/', 'https://thegoodride.com/snowboard-reviews/korua-pencil-plus-snowboard-review/', 'https://www.koruashapes.com/collections/snowboards']
  where id in ('f6e5d4e5-8fa1-42ee-a593-ffa17d14ebfe');

  -- Lib Tech Box Scratcher
update boards set
    model_id = 'lib-tech--box-scratcher',
    first_year = 2008,
    year_basis = 'earliest_sourced',
    confidence = 'verified',
    sources = ARRAY['https://www.snowdb.com/catalog/lib-technologies', 'https://web.archive.org/web/200710/http://www.lib-tech.com/', 'https://web.archive.org/web/200812/http://www.lib-tech.com/']
  where id in ('51aafd5f-a816-4266-862f-b86deec78231');

  -- Lib Tech Cold Brew
update boards set
    model_id = 'lib-tech--cold-brew',
    first_year = 2025,
    year_basis = 'earliest_sourced',
    confidence = 'verified',
    sources = ARRAY['https://www.lib-tech.com/snowboards', 'https://www.evo.com/shop/snowboard/snowboards/lib-technologies']
  where id in ('696a5e1a-d488-489a-af67-479298c03360');

  -- Lib Tech Emmagator
update boards set
    model_id = 'lib-tech--emmagator',
    first_year = 1998,
    year_basis = 'earliest_sourced',
    confidence = 'verified',
    sources = ARRAY['https://web.archive.org/web/19980218102632/http://gnu.com/libboards.html']
  where id in ('board_1772834066604_dfh8o');

  -- Lib Tech Litigator
update boards set
    model_id = 'lib-tech--litigator',
    first_year = 1992,
    year_basis = 'earliest_sourced',
    confidence = 'verified',
    sources = ARRAY['https://retrosnow.com/product-category/lib-tech/', 'https://web.archive.org/web/200311/http://www.lib-tech.com/', 'https://web.archive.org/web/19980218102632/http://gnu.com/libboards.html']
  where id in ('board_1781822252681_37fh6');

  -- Lib Tech Orca
update boards set
    model_id = 'lib-tech--orca',
    first_year = 2019,
    year_basis = 'introduced',
    confidence = 'verified',
    sources = ARRAY['https://www.lib-tech.com/about-lib-tech/history', 'https://www.evo.com/shop/snowboard/snowboards/lib-technologies', 'https://www.lib-tech.com/snowboards']
  where id in ('b10');

  -- Lib Tech Skate Banana
update boards set
    model_id = 'lib-tech--skate-banana',
    first_year = 2007,
    year_basis = 'earliest_sourced',
    confidence = 'verified',
    sources = ARRAY['https://www.lib-tech.com/about-lib-tech/history', 'https://www.snowdb.com/catalog/lib-technologies', 'https://www.lib-tech.com/snowboards', 'https://www.evo.com/shop/snowboard/snowboards/lib-technologies', 'https://web.archive.org/web/200710/http://www.lib-tech.com/', 'https://web.archive.org/web/200812/http://www.lib-tech.com/']
  where id in ('b8');

  -- Lib Tech T.Rice Pro
update boards set
    model_id = 'lib-tech--t-rice-pro',
    first_year = 2005,
    year_basis = 'earliest_sourced',
    confidence = 'verified',
    sources = ARRAY['https://www.lib-tech.com/about-lib-tech/history', 'https://snowboarder.com/transworld-snowboarding-archive/snowboarding-photos/what-the-pros-are-rockin-travis-rice', 'https://www.snowdb.com/catalog/lib-technologies', 'https://www.lib-tech.com/snowboards', 'https://www.evo.com/shop/snowboard/snowboards/lib-technologies', 'https://web.archive.org/web/200511/http://www.lib-tech.com/', 'https://web.archive.org/web/200812/http://www.lib-tech.com/']
  where id in ('69cfcfb0-a7d3-4736-bb36-cee6f5d8a3a5');

  -- Lib Tech TRS
update boards set
    model_id = 'lib-tech--trs',
    first_year = 2002,
    year_basis = 'earliest_sourced',
    confidence = 'verified',
    sources = ARRAY['https://www.snowdb.com/catalog/lib-technologies', 'https://www.snowboarder.com/transworld-snowboarding-archive/lib-tech-trs', 'https://web.archive.org/web/200110/http://www.lib-tech.com/', 'https://web.archive.org/web/200804/http://www.lib-tech.com/']
  where id in ('b9');

  -- Never Summer Harpoon
update boards set
    model_id = 'never-summer--harpoon',
    first_year = 2021,
    year_basis = 'introduced',
    confidence = 'likely',
    sources = ARRAY['https://thegoodride.com/snowboard-reviews/never-summer-harpoon-snowboard-review/']
  where id in ('1cddb69d-816f-4303-a9fa-3d239d0ce682');

  -- Never Summer Proto FR
update boards set
    model_id = 'never-summer--proto-fr',
    first_year = 2026,
    year_basis = 'introduced',
    confidence = 'likely',
    sources = ARRAY['https://thegoodride.com/snowboard-reviews/?brand=jones']
  where id in ('66366d6b-9eaf-4317-b24d-d0d09d5f240a');

  -- Never Summer Proto Type Two
update boards set
    model_id = 'never-summer--proto-type-two',
    first_year = 2016,
    year_basis = 'introduced',
    confidence = 'likely',
    sources = ARRAY['https://thegoodride.com/snowboard-reviews/never-summer-proto-type-two-snowboard-review/']
  where id in ('b19');

  -- Never Summer West
update boards set
    model_id = 'never-summer--west',
    first_year = 2016,
    year_basis = 'introduced',
    confidence = 'likely',
    sources = ARRAY['https://thegoodride.com/snowboard-reviews/never-summer-west-snowboard-review/']
  where id in ('d8748998-5da6-456c-bfcc-93f44e7e3bd5');

  -- Nidecker Alpha
update boards set
    model_id = 'nidecker--alpha',
    first_year = 2026,
    year_basis = 'earliest_sourced',
    confidence = 'likely',
    sources = ARRAY['https://www.evo.com/shop/snowboard/snowboards/nidecker']
  where id in ('b1bb4cbc-0a8e-48b7-8d86-acc1bb064ffa');

  -- Nidecker Escape
update boards set
    model_id = 'nidecker--escape',
    first_year = 2001,
    year_basis = 'earliest_sourced',
    confidence = 'verified',
    sources = ARRAY['https://www.evo.com/shop/snowboard/snowboards/nidecker', 'https://web.archive.org/web/200103/http://www.nidecker.com/', 'https://web.archive.org/web/200108/http://www.nidecker.com/']
  where id in ('5465cdbe-942e-4c2d-9c43-0ab9c21dd38a');

  -- Nidecker Merc
update boards set
    model_id = 'nidecker--merc',
    first_year = 2026,
    year_basis = 'earliest_sourced',
    confidence = 'likely',
    sources = ARRAY['https://www.evo.com/shop/snowboard/snowboards/nidecker']
  where id in ('9905ee81-d4f7-4ea0-a5a5-2169a8241bb6');

  -- Nidecker Sensor
update boards set
    model_id = 'nidecker--sensor',
    first_year = 2026,
    year_basis = 'earliest_sourced',
    confidence = 'likely',
    sources = ARRAY['https://www.evo.com/shop/snowboard/snowboards/nidecker']
  where id in ('d9cc385a-0fd7-4d04-bb43-edf0c905c0c9');

  -- Nidecker Thruster
update boards set
    model_id = 'nidecker--thruster',
    first_year = 2026,
    year_basis = 'earliest_sourced',
    confidence = 'likely',
    sources = ARRAY['https://www.evo.com/shop/snowboard/snowboards/nidecker']
  where id in ('6a1962d8-0c52-4416-a2c8-8fc831a877b9');

  -- Nitro Beast
update boards set
    model_id = 'nitro--beast',
    first_year = 2020,
    year_basis = 'earliest_sourced',
    confidence = 'likely',
    sources = ARRAY['https://www.evo.com/products/186907-nitro-beast-snowboard-2020', 'https://www.evo.com/products/267390-nitro-beast-snowboard-2026']
  where id in ('3eaffd99-bde3-48ef-8bbf-cad6301cd423');

  -- Nitro Fusion
update boards set
    model_id = 'nitro--fusion',
    first_year = 1990,
    year_basis = 'introduced',
    confidence = 'verified',
    sources = ARRAY['https://www.michigansnowboardmuseum.com/the-neon-era--other-80s-decks.html', 'https://thegoodride.com/snowboard-reviews/nitro-quiver-fusion-2022-snowboard-review/', 'https://archive.org/details/ISM-87-91']
  where id in ('board_1772833835002_h6pny');

commit;
