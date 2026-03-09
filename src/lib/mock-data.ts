import type { Person, Place, Org, Board, Event, Claim, Source, EventSeries, EntityType } from "@/types"

// ─── Places ──────────────────────────────────────────────────────────────────

export const PLACES: Place[] = [
  // BC Canada
  { id: "p1",  name: "Whistler Blackcomb",       place_type: "resort", osm_id: "265662",   wikidata_qid: "Q935235",  region: "Sea-to-Sky",          country: "CA", lat: 50.1163, lon: -122.9574, website: "https://www.whistlerblackcomb.com" },
  { id: "p2",  name: "Mt. Seymour",               place_type: "resort", osm_id: "1234567",                            region: "North Shore",         country: "CA", lat: 49.3717, lon: -122.9451 },
  { id: "p3",  name: "Sun Peaks Resort",          place_type: "resort", osm_id: "2345678",                            region: "Thompson-Okanagan",   country: "CA", lat: 50.8827, lon: -119.8805 },
  { id: "p4",  name: "Revelstoke Mountain Resort",place_type: "resort", osm_id: "3456789",                            region: "Kootenays",           country: "CA", lat: 51.0549, lon: -118.1697 },
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
  { id: "p26", name: "Mt. Baker Ski Area",         place_type: "resort",                                              region: "Washington",          country: "US", lat: 48.8586, lon: -121.6726, website: "https://www.mtbaker.us" },
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
]

// ─── Event Series ─────────────────────────────────────────────────────────────

export const EVENT_SERIES: EventSeries[] = [
  { id: "es1", name: "Baker Banked Slalom",     place_id: "p26", frequency: "annual", start_year: 1985, description: "Legendary natural banked slalom at Mt. Baker. One of the oldest and most respected events in snowboarding." },
  { id: "es2", name: "Mt. Seymour Banked Slalom",place_id: "p2", frequency: "annual", start_year: 1995 },
  { id: "es3", name: "Whistler Big Air",         place_id: "p1",  frequency: "annual", start_year: 2000 },
  { id: "es4", name: "Kootenay Powder Trip",     place_id: "p4",  frequency: "irregular", start_year: 2005 },
  { id: "es5", name: "Revelstoke Film Project",  place_id: "p4",  frequency: "irregular", start_year: 2008 },
  { id: "es6", name: "North Shore Sessions",     place_id: "p2",  frequency: "annual", start_year: 2002 },
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
]

// ─── Orgs ─────────────────────────────────────────────────────────────────────

export const ORGS: Org[] = [
  // Boards
  { id: "o1",  name: "Burton Snowboards",        org_type: "brand", brand_category: "board_brand",  wikidata_qid: "Q4988186", founded_year: 1977, country: "US", website: "https://www.burton.com" },
  { id: "o2",  name: "Capita Snowboards",        org_type: "brand", brand_category: "board_brand",  founded_year: 2000, country: "US", website: "https://www.capitasnowboarding.com" },
  { id: "o3",  name: "Lib Tech",                 org_type: "brand", brand_category: "board_brand",  wikidata_qid: "Q6545648", founded_year: 1977, country: "US" },
  { id: "o4",  name: "Rome SDS",                 org_type: "brand", brand_category: "board_brand",  founded_year: 2001, country: "US" },
  { id: "o8",  name: "Never Summer Industries",  org_type: "brand", brand_category: "board_brand",  founded_year: 1991, country: "US" },
  { id: "o9",  name: "Gnu Snowboards",           org_type: "brand", brand_category: "board_brand",  founded_year: 1987, country: "US" },
  { id: "o10", name: "Salomon Snowboards",        org_type: "brand", brand_category: "board_brand",  founded_year: 1979, country: "FR" },
  { id: "o11", name: "Jones Snowboards",          org_type: "brand", brand_category: "board_brand",  founded_year: 2009, country: "US" },
  { id: "o12", name: "Arbor Snowboards",          org_type: "brand", brand_category: "board_brand",  founded_year: 1995, country: "US" },
  { id: "o13", name: "Sims Snowboards",           org_type: "brand", brand_category: "board_brand",  founded_year: 1977, country: "US" },
  { id: "o14", name: "Ride Snowboards",           org_type: "brand", brand_category: "board_brand",  founded_year: 1992, country: "US" },
  { id: "o15", name: "K2 Snowboarding",           org_type: "brand", brand_category: "board_brand",  founded_year: 1987, country: "US" },
  { id: "o16", name: "Bataleon Snowboards",       org_type: "brand", brand_category: "board_brand",  founded_year: 2005, country: "NL" },
  { id: "o17", name: "YES. Snowboards",           org_type: "brand", brand_category: "board_brand",  founded_year: 2009, country: "CH" },
  // Outerwear
  { id: "o18", name: "Volcom",                    org_type: "brand", brand_category: "outerwear",    founded_year: 1991, country: "US" },
  { id: "o19", name: "Oakley",                    org_type: "brand", brand_category: "outerwear",    founded_year: 1975, country: "US" },
  { id: "o20", name: "Quiksilver / Roxy",         org_type: "brand", brand_category: "outerwear",    founded_year: 1969, country: "AU" },
  { id: "o21", name: "Airblaster",                org_type: "brand", brand_category: "outerwear",    founded_year: 2003, country: "US" },
  // Media
  { id: "o5",  name: "Snowboard Canada",          org_type: "magazine", brand_category: "media",     founded_year: 1989, country: "CA" },
  { id: "o22", name: "Transworld Snowboarding",   org_type: "magazine", brand_category: "media",     founded_year: 1987, country: "US" },
  { id: "o23", name: "Snowboarder Magazine",      org_type: "magazine", brand_category: "media",     founded_year: 1988, country: "US" },
  // Teams
  { id: "o6",  name: "Whistler Freeski/Snowboard Club", org_type: "team",   country: "CA" },
  { id: "o7",  name: "Local Shred Collective",    org_type: "team",          region: "Vancouver" } as Org & { region: string },
  { id: "o24", name: "North Shore Shred Club",    org_type: "team",          country: "CA" },
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
    return org ? `/orgs/${orgSlug(org)}` : `/orgs/${id}`
  }
  if (type === "event") {
    const event = getEventById(id)
    return event ? `/events/${eventSlug(event)}` : `/events/${id}`
  }
  if (type === "person") return `/riders/${id}`
  return "#"
}
