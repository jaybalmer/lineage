import type { Person, Place, Org, Board, Event, Claim, Source, EventSeries, EntityType } from "@/types"

// ─── Places ──────────────────────────────────────────────────────────────────

export const PLACES: Place[] = [
  // BC Canada
  { id: "p1",  name: "Whistler Blackcomb",       place_type: "resort", osm_id: "265662",   wikidata_qid: "Q935235",  region: "Sea-to-Sky",          country: "CA", lat: 50.1163, lon: -122.9574, website: "https://www.whistlerblackcomb.com", first_snowboard_year: 1987, description: "The largest ski resort in North America, built on the unceded territory of the Squamish and Lil'wat nations. Whistler Mountain opened in 1966, Blackcomb in 1980. Snowboards were first permitted in the late 1980s and the mountain became one of the defining venues of West Coast snowboarding culture." },
  { id: "p2",  name: "Mt. Seymour",               place_type: "resort", osm_id: "1234567",                            region: "North Shore",         country: "CA", lat: 49.3717, lon: -122.9451, first_snowboard_year: 1984, description: "A community mountain on the North Shore of Vancouver, Mt. Seymour has been a proving ground for generations of local riders. Its accessible location made it a critical incubator for the early Vancouver snowboard scene in the 1980s." },
  { id: "p3",  name: "Sun Peaks Resort",          place_type: "resort", osm_id: "2345678",                            region: "Thompson-Okanagan",   country: "CA", lat: 50.8827, lon: -119.8805 },
  { id: "p4",  name: "Revelstoke Mountain Resort",place_type: "resort", osm_id: "3456789",                            region: "Kootenays",           country: "CA", lat: 51.0549, lon: -118.1697, first_snowboard_year: 2007, description: "Opened in December 2007, Revelstoke was built from the ground up with snowboarding in mind. Home to North America's greatest verified vertical drop (1,713m) and a legendary backcountry scene, it quickly became a destination resort for expert riders worldwide." },
  { id: "p5",  name: "Powder King Mountain Resort",place_type: "resort",                                              region: "Northern BC",         country: "CA", lat: 55.3500, lon: -122.5500 },
  { id: "p6",  name: "Panorama Mountain Resort",  place_type: "resort",                                              region: "East Kootenays",      country: "CA", lat: 50.4603, lon: -116.2358 },
  { id: "p17", name: "Big White Ski Resort",       place_type: "resort",                                              region: "Okanagan",            country: "CA", lat: 49.7180, lon: -118.9314 },
  { id: "p18", name: "Silver Star Mountain Resort",place_type: "resort",                                              region: "Okanagan",            country: "CA", lat: 50.3612, lon: -119.0597 },
  { id: "p19", name: "Cypress Mountain",           place_type: "resort",                                              region: "North Shore",         country: "CA", lat: 49.3958, lon: -123.2042 },
  { id: "p20", name: "Mt. Washington Alpine Resort",place_type: "resort",                                             region: "Vancouver Island",    country: "CA", lat: 49.7526, lon: -125.3006 },
  { id: "p21", name: "Kicking Horse Mountain Resort",place_type: "resort",                                            region: "East Kootenays",      country: "CA", lat: 51.2985, lon: -117.0430 },
  { id: "p22", name: "Fernie Alpine Resort",       place_type: "resort",                                              region: "East Kootenays",      country: "CA", lat: 49.4637, lon: -115.0785 },
  { id: "p23", name: "Red Mountain Resort",        place_type: "resort",                                              region: "Kootenays",           country: "CA", lat: 49.1028, lon: -117.8133 },
  { id: "p24", name: "Banff Sunshine Village",     place_type: "resort",                                              region: "Alberta",             country: "CA", lat: 51.0887, lon: -115.7677 },
  { id: "p25", name: "Lake Louise Ski Resort",     place_type: "resort",                                              region: "Alberta",             country: "CA", lat: 51.4254, lon: -116.1773 },
  // Washington / Pacific NW
  { id: "p26", name: "Mt. Baker Ski Area",         place_type: "resort",                                              region: "Washington",          country: "US", lat: 48.8586, lon: -121.6726, website: "https://www.mtbaker.us", first_snowboard_year: 1982, description: "One of the first ski resorts in North America to welcome snowboarders, Mt. Baker opened its gates to snowboards in 1982. Home of the legendary Legendary Banked Slalom — one of snowboarding's oldest and most respected contests, held annually since 1985." },
  { id: "p27", name: "Stevens Pass",               place_type: "resort",                                              region: "Washington",          country: "US", lat: 47.7440, lon: -121.0876 },
  { id: "p28", name: "Crystal Mountain",           place_type: "resort",                                              region: "Washington",          country: "US", lat: 46.9279, lon: -121.4744 },
  { id: "p29", name: "Mt. Hood Meadows",           place_type: "resort",                                              region: "Oregon",              country: "US", lat: 45.3313, lon: -121.6648 },
  { id: "p30", name: "Timberline Lodge",           place_type: "resort",                                              region: "Oregon",              country: "US", lat: 45.3312, lon: -121.7104 },
  // California
  { id: "p31", name: "Mammoth Mountain",           place_type: "resort",                                              region: "California",          country: "US", lat: 37.6309, lon: -119.0326 },
  { id: "p32", name: "Tahoe Local (various)",      place_type: "zone",                                                region: "Lake Tahoe",          country: "US", lat: 39.0968, lon: -120.0324 },
  { id: "p33", name: "Northstar California",       place_type: "resort",                                              region: "California",          country: "US", lat: 39.2742, lon: -120.1208 },
  // Rocky Mountains
  { id: "p34", name: "Jackson Hole Mountain Resort",place_type: "resort",                                             region: "Wyoming",             country: "US", lat: 43.5875, lon: -110.8280 },
  { id: "p35", name: "Breckenridge Ski Resort",   place_type: "resort",                                              region: "Colorado",            country: "US", lat: 39.4817, lon: -106.0664 },
  { id: "p36", name: "Vail Mountain",              place_type: "resort",                                              region: "Colorado",            country: "US", lat: 39.6433, lon: -106.3748 },
  { id: "p37", name: "Arapahoe Basin",             place_type: "resort",                                              region: "Colorado",            country: "US", lat: 39.6423, lon: -105.8710 },
  { id: "p38", name: "Crested Butte Mountain Resort",place_type: "resort",                                            region: "Colorado",            country: "US", lat: 38.8980, lon: -106.9624 },
  // Shops
  { id: "p7",  name: "The Snowboard Shop",         place_type: "shop",                                                region: "Vancouver",           country: "CA", lat: 49.2827, lon: -123.1207 },
  { id: "p8",  name: "Edge Control Snowboards",    place_type: "shop",                                                region: "North Shore",         country: "CA" },
  { id: "p9",  name: "Showcase Snowboards",        place_type: "shop",                                                region: "Whistler",            country: "CA" },
  { id: "p10", name: "The Board Room",             place_type: "shop",                                                region: "Seattle",             country: "US" },
  // Westbeach retail locations
  { id: "pw1", name: "Westbeach Vancouver",        place_type: "shop",                                                region: "Vancouver",           country: "CA", lat: 49.2820, lon: -123.1200 },
  { id: "pw2", name: "Westbeach Whistler Village", place_type: "shop",                                                region: "Whistler",            country: "CA", lat: 50.1152, lon: -122.9551 },
]

// ─── Event Series ─────────────────────────────────────────────────────────────

export const EVENT_SERIES: EventSeries[] = [
  { id: "es1", name: "Baker Banked Slalom",     place_id: "p26", frequency: "annual", start_year: 1985, description: "Legendary natural banked slalom at Mt. Baker. One of the oldest and most respected events in snowboarding." },
  { id: "es2", name: "Mt. Seymour Banked Slalom",place_id: "p2", frequency: "annual", start_year: 1995 },
  { id: "es3", name: "Whistler Big Air",         place_id: "p1",  frequency: "annual", start_year: 2000 },
  { id: "es4", name: "Kootenay Powder Trip",     place_id: "p4",  frequency: "irregular", start_year: 2005 },
  { id: "es5", name: "Revelstoke Film Project",  place_id: "p4",  frequency: "irregular", start_year: 2008 },
  { id: "es6", name: "North Shore Sessions",     place_id: "p2",  frequency: "annual", start_year: 2002 },
  { id: "es7", name: "Westbeach Classic",        place_id: "p1",  frequency: "annual", start_year: 1988, end_year: 1995, description: "Whistler's premier early-era snowboard contest, organized by Westbeach. A defining event of Canadian snowboarding's formative years, drawing the sport's top names through the late '80s and early '90s." },
]

// ─── Events (instances) ───────────────────────────────────────────────────────

