-- Linestry snowboard catalog, v0.1
-- Import order: brands, then models. CSVs use ' | ' to separate multiple source URLs.

create table if not exists snowboard_brands (
  brand_id        text primary key,            -- slug, e.g. 'lib-tech'
  brand_name      text not null,
  founded_year    smallint,                    -- null when not documented
  end_year        smallint,
  status          text not null check (status in ('active','defunct','revived','dormant')),
  founder         text,
  country         text,
  hq_city         text,
  parent_company  text,
  confidence      text not null check (confidence in ('verified','likely')),
  notes           text,
  sources         text[]                       -- split the CSV field on ' | '
);

create table if not exists snowboard_models (
  model_id          text primary key,          -- '<brand_id>--<model-slug>'
  brand_id          text not null references snowboard_brands(brand_id),
  brand_name        text not null,             -- denormalised for convenience
  model_name        text not null,
  first_year        smallint,                  -- MODEL year: a 1995/96 board is 1996
  year_basis        text not null check (year_basis in ('introduced','earliest_sourced','unknown')),
  last_year         smallint,                  -- null = still in production, or last year unknown (see year_note)
  year_note         text,
  category          text not null,             -- freestyle | freeride | all-mountain | alpine | powder | splitboard | kids | swallowtail | other | unknown
  pro_rider         text,
  series_or_family  text,
  confidence        text not null check (confidence in ('verified','likely')),
  notes             text,
  sources           text[]
);

create index if not exists snowboard_models_brand_idx on snowboard_models(brand_id);
create index if not exists snowboard_models_year_idx on snowboard_models(first_year);

-- Suggested member-facing table (not populated by this import):
-- create table member_boards (
--   id uuid primary key default gen_random_uuid(),
--   member_id uuid not null,
--   model_id text not null references snowboard_models(model_id),
--   relationship text not null check (relationship in ('rode','owned','own')),
--   year_ridden smallint, size_cm smallint, notes text, created_at timestamptz default now()
-- );
