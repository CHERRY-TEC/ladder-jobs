-- ============================================================================
-- Ladder 2.0 — 0003 storage buckets + policies
-- Path convention for PRIVATE files: "<auth.uid()>/<filename>"
--   ladder-resumes      private  — seeker resumes (PDF/DOC/DOCX, ≤ 5 MB)
--   ladder-verification private  — employer KYC docs
--   ladder-avatars      public   — profile photos
--   ladder-logos        public   — company logos
-- Run AFTER 0001 + 0002.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('ladder-resumes', 'ladder-resumes', false, 5242880,
     array['application/pdf','application/msword',
           'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('ladder-verification', 'ladder-verification', false, 10485760, null),
  ('ladder-avatars', 'ladder-avatars', true, 2097152,
     array['image/png','image/jpeg','image/webp']),
  ('ladder-logos', 'ladder-logos', true, 2097152,
     array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do nothing;

-- ---------------------------------------------------------- resumes --------
-- Upload: own folder only.
drop policy if exists ladder_resumes_insert on storage.objects;
create policy ladder_resumes_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'ladder-resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Read: own folder; admin; employer whose job received this resume.
drop policy if exists ladder_resumes_select on storage.objects;
create policy ladder_resumes_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'ladder-resumes'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.ladder_is_admin()
      or exists (
        select 1 from ladder_resumes r
        join ladder_applications a on a.resume_id = r.id
        where r.file_path = storage.objects.name
          and public.ladder_owns_job(a.job_id)
      )
    )
  );

drop policy if exists ladder_resumes_delete on storage.objects;
create policy ladder_resumes_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'ladder-resumes'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.ladder_is_admin())
  );

-- -------------------------------------------------- verification docs ------
drop policy if exists ladder_verification_insert on storage.objects;
create policy ladder_verification_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'ladder-verification'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists ladder_verification_select on storage.objects;
create policy ladder_verification_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'ladder-verification'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.ladder_is_admin())
  );

drop policy if exists ladder_verification_delete on storage.objects;
create policy ladder_verification_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'ladder-verification'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.ladder_is_admin())
  );

-- -------------------------------------------------------- avatars/logos -----
-- Public buckets: anyone may READ; only the owner may write their folder.
drop policy if exists ladder_avatars_public_read on storage.objects;
create policy ladder_avatars_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'ladder-avatars');

drop policy if exists ladder_avatars_insert on storage.objects;
create policy ladder_avatars_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'ladder-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists ladder_avatars_delete on storage.objects;
create policy ladder_avatars_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'ladder-avatars'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.ladder_is_admin())
  );

drop policy if exists ladder_logos_public_read on storage.objects;
create policy ladder_logos_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'ladder-logos');

drop policy if exists ladder_logos_insert on storage.objects;
create policy ladder_logos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'ladder-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists ladder_logos_delete on storage.objects;
create policy ladder_logos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'ladder-logos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.ladder_is_admin())
  );
