-- Grant editor access to specific users by display name
-- (in addition to all founding members already granted in 20260319000002)
update profiles
  set is_editor = true
  where display_name in ('Jay Balmer', 'Sean Balmer');