export const EVENTS: Event[] = [
  // Baker Banked Slalom instances
  { id: "e10", name: "Baker Banked Slalom '95",  event_type: "contest",   start_date: "1995-02-12", end_date: "1995-02-12", place_id: "p26", series_id: "es1", year: 1995 },
  { id: "e11", name: "Baker Banked Slalom '98",  event_type: "contest",   start_date: "1998-02-08", end_date: "1998-02-08", place_id: "p26", series_id: "es1", year: 1998 },
  { id: "e12", name: "Baker Banked Slalom '02",  event_type: "contest",   start_date: "2002-02-17", end_date: "2002-02-17", place_id: "p26", series_id: "es1", year: 2002 },
  { id: "e13", name: "Baker Banked Slalom '05",  event_type: "contest",   start_date: "2005-02-13", end_date: "2005-02-13", place_id: "p26", series_id: "es1", year: 2005 },
  { id: "e14", name: "Baker Banked Slalom '09",  event_type: "contest",   start_date: "2009-02-15", end_date: "2009-02-15", place_id: "p26", series_id: "es1", year: 2009 },
  { id: "e15", name: "Baker Banked Slalom '12",  event_type: "contest",   start_date: "2012-02-19", end_date: "2012-02-19", place_id: "p26", series_id: "es1", year: 2012 },
  { id: "e16", name: "Baker Banked Slalom '15",  event_type: "contest",   start_date: "2015-02-22", end_date: "2015-02-22", place_id: "p26", series_id: "es1", year: 2015 },
  { id: "e17", name: "Baker Banked Slalom '16",  event_type: "contest",   start_date: "2016-02-21", end_date: "2016-02-21", place_id: "p26", series_id: "es1", year: 2016 },
  { id: "e18", name: "Baker Banked Slalom '17",  event_type: "contest",   start_date: "2017-02-19", end_date: "2017-02-19", place_id: "p26", series_id: "es1", year: 2017 },
  { id: "e19", name: "Baker Banked Slalom '18",  event_type: "contest",   start_date: "2018-02-18", end_date: "2018-02-18", place_id: "p26", series_id: "es1", year: 2018 },
  { id: "e23", name: "Baker Banked Slalom '19",  event_type: "contest",   start_date: "2019-02-17", end_date: "2019-02-17", place_id: "p26", series_id: "es1", year: 2019 },
  { id: "e24", name: "Baker Banked Slalom '22",  event_type: "contest",   start_date: "2022-02-20", end_date: "2022-02-20", place_id: "p26", series_id: "es1", year: 2022, description: "First return after two years cancelled due to COVID. Sold out field, all-natural course." },
  { id: "e25", name: "Baker Banked Slalom '23",  event_type: "contest",   start_date: "2023-02-19", end_date: "2023-02-19", place_id: "p26", series_id: "es1", year: 2023 },
  { id: "e26", name: "Baker Banked Slalom '24",  event_type: "contest",   start_date: "2024-02-18", end_date: "2024-02-18", place_id: "p26", series_id: "es1", year: 2024 },
  // Mt. Seymour Banked Slalom instances
  { id: "e1",  name: "Mt. Seymour Banked Slalom '04", event_type: "contest", start_date: "2004-02-15", end_date: "2004-02-15", place_id: "p2", series_id: "es2", year: 2004 },
  { id: "e20", name: "Mt. Seymour Banked Slalom '06", event_type: "contest", start_date: "2006-02-12", end_date: "2006-02-12", place_id: "p2", series_id: "es2", year: 2006 },
  { id: "e21", name: "Mt. Seymour Banked Slalom '08", event_type: "contest", start_date: "2008-02-10", end_date: "2008-02-10", place_id: "p2", series_id: "es2", year: 2008 },
  { id: "e22", name: "Mt. Seymour Banked Slalom '10", event_type: "contest", start_date: "2010-02-14", end_date: "2010-02-14", place_id: "p2", series_id: "es2", year: 2010 },
  // Whistler Big Air instances
  { id: "e2",  name: "Whistler Big Air '06",     event_type: "contest",   start_date: "2006-03-10", end_date: "2006-03-11", place_id: "p1", series_id: "es3", year: 2006 },
  { id: "e30", name: "Whistler Big Air '08",     event_type: "contest",   start_date: "2008-03-08", end_date: "2008-03-09", place_id: "p1", series_id: "es3", year: 2008 },
  { id: "e31", name: "Whistler Big Air '10",     event_type: "contest",   start_date: "2010-03-14", end_date: "2010-03-15", place_id: "p1", series_id: "es3", year: 2010 },
  // Kootenay trips
  { id: "e3",  name: "Kootenay Powder Trip '08", event_type: "trip",      start_date: "2008-01-20", end_date: "2008-01-27", place_id: "p4", series_id: "es4", year: 2008 },
  { id: "e40", name: "Kootenay Powder Trip '11", event_type: "trip",      start_date: "2011-02-05", end_date: "2011-02-12", place_id: "p4", series_id: "es4", year: 2011 },
  // Film shoots
  { id: "e4",  name: "Revelstoke Film Shoot '10",event_type: "film-shoot",start_date: "2010-02-01", end_date: "2010-02-10", place_id: "p4", series_id: "es5", year: 2010 },
  { id: "e50", name: "Revelstoke Film Shoot '13",event_type: "film-shoot",start_date: "2013-01-28", end_date: "2013-02-05", place_id: "p4", series_id: "es5", year: 2013 },
  { id: "e51", name: "Revelstoke Film Shoot '16",event_type: "film-shoot",start_date: "2016-02-10", end_date: "2016-02-18", place_id: "p4", series_id: "es5", year: 2016 },
  // Westbeach Classic (es7) — Whistler, 1988–1995
  { id: "ewc1", name: "Westbeach Classic '88",    event_type: "contest",   start_date: "1988-03-20", end_date: "1988-03-20", place_id: "p1", series_id: "es7", year: 1988, description: "Inaugural Westbeach Classic at Whistler. One of the first major snowboard contests in Canada." },
  { id: "ewc2", name: "Westbeach Classic '89",    event_type: "contest",   start_date: "1989-03-19", end_date: "1989-03-19", place_id: "p1", series_id: "es7", year: 1989 },
  { id: "ewc3", name: "Westbeach Classic '90",    event_type: "contest",   start_date: "1990-03-18", end_date: "1990-03-18", place_id: "p1", series_id: "es7", year: 1990 },
  { id: "ewc4", name: "Westbeach Classic '91",    event_type: "contest",   start_date: "1991-03-17", end_date: "1991-03-17", place_id: "p1", series_id: "es7", year: 1991 },
  { id: "ewc5", name: "Westbeach Classic '92",    event_type: "contest",   start_date: "1992-03-22", end_date: "1992-03-22", place_id: "p1", series_id: "es7", year: 1992 },
  { id: "ewc6", name: "Westbeach Classic '93",    event_type: "contest",   start_date: "1993-03-21", end_date: "1993-03-21", place_id: "p1", series_id: "es7", year: 1993 },
  { id: "ewc7", name: "Westbeach Classic '94",    event_type: "contest",   start_date: "1994-03-20", end_date: "1994-03-20", place_id: "p1", series_id: "es7", year: 1994 },
  { id: "ewc8", name: "Westbeach Classic '95",    event_type: "contest",   start_date: "1995-03-19", end_date: "1995-03-19", place_id: "p1", series_id: "es7", year: 1995, description: "Final edition of the Westbeach Classic as the contest circuit shifted to larger commercial events." },
  // Westbeach Cup & other events
  { id: "ew1", name: "Westbeach Cup '96",         event_type: "contest",   start_date: "1996-03-08", end_date: "1996-03-08", place_id: "p1", year: 1996, description: "Annual BC snowboarding contest hosted by Westbeach at Whistler." },
  { id: "ew2", name: "Westbeach Cup '98",         event_type: "contest",   start_date: "1998-03-05", end_date: "1998-03-06", place_id: "p1", year: 1998, description: "Third edition of the Westbeach Cup — riders' choice format with cash prizes." },
  { id: "ew3", name: "Westbeach Style Session '04",event_type: "film-shoot",start_date: "2004-01-15", end_date: "2004-01-22", place_id: "p4", year: 2004, description: "Westbeach film project shot in the Kootenays. Featured the brand's team in early-season deep snow." },
]

// ─── Orgs ─────────────────────────────────────────────────────────────────────

