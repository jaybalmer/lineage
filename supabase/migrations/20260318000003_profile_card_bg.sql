-- Add card_bg_url to profiles table for custom card header photo
alter table public.profiles
  add column if not exists card_bg_url text check (char_length(card_bg_url) <= 2048);
