-- Add editor access flag to profiles
alter table profiles
  add column if not exists is_editor boolean not null default false;

-- Founding members get editor access automatically
update profiles
  set is_editor = true
  where membership_tier = 'founding';