export const ORGS: Org[] = [
  // Board brands
  { id: "o1",  name: "Burton Snowboards",        org_type: "brand", brand_category: "board_brand",  wikidata_qid: "Q4988186", founded_year: 1977, country: "US", website: "https://www.burton.com",         description: "The world's leading snowboard company, founded by Jake Burton Carpenter in Vermont. Instrumental in growing snowboarding from a fringe sport to a global phenomenon." },
  { id: "o2",  name: "Capita Snowboards",        org_type: "brand", brand_category: "board_brand",  founded_year: 2000, country: "US", website: "https://www.capitasnowboarding.com", description: "Independent snowboard brand out of Seattle, WA. Home of the World's Smartest Snowboard Factory (WS²F) in Austria. Known for technical freestyle shapes and sustainable manufacturing." },
  { id: "o3",  name: "Lib Tech",                 org_type: "brand", brand_category: "board_brand",  wikidata_qid: "Q6545648", founded_year: 1977, country: "US",                              description: "Mervin-manufactured brand pioneering Magne-Traction edges and Banana Technology rocker profiles. Mike Olson's lab in Sequim, WA has been engineering the future of snowboarding for decades." },
  { id: "o4",  name: "Rome SDS",                 org_type: "brand", brand_category: "board_brand",  founded_year: 2001, country: "US",                                                        description: "Rider-owned brand based in Waterbury, VT. SDS stands for Snowboard Design Syndicate — built around a team of riders who shape each season's line." },
  { id: "o8",  name: "Never Summer Industries",  org_type: "brand", brand_category: "board_brand",  founded_year: 1991, country: "US",                                                        description: "Denver-made since 1991. Never Summer manufactures every board in Colorado, keeping quality control entirely in-house. Known for rockered camber hybrid profiles." },
  { id: "o9",  name: "Gnu Snowboards",           org_type: "brand", brand_category: "board_brand",  founded_year: 1987, country: "US",                                                        description: "Sister brand to Lib Tech under the Mervin umbrella. Known for eccentric shapes and eco-responsible manufacturing out of the Pacific Northwest." },
  { id: "o10", name: "Salomon Snowboards",        org_type: "brand", brand_category: "board_brand",  founded_year: 1979, country: "FR",                                                        description: "French alpine heritage brand with a deep snowboard pedigree. The Salomon team has long been a staple of progressive freeride and park riding." },
  { id: "o11", name: "Jones Snowboards",          org_type: "brand", brand_category: "board_brand",  founded_year: 2009, country: "US",                                                        description: "Founded by pro snowboarder Jeremy Jones, the brand is focused on high-performance backcountry boards and sustainability. HQ in Truckee, CA." },
  { id: "o12", name: "Arbor Snowboards",          org_type: "brand", brand_category: "board_brand",  founded_year: 1995, country: "US",                                                        description: "Venice Beach-born brand focused on sustainable materials and timeless graphics. Known for using reclaimed wood and FSC-certified topsheets." },
  { id: "o13", name: "Sims Snowboards",           org_type: "brand", brand_category: "board_brand",  founded_year: 1977, country: "US",                                                        description: "One of the original snowboard companies, founded by Tom Sims. A cornerstone of snowboarding's early history and the halfpipe movement." },
  { id: "o14", name: "Ride Snowboards",           org_type: "brand", brand_category: "board_brand",  founded_year: 1992, country: "US" },
  { id: "o15", name: "K2 Snowboarding",           org_type: "brand", brand_category: "board_brand",  founded_year: 1987, country: "US" },
  { id: "o16", name: "Bataleon Snowboards",       org_type: "brand", brand_category: "board_brand",  founded_year: 2005, country: "NL",                                                        description: "Amsterdam-based brand known for inventing Triple Base Technology (TBT) — a 3D board base that eliminates edge catch and transforms how boards ride." },
  { id: "o17", name: "YES. Snowboards",           org_type: "brand", brand_category: "board_brand",  founded_year: 2009, country: "CH" },
  // Outerwear & apparel
  { id: "o25", name: "Westbeach",                 org_type: "brand", brand_category: "outerwear",    founded_year: 1982, country: "CA", website: "https://www.westbeach.com",               description: "Vancouver-born outerwear brand with deep roots in BC snowboarding culture. One of Canada's original snow brands, known for functional and stylish gear since the early '80s." },
  { id: "o18", name: "Volcom",                    org_type: "brand", brand_category: "outerwear",    founded_year: 1991, country: "US",                                                        description: "Stone Snowboarding roots run deep. Costa Mesa-founded brand that blends skate, surf, and snow culture with a distinctly irreverent edge." },
  { id: "o19", name: "Oakley",                    org_type: "brand", brand_category: "outerwear",    founded_year: 1975, country: "US" },
  { id: "o20", name: "Quiksilver / Roxy",         org_type: "brand", brand_category: "outerwear",    founded_year: 1969, country: "AU" },
  { id: "o21", name: "Airblaster",                org_type: "brand", brand_category: "outerwear",    founded_year: 2003, country: "US",                                                        description: "Portland-based outerwear brand founded by pro snowboarder Jesse Grandkoski. Known for the Human Suit base layer and a no-nonsense approach to functional snow gear." },
  // Media
  { id: "o5",  name: "Snowboard Canada",          org_type: "magazine", brand_category: "media",     founded_year: 1989, country: "CA",                                                        description: "The definitive Canadian snowboard magazine. Documenting BC and Canadian riding culture since 1989." },
  { id: "o22", name: "Transworld Snowboarding",   org_type: "magazine", brand_category: "media",     founded_year: 1987, country: "US" },
  { id: "o23", name: "Snowboarder Magazine",      org_type: "magazine", brand_category: "media",     founded_year: 1988, country: "US" },
  // Board brands (continued)
  { id: "o26", name: "Winterstick",              org_type: "brand", brand_category: "board_brand",  founded_year: 1972, country: "US",                                                        description: "Considered the first mass-produced snowboard. Founder Dimitrije Milovich shaped surf-inspired boards in Utah starting in 1972, predating the modern snowboard industry." },
  { id: "o27", name: "Nidecker",                 org_type: "brand", brand_category: "board_brand",  founded_year: 1985, country: "CH",                                                        description: "Swiss family brand with roots in ski manufacturing since 1887. One of Europe's pioneering snowboard companies, now also parent to Jones, Now, and Laax brands." },
  { id: "o28", name: "Nitro Snowboards",         org_type: "brand", brand_category: "board_brand",  founded_year: 1990, country: "DE",                                                        description: "Berlin-born brand built by snowboarders for snowboarders. Known for high-quality construction, the Team series, and long-running pro model collaborations." },
  { id: "o29", name: "Rossignol Snowboards",     org_type: "brand", brand_category: "board_brand",  founded_year: 1907, country: "FR",                                                        description: "French alpine heritage brand that entered snowboarding in the late 1980s. The Experience and One LF series defined a generation of all-mountain riding." },
  { id: "o30", name: "Palmer Snowboards",        org_type: "brand", brand_category: "board_brand",  founded_year: 1985, country: "US",                                                        description: "Founded by Shaun Palmer in the early days of pro snowboarding. The brand embodied the rebellious spirit of 80s and 90s snowboard culture." },
  { id: "o31", name: "Kemper Snowboards",        org_type: "brand", brand_category: "board_brand",  founded_year: 1987, country: "US",                                                        description: "An 80s and 90s snowboard icon, recently revived. The Screamer and Rampage models defined early freestyle riding and are now collector's items." },
  { id: "o32", name: "Morrow Snowboards",        org_type: "brand", brand_category: "board_brand",  founded_year: 1990, country: "US",                                                        description: "Salem, Oregon brand that was part of the 90s snowboard boom. Home to early team riders and known for accessible entry-level to pro-level shapes." },
  { id: "o33", name: "Forum Snowboards",         org_type: "brand", brand_category: "board_brand",  founded_year: 1994, country: "US",                                                        description: "The brand that defined progressive early-2000s snowboarding. Forum's team — including Devun Walsh, Nicolas Müller, and JP Solberg — redefined the sport's aesthetic." },
  { id: "o34", name: "Signal Snowboards",        org_type: "brand", brand_category: "board_brand",  founded_year: 2003, country: "US",                                                        description: "Oceanside, CA brand known for handcrafted boards and the Every Third Thursday YouTube series — one of snowboarding's best-loved behind-the-scenes shows." },
  { id: "o35", name: "Slash Snowboards",         org_type: "brand", brand_category: "board_brand",  founded_year: 2008, country: "AT",                                                        description: "Founded by Terje Håkonsen, the most influential snowboarder of all time. Slash is built around technical freeride and backcountry performance out of Austria." },
  { id: "o36", name: "Korua Shapes",             org_type: "brand", brand_category: "board_brand",  founded_year: 2013, country: "CH",                                                        description: "Swiss brand founded by Nicolas Müller and Timeu Fankhauser. Korua makes directional shapes built for drawn-out turns and smooth mountain riding." },
  { id: "o37", name: "Gentemstick",              org_type: "brand", brand_category: "board_brand",  founded_year: 1990, country: "JP",                                                        description: "Hokkaido-born brand by Taro Tamai. Gentemstick boards are hand-shaped for Japanese powder and have developed a global cult following among soul riders." },
  { id: "o38", name: "Option Snowboards",        org_type: "brand", brand_category: "board_brand",  founded_year: 1989, country: "US",                                                        description: "1990s powerhouse brand with a team that included some of the era's top riders. Option was a staple of the magazine ads and video parts that defined the decade." },
  { id: "o39", name: "Prior Snowboards",         org_type: "brand", brand_category: "board_brand",  founded_year: 1988, country: "CA",                                                        description: "Whistler-based brand building hand-crafted boards in BC since 1988. Known for freeride and powder shapes tailored to Coast Mountain terrain." },
  { id: "o40", name: "Endeavor Snowboards",      org_type: "brand", brand_category: "board_brand",  founded_year: 1994, country: "US",                                                        description: "Rider-driven brand from the Pacific Northwest. Endeavor's team includes backcountry and park-focused athletes building boards with an independent ethos." },
  { id: "o41", name: "Hooger Booger",            org_type: "brand", brand_category: "board_brand",  founded_year: 1991, country: "US",                                                        description: "Short-lived but influential 90s brand associated with Morrow's founders. The name and irreverent graphics captured the spirit of early snowboard culture." },
  { id: "o42", name: "Mervin Manufacturing",     org_type: "brand", brand_category: "board_brand",  founded_year: 1987, country: "US",                                                        description: "The factory and parent company behind Lib Tech and GNU. Mike Olson's Sequim, WA facility pioneered Magne-Traction, Banana Tech, and eco-resin manufacturing." },
  // Bindings
  { id: "o43", name: "Union Binding Co",         org_type: "brand", brand_category: "bindings",     founded_year: 2004, country: "NL",                                                        description: "Amsterdam-designed, Italy-manufactured bindings known for minimalist construction and consistent feel. One of the most respected binding brands in the game." },
  { id: "o44", name: "Now Bindings",             org_type: "brand", brand_category: "bindings",     founded_year: 2013, country: "NL",                                                        description: "Sister brand to Nidecker, Now Bindings introduced the IPO (In-Pivot-O) baseplate — a torsionally flexible design that changed how stiff bindings could feel." },
  { id: "o45", name: "Bent Metal Binding Works", org_type: "brand", brand_category: "bindings",     founded_year: 2012, country: "US",                                                        description: "Breckenridge-based binding brand by pro snowboarders for snowboarders. Known for the Logic and Transfer models and a rider-first development approach." },
  { id: "o46", name: "Drake Bindings",           org_type: "brand", brand_category: "bindings",     founded_year: 1988, country: "IT",                                                        description: "One of the oldest binding brands in snowboarding, based in Italy. Drake's long heritage in the sport spans from freestyle to freeride." },
  { id: "o47", name: "Flow Snowboarding",        org_type: "brand", brand_category: "bindings",     founded_year: 1996, country: "NL",                                                        description: "Invented the rear-entry step-in binding system. Flow's Fusion and NX2 models made it fast to strap in without sacrificing performance." },
  { id: "o48", name: "Flux Bindings",            org_type: "brand", brand_category: "bindings",     founded_year: 1994, country: "JP",                                                        description: "Japanese binding brand with a loyal following in Asia and growing global presence. Known for clean construction and park-focused performance." },
  // Boots
  { id: "o49", name: "ThirtyTwo",                org_type: "brand", brand_category: "boots",        founded_year: 1991, country: "US",                                                        description: "Huntington Beach brand making snowboard boots and apparel since 1991. Known for heat-moldable liners and team riders like Scotty Vine and Dustbox crew." },
  { id: "o50", name: "Deeluxe",                  org_type: "brand", brand_category: "boots",        founded_year: 1981, country: "AT",                                                        description: "Austrian boot brand with deep alpine ski-boot heritage. Deeluxe's Thermo Inner system and precision fit have made them a go-to for aggressive hard-boot and carving riders." },
  { id: "o51", name: "Northwave",                org_type: "brand", brand_category: "boots",        founded_year: 1991, country: "IT",                                                        description: "Italian boot manufacturer with a strong European following. Northwave's Freedom and Decade series are known for comfort and progressive fit technology." },
  { id: "o52", name: "Vans Snowboarding",        org_type: "brand", brand_category: "boots",        founded_year: 1966, country: "US",                                                        description: "The iconic skateboarding brand extended into snowboard boots in the 1990s. Vans boots retain a familiar skate aesthetic and are known for a softer, natural flex." },
  { id: "o53", name: "DC Shoes",                 org_type: "brand", brand_category: "boots",        founded_year: 1994, country: "US",                                                        description: "Founded by Ken Block and Damon Way, DC became a dominant force in snowboard boots and apparel. Travis Rice's long DC partnership put the brand at the forefront of big-mountain riding." },
  // Outerwear (additional)
  { id: "o54", name: "686",                      org_type: "brand", brand_category: "outerwear",    founded_year: 1992, country: "US",                                                        description: "LA-based technical outerwear brand known for SMARTY convertible systems and goggle-compatible hoods. A staple of the park and urban scene for over three decades." },
  { id: "o55", name: "Holden Outerwear",         org_type: "brand", brand_category: "outerwear",    founded_year: 2002, country: "US",                                                        description: "Portland brand co-founded by Mikey LeBlanc. Holden defined the aesthetic crossover between streetwear and snowboard outerwear in the mid-2000s." },
  { id: "o56", name: "Bonfire Snowboarding",     org_type: "brand", brand_category: "outerwear",    founded_year: 1989, country: "US",                                                        description: "Seattle outerwear brand that was one of the first dedicated snowboard apparel companies. Bonfire's team and video parts were fixtures of 1990s snowboard culture." },
  { id: "o57", name: "Sessions",                 org_type: "brand", brand_category: "outerwear",    founded_year: 1983, country: "US",                                                        description: "San Diego brand founded by Todd Richards and friends. Sessions blended skate culture with snowboard apparel and produced some of the decade's best team videos." },
  { id: "o58", name: "Picture Organic Clothing", org_type: "brand", brand_category: "outerwear",    founded_year: 2008, country: "FR",                                                        description: "Annecy-based brand pioneering eco-responsible outerwear. Picture uses recycled materials and sustainable supply chains without compromising technical performance." },
  { id: "o59", name: "Analog",                   org_type: "brand", brand_category: "outerwear",    founded_year: 1997, country: "US",                                                        description: "Burton's streetwear and snow apparel brand. Analog was the cultural arm of the Burton empire, backing video projects and a team heavy with creative talent." },
  { id: "o60", name: "Barfoot",                  org_type: "brand", brand_category: "board_brand",   founded_year: 1981, country: "US", website: "https://barfoot.com",                                description: "Founded by Chuck Barfoot in Santa Barbara, CA after leaving Sims in 1981. Barfoot pioneered the twin-tip design — the industry's first conventional twin-tip boards were built under the Barfoot name in Canada by Ken and Dave Achenbach in 1985–87. Known for the Freestyle, Freakstyle, Mark Partain, and Jon Boyer pro models. Produced boards 1981–2003, then relaunched 2013." },
  // Teams & collectives
  { id: "o6",  name: "Whistler Freeski/Snowboard Club", org_type: "team", country: "CA" },
  { id: "o7",  name: "Local Shred Collective",    org_type: "team",  region: "Vancouver" },
  { id: "o24", name: "North Shore Shred Club",    org_type: "team",  country: "CA" },
]

