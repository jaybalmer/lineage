-- Add avatar_url to profiles table
-- Images are uploaded to the board-images storage bucket under avatars/ path.
alter table public.profiles
  add column if not exists avatar_url text check (char_length(avatar_url) <= 2048);
