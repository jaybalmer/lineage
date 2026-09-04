-- STEP 1: additive columns on boards (SAFE per the risk gate).
-- Adds homes for the catalog's provenance. Reversible (drop the columns).

alter table boards add column if not exists model_id text;
alter table boards add column if not exists first_year smallint;
alter table boards add column if not exists year_basis text;
alter table boards add column if not exists category text;
alter table boards add column if not exists confidence text;
alter table boards add column if not exists sources text[];

create index if not exists boards_model_id_idx on boards(model_id);