// ─── Boards ──────────────────────────────────────────────────────────────────

export const BOARDS: Board[] = [
  // Burton
  { id: "b1",  brand: "Burton", model: "Custom",        model_year: 2003, shape: "directional-twin" },
  { id: "b2",  brand: "Burton", model: "Fish",           model_year: 2005, shape: "powder" },
  { id: "b10", brand: "Burton", model: "Custom",        model_year: 2008, shape: "directional-twin" },
  { id: "b11", brand: "Burton", model: "Process",       model_year: 2010, shape: "twin" },
  { id: "b12", brand: "Burton", model: "Flight Attendant", model_year: 2014, shape: "directional" },
  // Capita
  { id: "b3",  brand: "Capita", model: "DOA",           model_year: 2012, shape: "twin" },
  { id: "b4",  brand: "Capita", model: "Mercury",       model_year: 2015, shape: "directional-twin" },
  { id: "b13", brand: "Capita", model: "Ultrafear",     model_year: 2018, shape: "twin" },
  { id: "b14", brand: "Capita", model: "DOA",           model_year: 2017, shape: "twin" },
  // Lib Tech
  { id: "b5",  brand: "Lib Tech", model: "Skate Banana",model_year: 2007, shape: "twin" },
  { id: "b15", brand: "Lib Tech", model: "TRS",         model_year: 2011, shape: "twin" },
  { id: "b16", brand: "Lib Tech", model: "Orca",        model_year: 2016, shape: "powder" },
  // Rome
  { id: "b6",  brand: "Rome",  model: "Ravine",         model_year: 2009, shape: "directional" },
  { id: "b17", brand: "Rome",  model: "Mod Rocker",     model_year: 2013, shape: "twin" },
  // Salomon
  { id: "b7",  brand: "Salomon", model: "Assassin",     model_year: 2018, shape: "directional-twin" },
  { id: "b18", brand: "Salomon", model: "Huck Knife",   model_year: 2016, shape: "twin" },
  // Jones
  { id: "b19", brand: "Jones", model: "Explorer",       model_year: 2015, shape: "directional" },
  { id: "b20", brand: "Jones", model: "Flagship",       model_year: 2018, shape: "directional" },
  // Gnu
  { id: "b21", brand: "Gnu",   model: "Carbon Credit",  model_year: 2009, shape: "twin" },
  { id: "b22", brand: "Gnu",   model: "Space Case",     model_year: 2014, shape: "twin" },
  // Never Summer
  { id: "b23", brand: "Never Summer", model: "Proto Type Two", model_year: 2013, shape: "directional-twin" },
  // Sims
  { id: "b24", brand: "Sims",  model: "Switchblade",    model_year: 1996, shape: "twin" },
  { id: "b25", brand: "Sims",  model: "Halfpipe",       model_year: 1998, shape: "twin" },
  // K2
  { id: "b26", brand: "K2",    model: "Raygun",         model_year: 2004, shape: "twin" },
  { id: "b27", brand: "K2",    model: "Party Platter",  model_year: 2011, shape: "powder" },
  // Ride
  { id: "b28", brand: "Ride",  model: "Berzerker",      model_year: 2007, shape: "directional-twin" },
  // Barfoot — one entry per year of production
  // Early era: 1981–1985 (directional, pre-twin-tip)
  { id: "bf1981", brand: "Barfoot", model: "Freestyle",           model_year: 1981, shape: "directional" },
  { id: "bf1982", brand: "Barfoot", model: "Freestyle",           model_year: 1982, shape: "directional" },
  { id: "bf1983", brand: "Barfoot", model: "Freestyle",           model_year: 1983, shape: "directional" },
  { id: "bf1984", brand: "Barfoot", model: "Freestyle",           model_year: 1984, shape: "directional" },
  { id: "bf1985", brand: "Barfoot", model: "Twin Tip",            model_year: 1985, shape: "twin" },
  // 1986–1990: Freakstyle era + twin-tip expansion
  { id: "bf1986", brand: "Barfoot", model: "Freakstyle",          model_year: 1986, shape: "twin" },
  { id: "bf1987", brand: "Barfoot", model: "Twin Tip",            model_year: 1987, shape: "twin" },
  { id: "bf1988", brand: "Barfoot", model: "Freestyle",           model_year: 1988, shape: "twin" },
  { id: "bf1989", brand: "Barfoot", model: "Twin Tip Freestyle",  model_year: 1989, shape: "twin" },
  { id: "bf1990", brand: "Barfoot", model: "Twin Tip Freestyle",  model_year: 1990, shape: "twin" },
  // 1991–1995: Pro model era
  { id: "bf1991", brand: "Barfoot", model: "Freestyle",           model_year: 1991, shape: "twin" },
  { id: "bf1992", brand: "Barfoot", model: "Freestyle",           model_year: 1992, shape: "twin" },
  { id: "bf1993", brand: "Barfoot", model: "Jon Boyer Pro Model", model_year: 1993, shape: "twin" },
  { id: "bf1994", brand: "Barfoot", model: "Freestyle",           model_year: 1994, shape: "twin" },
  { id: "bf1995", brand: "Barfoot", model: "Mark Partain Pro",    model_year: 1995, shape: "directional-twin" },
  // 1996–2003: Late classic era
  { id: "bf1996", brand: "Barfoot", model: "Freestyle",           model_year: 1996, shape: "twin" },
  { id: "bf1997", brand: "Barfoot", model: "Stealth",             model_year: 1997, shape: "directional-twin" },
  { id: "bf1998", brand: "Barfoot", model: "Freestyle",           model_year: 1998, shape: "twin" },
  { id: "bf1999", brand: "Barfoot", model: "Freestyle",           model_year: 1999, shape: "twin" },
  { id: "bf2000", brand: "Barfoot", model: "All Mountain",        model_year: 2000, shape: "directional-twin" },
  { id: "bf2001", brand: "Barfoot", model: "Freestyle",           model_year: 2001, shape: "twin" },
  { id: "bf2002", brand: "Barfoot", model: "All Mountain",        model_year: 2002, shape: "directional-twin" },
  { id: "bf2003", brand: "Barfoot", model: "Freestyle",           model_year: 2003, shape: "twin" },
  // 2013–present: Relaunch era (hand-built in San Diego)
  { id: "bf2013", brand: "Barfoot", model: "All Mountain",        model_year: 2013, shape: "directional" },
  { id: "bf2014", brand: "Barfoot", model: "Freestyle",           model_year: 2014, shape: "twin" },
  { id: "bf2015", brand: "Barfoot", model: "All Mountain",        model_year: 2015, shape: "directional" },
  { id: "bf2016", brand: "Barfoot", model: "Freakstyle",          model_year: 2016, shape: "twin" },
  { id: "bf2017", brand: "Barfoot", model: "All Mountain",        model_year: 2017, shape: "directional" },
  { id: "bf2018", brand: "Barfoot", model: "Freestyle",           model_year: 2018, shape: "twin" },
  { id: "bf2019", brand: "Barfoot", model: "All Mountain",        model_year: 2019, shape: "directional" },
  { id: "bf2020", brand: "Barfoot", model: "Freestyle",           model_year: 2020, shape: "twin" },
  { id: "bf2021", brand: "Barfoot", model: "All Mountain",        model_year: 2021, shape: "directional" },
  { id: "bf2022", brand: "Barfoot", model: "Freestyle",           model_year: 2022, shape: "twin" },
  { id: "bf2023", brand: "Barfoot", model: "All Mountain",        model_year: 2023, shape: "directional" },
  { id: "bf2024", brand: "Barfoot", model: "Freestyle",           model_year: 2024, shape: "twin" },
]

