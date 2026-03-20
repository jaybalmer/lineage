-- Add city / region / country to profiles
alter table public.profiles
  add column if not exists city    text check (char_length(city)    <= 100),
  add column if not exists region  text check (char_length(region)  <= 100),
  add column if not exists country text check (char_length(country) <= 100);
