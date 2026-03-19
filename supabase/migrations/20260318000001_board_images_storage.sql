-- ─── Board Images Storage Bucket ─────────────────────────────────────────────
--
-- Creates a public Supabase Storage bucket for board photos.
-- Images are uploaded either directly (file upload) or via the archive-image
-- API route which fetches a URL server-side and re-hosts it permanently.
--
-- Path convention: boards/{board_id}/{user_id}-{timestamp}.{ext}
-- Public read, authenticated write, own-file delete.

-- Create the bucket (idempotent)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'board-images',
  'board-images',
  true,
  10485760,                          -- 10 MB per file
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- ── RLS policies ──────────────────────────────────────────────────────────────

-- Public read (anyone can view board images)
create policy "Public read board images"
  on storage.objects for select
  using (bucket_id = 'board-images');

-- Authenticated users can upload
create policy "Authenticated users can upload board images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'board-images');

-- Users can replace/update their own uploads
create policy "Users can update their own board image uploads"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'board-images' and owner = auth.uid());

-- Users can delete their own uploads
create policy "Users can delete their own board image uploads"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'board-images' and owner = auth.uid());