// ─── People ──────────────────────────────────────────────────────────────────

export const PEOPLE: Person[] = [
  {
    id: "u1",
    display_name: "Jay Balmer",
    birth_year: 1985,
    riding_since: 1999,
    privacy_level: "public",
    bio: "Been riding since '99. Whistler local. Former shop rat at The Snowboard Shop.",
    home_resort_id: "p1",
    is_current_user: true,
  },
  {
    id: "u2",
    display_name: "Kira Matsuda",
    birth_year: 1987,
    riding_since: 2001,
    privacy_level: "public",
    bio: "North Shore raised, Baker obsessed. Banked slalom is life.",
    home_resort_id: "p2",
  },
  {
    id: "u3",
    display_name: "Theo Bellamy",
    birth_year: 1983,
    riding_since: 1998,
    privacy_level: "public",
    bio: "Whistler local since '98. Spent years chasing powder from Revelstoke to Baker.",
    home_resort_id: "p1",
  },
  {
    id: "u4",
    display_name: "Priya Nair",
    birth_year: 1990,
    riding_since: 2006,
    privacy_level: "public",
    bio: "Revelstoke convert. Film, freeride, repeat.",
    home_resort_id: "p4",
  },
  {
    id: "u5",
    display_name: "Soren Wiig",
    birth_year: 1982,
    riding_since: 1997,
    privacy_level: "shared",
    bio: "Old guard. Sun Peaks home base but everywhere else too.",
    home_resort_id: "p3",
  },
  {
    id: "u6",
    display_name: "Mara Fonoti",
    birth_year: 1992,
    riding_since: 2007,
    privacy_level: "public",
    bio: "Baker local turned Whistler regular. Contest kid, now just shreds.",
    home_resort_id: "p26",
  },
  {
    id: "u7",
    display_name: "Dex Holbrook",
    birth_year: 1980,
    riding_since: 1994,
    privacy_level: "public",
    bio: "Rode everything from Sims halfpipes to powder boards. Kootenay-based.",
    home_resort_id: "p23",
  },
  {
    id: "u8",
    display_name: "Jess Cartwright",
    birth_year: 1988,
    riding_since: 2003,
    privacy_level: "public",
    bio: "Snowboard Canada contributor. Spent formative years in Fernie and Whistler.",
    home_resort_id: "p22",
  },
]

// ─── Sources ─────────────────────────────────────────────────────────────────

const SOURCES: Source[] = [
  { id: "s1", source_type: "magazine",    citation: "Snowboard Canada Issue #42, Winter 2004",           url: "https://snowboardcanada.com/digital-archive/" },
  { id: "s2", source_type: "website",     citation: "Whistler Blackcomb event results archive",           url: "https://www.whistlerblackcomb.com" },
  { id: "s3", source_type: "user-upload", citation: "Personal photo — Kira Matsuda (2006)" },
  { id: "s4", source_type: "magazine",    citation: "Transworld Snowboarding, Feb 2009" },
  { id: "s5", source_type: "website",     citation: "Mt. Baker Ski Area event archive",                  url: "https://www.mtbaker.us" },
]

// ─── Claims ──────────────────────────────────────────────────────────────────

