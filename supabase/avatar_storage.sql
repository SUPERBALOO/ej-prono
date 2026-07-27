-- Bucket public utilisé pour les photos de profil.
-- Si NEXT_PUBLIC_SUPABASE_AVATARS_BUCKET est personnalisé, remplacez
-- toutes les occurrences de 'avatars' dans ce fichier avant exécution.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can upload own avatars"
  on storage.objects;

create policy "Users can upload own avatars"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can update own avatars"
  on storage.objects;

create policy "Users can update own avatars"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and owner_id = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
    and owner_id = auth.uid()::text
  );

drop policy if exists "Users can delete own avatars"
  on storage.objects;

create policy "Users can delete own avatars"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and owner_id = auth.uid()::text
  );
