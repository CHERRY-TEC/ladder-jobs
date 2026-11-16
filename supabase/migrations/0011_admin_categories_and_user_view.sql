-- 0011: allow admins to manage job categories from the app.
--
-- ladder_job_categories were readable by everyone but had no client write path.
-- This adds admin-only insert/update/delete policies and grants so the admin
-- category management screen can curate the taxonomy without using the SQL editor.

drop policy if exists categories_admin_insert on ladder_job_categories;
create policy categories_admin_insert on ladder_job_categories
  for insert to authenticated
  with check (ladder_is_admin());

drop policy if exists categories_admin_update on ladder_job_categories;
create policy categories_admin_update on ladder_job_categories
  for update to authenticated
  using (ladder_is_admin())
  with check (ladder_is_admin());

drop policy if exists categories_admin_delete on ladder_job_categories;
create policy categories_admin_delete on ladder_job_categories
  for delete to authenticated
  using (ladder_is_admin());

grant insert, update, delete on ladder_job_categories to authenticated;

-- User/role changes remain restricted by design:
-- - roles are only granted via ladder_grant_admin() (service_role/postgres)
-- - clients cannot insert/update/delete ladder_user_roles
-- Admins can read all profiles and roles via existing RLS for user management views.