export const CLAIMS: Claim[] = [
  // ── Jay Balmer (u1) ────────────────────────────────────────────────────────
  { id: "c1",  subject_id: "u1", subject_type: "person", predicate: "rode_at",      object_id: "p2",  object_type: "place", start_date: "1999-01-01", end_date: "2002-12-31", confidence: "self-reported", visibility: "public", asserted_by: "u1", created_at: "2026-03-01" },
  { id: "c2",  subject_id: "u1", subject_type: "person", predicate: "rode_at",      object_id: "p1",  object_type: "place", start_date: "2003-01-01",                          confidence: "self-reported", visibility: "public", asserted_by: "u1", created_at: "2026-03-01" },
  { id: "c3",  subject_id: "u1", subject_type: "person", predicate: "worked_at",    object_id: "p7",  object_type: "place", start_date: "2004-09-01", end_date: "2007-04-30",  confidence: "self-reported", visibility: "public", asserted_by: "u1", created_at: "2026-03-01" },
  { id: "c4",  subject_id: "u1", subject_type: "person", predicate: "sponsored_by", object_id: "o2",  object_type: "org",   start_date: "2008-01-01", end_date: "2011-12-31",  confidence: "documented",    visibility: "public", asserted_by: "u1", created_at: "2026-03-01", sources: [SOURCES[0]] },
  { id: "c5",  subject_id: "u1", subject_type: "person", predicate: "owned_board",  object_id: "b1",  object_type: "board", start_date: "2003-01-01", end_date: "2004-12-31",  confidence: "self-reported", visibility: "public", asserted_by: "u1", created_at: "2026-03-01" },
  { id: "c6",  subject_id: "u1", subject_type: "person", predicate: "owned_board",  object_id: "b3",  object_type: "board", start_date: "2012-01-01", end_date: "2014-12-31",  confidence: "self-reported", visibility: "public", asserted_by: "u1", created_at: "2026-03-01" },
  { id: "c7",  subject_id: "u1", subject_type: "person", predicate: "competed_at",  object_id: "e1",  object_type: "event", start_date: "2004-02-15",                          confidence: "documented",    visibility: "public", asserted_by: "u1", created_at: "2026-03-01", sources: [SOURCES[0]] },
  { id: "c8",  subject_id: "u1", subject_type: "person", predicate: "rode_with",    object_id: "u2",  object_type: "person",start_date: "2003-01-01", end_date: "2010-12-31",  confidence: "corroborated",  visibility: "public", asserted_by: "u1", created_at: "2026-03-01", sources: [SOURCES[2]] },
  { id: "c9",  subject_id: "u1", subject_type: "person", predicate: "rode_with",    object_id: "u3",  object_type: "person",start_date: "2005-01-01",                          confidence: "self-reported", visibility: "public", asserted_by: "u1", created_at: "2026-03-01" },
  { id: "c10", subject_id: "u1", subject_type: "person", predicate: "part_of_team", object_id: "o7",  object_type: "org",   start_date: "2006-01-01", end_date: "2012-12-31",  confidence: "self-reported", visibility: "public", asserted_by: "u1", created_at: "2026-03-01" },
  { id: "c60", subject_id: "u1", subject_type: "person", predicate: "competed_at",  object_id: "e13", object_type: "event", start_date: "2005-02-13",                          confidence: "self-reported", visibility: "public", asserted_by: "u1", created_at: "2026-03-01" },
  { id: "c61", subject_id: "u1", subject_type: "person", predicate: "rode_at",      object_id: "p26", object_type: "place", start_date: "2005-01-01", end_date: "2009-12-31",  confidence: "self-reported", visibility: "public", asserted_by: "u1", created_at: "2026-03-01" },

  // ── Kira Matsuda (u2) ─────────────────────────────────────────────────────
  { id: "c11", subject_id: "u2", subject_type: "person", predicate: "rode_at",      object_id: "p2",  object_type: "place", start_date: "2001-01-01", end_date: "2008-12-31",  confidence: "self-reported", visibility: "public", asserted_by: "u2", created_at: "2026-03-01" },
  { id: "c12", subject_id: "u2", subject_type: "person", predicate: "rode_at",      object_id: "p1",  object_type: "place", start_date: "2006-01-01",                          confidence: "self-reported", visibility: "public", asserted_by: "u2", created_at: "2026-03-01" },
  { id: "c13", subject_id: "u2", subject_type: "person", predicate: "competed_at",  object_id: "e1",  object_type: "event", start_date: "2004-02-15",                          confidence: "documented",    visibility: "public", asserted_by: "u2", created_at: "2026-03-01" },
  { id: "c14", subject_id: "u2", subject_type: "person", predicate: "owned_board",  object_id: "b5",  object_type: "board", start_date: "2007-01-01", end_date: "2011-12-31",  confidence: "self-reported", visibility: "public", asserted_by: "u2", created_at: "2026-03-01" },
  { id: "c62", subject_id: "u2", subject_type: "person", predicate: "rode_at",      object_id: "p26", object_type: "place", start_date: "2003-01-01",                          confidence: "self-reported", visibility: "public", asserted_by: "u2", created_at: "2026-03-01" },
  { id: "c63", subject_id: "u2", subject_type: "person", predicate: "competed_at",  object_id: "e10", object_type: "event", start_date: "1995-02-12",                          confidence: "self-reported", visibility: "public", asserted_by: "u2", created_at: "2026-03-01" },
  { id: "c64", subject_id: "u2", subject_type: "person", predicate: "competed_at",  object_id: "e13", object_type: "event", start_date: "2005-02-13",                          confidence: "documented",    visibility: "public", asserted_by: "u2", created_at: "2026-03-01", sources: [SOURCES[4]] },
  { id: "c65", subject_id: "u2", subject_type: "person", predicate: "owned_board",  object_id: "b28", object_type: "board", start_date: "2004-01-01", end_date: "2006-12-31",  confidence: "self-reported", visibility: "public", asserted_by: "u2", created_at: "2026-03-01" },
  { id: "c66", subject_id: "u2", subject_type: "person", predicate: "worked_at",    object_id: "p8",  object_type: "place", start_date: "2005-09-01", end_date: "2008-04-30",  confidence: "self-reported", visibility: "public", asserted_by: "u2", created_at: "2026-03-01" },

  // ── Theo Bellamy (u3) ─────────────────────────────────────────────────────
  { id: "c15", subject_id: "u3", subject_type: "person", predicate: "rode_at",      object_id: "p1",  object_type: "place", start_date: "1998-01-01",                          confidence: "self-reported", visibility: "public", asserted_by: "u3", created_at: "2026-03-01" },
  { id: "c16", subject_id: "u3", subject_type: "person", predicate: "sponsored_by", object_id: "o3",  object_type: "org",   start_date: "2007-01-01", end_date: "2015-12-31",  confidence: "documented",    visibility: "public", asserted_by: "u3", created_at: "2026-03-01" },
  { id: "c70", subject_id: "u3", subject_type: "person", predicate: "rode_at",      object_id: "p4",  object_type: "place", start_date: "2009-01-01",                          confidence: "self-reported", visibility: "public", asserted_by: "u3", created_at: "2026-03-01" },
  { id: "c71", subject_id: "u3", subject_type: "person", predicate: "rode_at",      object_id: "p26", object_type: "place", start_date: "2002-01-01", end_date: "2014-12-31",  confidence: "self-reported", visibility: "public", asserted_by: "u3", created_at: "2026-03-01" },
  { id: "c72", subject_id: "u3", subject_type: "person", predicate: "competed_at",  object_id: "e12", object_type: "event", start_date: "2002-02-17",                          confidence: "documented",    visibility: "public", asserted_by: "u3", created_at: "2026-03-01" },
  { id: "c73", subject_id: "u3", subject_type: "person", predicate: "competed_at",  object_id: "e13", object_type: "event", start_date: "2005-02-13",                          confidence: "documented",    visibility: "public", asserted_by: "u3", created_at: "2026-03-01", sources: [SOURCES[4]] },
  { id: "c74", subject_id: "u3", subject_type: "person", predicate: "competed_at",  object_id: "e14", object_type: "event", start_date: "2009-02-15",                          confidence: "documented",    visibility: "public", asserted_by: "u3", created_at: "2026-03-01" },
  { id: "c75", subject_id: "u3", subject_type: "person", predicate: "owned_board",  object_id: "b15", object_type: "board", start_date: "2011-01-01", end_date: "2016-12-31",  confidence: "self-reported", visibility: "public", asserted_by: "u3", created_at: "2026-03-01" },
  { id: "c76", subject_id: "u3", subject_type: "person", predicate: "part_of_team", object_id: "o6",  object_type: "org",   start_date: "2004-01-01", end_date: "2010-12-31",  confidence: "self-reported", visibility: "public", asserted_by: "u3", created_at: "2026-03-01" },

  // ── Priya Nair (u4) ───────────────────────────────────────────────────────
  { id: "c80", subject_id: "u4", subject_type: "person", predicate: "rode_at",      object_id: "p4",  object_type: "place", start_date: "2006-01-01",                          confidence: "self-reported", visibility: "public", asserted_by: "u4", created_at: "2026-03-01" },
  { id: "c81", subject_id: "u4", subject_type: "person", predicate: "rode_at",      object_id: "p1",  object_type: "place", start_date: "2010-01-01", end_date: "2014-12-31",  confidence: "self-reported", visibility: "public", asserted_by: "u4", created_at: "2026-03-01" },
  { id: "c82", subject_id: "u4", subject_type: "person", predicate: "competed_at",  object_id: "e4",  object_type: "event", start_date: "2010-02-01",                          confidence: "documented",    visibility: "public", asserted_by: "u4", created_at: "2026-03-01" },
  { id: "c83", subject_id: "u4", subject_type: "person", predicate: "competed_at",  object_id: "e50", object_type: "event", start_date: "2013-01-28",                          confidence: "documented",    visibility: "public", asserted_by: "u4", created_at: "2026-03-01" },
  { id: "c84", subject_id: "u4", subject_type: "person", predicate: "sponsored_by", object_id: "o11", object_type: "org",   start_date: "2014-01-01",                          confidence: "documented",    visibility: "public", asserted_by: "u4", created_at: "2026-03-01" },
  { id: "c85", subject_id: "u4", subject_type: "person", predicate: "owned_board",  object_id: "b19", object_type: "board", start_date: "2015-01-01",                          confidence: "self-reported", visibility: "public", asserted_by: "u4", created_at: "2026-03-01" },
  { id: "c86", subject_id: "u4", subject_type: "person", predicate: "owned_board",  object_id: "b4",  object_type: "board", start_date: "2016-01-01",                          confidence: "self-reported", visibility: "public", asserted_by: "u4", created_at: "2026-03-01" },

  // ── Soren Wiig (u5) ───────────────────────────────────────────────────────
  { id: "c90", subject_id: "u5", subject_type: "person", predicate: "rode_at",      object_id: "p3",  object_type: "place", start_date: "1997-01-01",                          confidence: "self-reported", visibility: "shared", asserted_by: "u5", created_at: "2026-03-01" },
  { id: "c91", subject_id: "u5", subject_type: "person", predicate: "rode_at",      object_id: "p1",  object_type: "place", start_date: "2000-01-01", end_date: "2010-12-31",  confidence: "self-reported", visibility: "shared", asserted_by: "u5", created_at: "2026-03-01" },
  { id: "c92", subject_id: "u5", subject_type: "person", predicate: "rode_at",      object_id: "p26", object_type: "place", start_date: "2004-01-01", end_date: "2012-12-31",  confidence: "self-reported", visibility: "shared", asserted_by: "u5", created_at: "2026-03-01" },
  { id: "c93", subject_id: "u5", subject_type: "person", predicate: "competed_at",  object_id: "e11", object_type: "event", start_date: "1998-02-08",                          confidence: "self-reported", visibility: "shared", asserted_by: "u5", created_at: "2026-03-01" },
  { id: "c94", subject_id: "u5", subject_type: "person", predicate: "competed_at",  object_id: "e13", object_type: "event", start_date: "2005-02-13",                          confidence: "documented",    visibility: "shared", asserted_by: "u5", created_at: "2026-03-01", sources: [SOURCES[4]] },
  { id: "c95", subject_id: "u5", subject_type: "person", predicate: "owned_board",  object_id: "b24", object_type: "board", start_date: "1997-01-01", end_date: "2001-12-31",  confidence: "self-reported", visibility: "shared", asserted_by: "u5", created_at: "2026-03-01" },
  { id: "c96", subject_id: "u5", subject_type: "person", predicate: "owned_board",  object_id: "b21", object_type: "board", start_date: "2009-01-01", end_date: "2013-12-31",  confidence: "self-reported", visibility: "shared", asserted_by: "u5", created_at: "2026-03-01" },

  // ── Mara Fonoti (u6) ──────────────────────────────────────────────────────
  { id: "c100", subject_id: "u6", subject_type: "person", predicate: "rode_at",      object_id: "p26", object_type: "place", start_date: "2007-01-01",                          confidence: "self-reported", visibility: "public", asserted_by: "u6", created_at: "2026-03-01" },
  { id: "c101", subject_id: "u6", subject_type: "person", predicate: "rode_at",      object_id: "p1",  object_type: "place", start_date: "2012-01-01",                          confidence: "self-reported", visibility: "public", asserted_by: "u6", created_at: "2026-03-01" },
  { id: "c102", subject_id: "u6", subject_type: "person", predicate: "rode_at",      object_id: "p2",  object_type: "place", start_date: "2007-01-01", end_date: "2013-12-31",  confidence: "self-reported", visibility: "public", asserted_by: "u6", created_at: "2026-03-01" },
  { id: "c103", subject_id: "u6", subject_type: "person", predicate: "competed_at",  object_id: "e14", object_type: "event", start_date: "2009-02-15",                          confidence: "documented",    visibility: "public", asserted_by: "u6", created_at: "2026-03-01" },
  { id: "c104", subject_id: "u6", subject_type: "person", predicate: "competed_at",  object_id: "e13", object_type: "event", start_date: "2005-02-13",                          confidence: "documented",    visibility: "public", asserted_by: "u6", created_at: "2026-03-01", sources: [SOURCES[4]] },
  { id: "c105", subject_id: "u6", subject_type: "person", predicate: "competed_at",  object_id: "e15", object_type: "event", start_date: "2012-02-19",                          confidence: "documented",    visibility: "public", asserted_by: "u6", created_at: "2026-03-01" },
  { id: "c106", subject_id: "u6", subject_type: "person", predicate: "sponsored_by", object_id: "o2",  object_type: "org",   start_date: "2013-01-01",                          confidence: "documented",    visibility: "public", asserted_by: "u6", created_at: "2026-03-01" },
  { id: "c107", subject_id: "u6", subject_type: "person", predicate: "owned_board",  object_id: "b3",  object_type: "board", start_date: "2013-01-01", end_date: "2016-12-31",  confidence: "self-reported", visibility: "public", asserted_by: "u6", created_at: "2026-03-01" },
  { id: "c108", subject_id: "u6", subject_type: "person", predicate: "owned_board",  object_id: "b14", object_type: "board", start_date: "2017-01-01",                          confidence: "self-reported", visibility: "public", asserted_by: "u6", created_at: "2026-03-01" },

  // ── Dex Holbrook (u7) ─────────────────────────────────────────────────────
  { id: "c110", subject_id: "u7", subject_type: "person", predicate: "rode_at",      object_id: "p23", object_type: "place", start_date: "1994-01-01",                          confidence: "self-reported", visibility: "public", asserted_by: "u7", created_at: "2026-03-01" },
  { id: "c111", subject_id: "u7", subject_type: "person", predicate: "rode_at",      object_id: "p4",  object_type: "place", start_date: "2001-01-01",                          confidence: "self-reported", visibility: "public", asserted_by: "u7", created_at: "2026-03-01" },
  { id: "c112", subject_id: "u7", subject_type: "person", predicate: "rode_at",      object_id: "p26", object_type: "place", start_date: "1998-01-01", end_date: "2008-12-31",  confidence: "self-reported", visibility: "public", asserted_by: "u7", created_at: "2026-03-01" },
  { id: "c113", subject_id: "u7", subject_type: "person", predicate: "owned_board",  object_id: "b24", object_type: "board", start_date: "1996-01-01", end_date: "1998-12-31",  confidence: "self-reported", visibility: "public", asserted_by: "u7", created_at: "2026-03-01" },
  { id: "c114", subject_id: "u7", subject_type: "person", predicate: "owned_board",  object_id: "b25", object_type: "board", start_date: "1998-01-01", end_date: "2002-12-31",  confidence: "self-reported", visibility: "public", asserted_by: "u7", created_at: "2026-03-01" },
  { id: "c115", subject_id: "u7", subject_type: "person", predicate: "competed_at",  object_id: "e10", object_type: "event", start_date: "1995-02-12",                          confidence: "self-reported", visibility: "public", asserted_by: "u7", created_at: "2026-03-01" },
  { id: "c116", subject_id: "u7", subject_type: "person", predicate: "competed_at",  object_id: "e11", object_type: "event", start_date: "1998-02-08",                          confidence: "documented",    visibility: "public", asserted_by: "u7", created_at: "2026-03-01" },
  { id: "c117", subject_id: "u7", subject_type: "person", predicate: "competed_at",  object_id: "e12", object_type: "event", start_date: "2002-02-17",                          confidence: "documented",    visibility: "public", asserted_by: "u7", created_at: "2026-03-01" },
  { id: "c118", subject_id: "u7", subject_type: "person", predicate: "part_of_team", object_id: "o7",  object_type: "org",   start_date: "2003-01-01", end_date: "2008-12-31",  confidence: "self-reported", visibility: "public", asserted_by: "u7", created_at: "2026-03-01" },

  // ── Jess Cartwright (u8) ──────────────────────────────────────────────────
  { id: "c120", subject_id: "u8", subject_type: "person", predicate: "rode_at",      object_id: "p22", object_type: "place", start_date: "2003-01-01",                          confidence: "self-reported", visibility: "public", asserted_by: "u8", created_at: "2026-03-01" },
  { id: "c121", subject_id: "u8", subject_type: "person", predicate: "rode_at",      object_id: "p1",  object_type: "place", start_date: "2007-01-01", end_date: "2015-12-31",  confidence: "self-reported", visibility: "public", asserted_by: "u8", created_at: "2026-03-01" },
  { id: "c122", subject_id: "u8", subject_type: "person", predicate: "rode_at",      object_id: "p26", object_type: "place", start_date: "2009-01-01", end_date: "2014-12-31",  confidence: "self-reported", visibility: "public", asserted_by: "u8", created_at: "2026-03-01" },
  { id: "c123", subject_id: "u8", subject_type: "person", predicate: "competed_at",  object_id: "e14", object_type: "event", start_date: "2009-02-15",                          confidence: "documented",    visibility: "public", asserted_by: "u8", created_at: "2026-03-01", sources: [SOURCES[4]] },
  { id: "c124", subject_id: "u8", subject_type: "person", predicate: "competed_at",  object_id: "e15", object_type: "event", start_date: "2012-02-19",                          confidence: "documented",    visibility: "public", asserted_by: "u8", created_at: "2026-03-01" },
  { id: "c125", subject_id: "u8", subject_type: "person", predicate: "worked_at",    object_id: "o5",  object_type: "org",   start_date: "2010-01-01",                          confidence: "self-reported", visibility: "public", asserted_by: "u8", created_at: "2026-03-01" },
  { id: "c126", subject_id: "u8", subject_type: "person", predicate: "sponsored_by", object_id: "o10", object_type: "org",   start_date: "2011-01-01", end_date: "2016-12-31",  confidence: "documented",    visibility: "public", asserted_by: "u8", created_at: "2026-03-01" },
  { id: "c127", subject_id: "u8", subject_type: "person", predicate: "owned_board",  object_id: "b7",  object_type: "board", start_date: "2018-01-01",                          confidence: "self-reported", visibility: "public", asserted_by: "u8", created_at: "2026-03-01" },

  // ── Westbeach org claims ───────────────────────────────────────────────────
  { id: "c_wb1", subject_id: "o25", subject_type: "org", predicate: "organized",   object_id: "ew1", object_type: "event", start_date: "1996-03-08", confidence: "documented",    visibility: "public", asserted_by: "u1", created_at: "2026-03-01" },
  { id: "c_wb2", subject_id: "o25", subject_type: "org", predicate: "organized",   object_id: "ew2", object_type: "event", start_date: "1998-03-05", confidence: "documented",    visibility: "public", asserted_by: "u1", created_at: "2026-03-01" },
  { id: "c_wb3", subject_id: "o25", subject_type: "org", predicate: "organized",   object_id: "ew3", object_type: "event", start_date: "2004-01-15", confidence: "corroborated",  visibility: "public", asserted_by: "u1", created_at: "2026-03-01" },
  { id: "c_wb4", subject_id: "o25", subject_type: "org", predicate: "located_at",  object_id: "pw1", object_type: "place", start_date: "1988-01-01", end_date: "2015-12-31",      confidence: "corroborated",  visibility: "public", asserted_by: "u1", created_at: "2026-03-01", note: "Flagship Vancouver retail location on Robson St." },
  { id: "c_wb5", subject_id: "o25", subject_type: "org", predicate: "located_at",  object_id: "pw2", object_type: "place", start_date: "1995-01-01", end_date: "2008-12-31",      confidence: "self-reported", visibility: "public", asserted_by: "u1", created_at: "2026-03-01", note: "Whistler Village store, open seasonally." },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getClaimsForPerson(personId: string) {
  return CLAIMS.filter((c) => c.subject_id === personId)
}

export function getPersonById(id: string) {
  return PEOPLE.find((p) => p.id === id)
}

export function getPlaceById(id: string) {
  return PLACES.find((p) => p.id === id)
}

export function getOrgById(id: string) {
  return ORGS.find((o) => o.id === id)
}

export function getBoardById(id: string) {
  return BOARDS.find((b) => b.id === id)
}

export function getEventById(id: string) {
  return EVENTS.find((e) => e.id === id)
}

export function getEventSeriesById(id: string) {
  return EVENT_SERIES.find((s) => s.id === id)
}

export function getEntityById(id: string, type: string) {
  switch (type) {
    case "person": return getPersonById(id)
    case "place":  return getPlaceById(id)
    case "org":    return getOrgById(id)
    case "board":  return getBoardById(id)
    case "event":  return getEventById(id)
    default:       return undefined
  }
}

export function getEntityName(id: string, type: string): string {
  const entity = getEntityById(id, type)
  if (!entity) return "Unknown"
  if ("display_name" in entity) return entity.display_name
  if ("name" in entity) return entity.name
  if ("model" in entity) {
    const b = entity as Board
    return `${b.brand} ${b.model} '${String(b.model_year).slice(2)}`
  }
  return "Unknown"
}

export function getSharedContext(personAId: string, personBId: string) {
  const claimsA = getClaimsForPerson(personAId)
  const claimsB = getClaimsForPerson(personBId)

  const sharedPlaces: { place: Place; yearsA: string[]; yearsB: string[] }[] = []
  const sharedEvents: { event: Event }[] = []
  const sharedOrgs: { org: Org }[] = []

  const placesA = claimsA.filter((c) => c.predicate === "rode_at").map((c) => c.object_id)
  const placesB = claimsB.filter((c) => c.predicate === "rode_at").map((c) => c.object_id)

  for (const pid of placesA) {
    if (placesB.includes(pid)) {
      const place = getPlaceById(pid)
      if (place) sharedPlaces.push({ place, yearsA: [], yearsB: [] })
    }
  }

  const eventsA = claimsA.filter((c) => c.predicate === "competed_at").map((c) => c.object_id)
  const eventsB = claimsB.filter((c) => c.predicate === "competed_at").map((c) => c.object_id)

  for (const eid of eventsA) {
    if (eventsB.includes(eid)) {
      const event = getEventById(eid)
      if (event) sharedEvents.push({ event })
    }
  }

  const sponsorsA = claimsA.filter((c) => c.predicate === "sponsored_by").map((c) => c.object_id)
  const sponsorsB = claimsB.filter((c) => c.predicate === "sponsored_by").map((c) => c.object_id)

  for (const oid of sponsorsA) {
    if (sponsorsB.includes(oid)) {
      const org = getOrgById(oid)
      if (org) sharedOrgs.push({ org })
    }
  }

  return { sharedPlaces, sharedEvents, sharedOrgs }
}

// ─── Slug utilities ───────────────────────────────────────────────────────────

function slugify(str: string): string {
  return str.trim().replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "")
}

export function boardSlug(board: Board): string {
  return `${slugify(board.brand)}_${slugify(board.model)}_${board.model_year}`
}

export function placeSlug(place: Place): string {
  return slugify(place.name)
}

export function orgSlug(org: Org): string {
  return slugify(org.name)
}

export function eventSlug(event: Event): string {
  return slugify(event.name)
}

export function seriesSlug(series: EventSeries): string {
  return slugify(series.name)
}

export function getBoardBySlug(slug: string): Board | undefined {
  return BOARDS.find((b) => boardSlug(b) === slug)
}

export function getPlaceBySlug(slug: string): Place | undefined {
  return PLACES.find((p) => placeSlug(p) === slug)
}

export function getOrgBySlug(slug: string): Org | undefined {
  return ORGS.find((o) => orgSlug(o) === slug)
}

export function getEventBySlug(slug: string): Event | undefined {
  return EVENTS.find((e) => eventSlug(e) === slug)
}

export function getSeriesBySlug(slug: string): EventSeries | undefined {
  return EVENT_SERIES.find((s) => seriesSlug(s) === slug)
}

/** Returns the canonical slug-based URL for any entity. Falls back to id-based URL for user-created entities. */
export function getEntityHref(id: string, type: EntityType): string {
  if (type === "place") {
    const place = getPlaceById(id)
    return place ? `/places/${placeSlug(place)}` : `/places/${id}`
  }
  if (type === "board") {
    const board = getBoardById(id)
    return board ? `/boards/${boardSlug(board)}` : `/boards/${id}`
  }
  if (type === "org") {
    const org = getOrgById(id)
    return org ? `/brands/${orgSlug(org)}` : `/brands/${id}`
  }
  if (type === "event") {
    const event = getEventById(id)
    return event ? `/events/${eventSlug(event)}` : `/events/${id}`
  }
  if (type === "person") return `/riders/${id}`
  return "#"
}
