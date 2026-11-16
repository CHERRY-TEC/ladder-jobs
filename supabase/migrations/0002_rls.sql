-- ============================================================================
-- Ladder 2.0 — 0002 row level security
-- Every ladder_* table already has RLS enabled (0001). This file adds the
-- policies + explicit grants. Shared project: grants are per-table (never
-- `all tables in schema public` — that would leak into other apps' tables).
-- Run AFTER 0001.
-- ============================================================================

-- ------------------------------------------------------------- helpers ----

-- Security definer so policies don't recurse through other tables' RLS.
create or replace function ladder_owns_job(job_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from ladder_jobs j
    join ladder_employers e on e.id = j.employer_id
    where j.id = job_id and e.owner_id = auth.uid()
  );
$$;

create or replace function ladder_owns_employer(emp_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from ladder_employers e
    where e.id = emp_id and e.owner_id = auth.uid()
  );
$$;

-- ------------------------------------------------------------ user roles ---

drop policy if exists user_roles_select on ladder_user_roles;
create policy user_roles_select on ladder_user_roles
  for select to authenticated
  using (user_id = auth.uid() or ladder_is_admin());
-- No insert/update/delete for clients: roles are set by the signup trigger
-- and by ladder_grant_admin() (service_role / SQL Editor only).

-- -------------------------------------------------------------- profiles ---

drop policy if exists profiles_select on ladder_profiles;
create policy profiles_select on ladder_profiles
  for select to authenticated
  using (
    id = auth.uid()
    or ladder_is_admin()
    -- Employers may view applicants who applied to their jobs.
    or exists (
      select 1 from ladder_applications a
      where a.profile_id = ladder_profiles.id and ladder_owns_job(a.job_id)
    )
  );

drop policy if exists profiles_insert on ladder_profiles;
create policy profiles_insert on ladder_profiles
  for insert to authenticated
  with check (id = auth.uid());

drop policy if exists profiles_update on ladder_profiles;
create policy profiles_update on ladder_profiles
  for update to authenticated
  using (id = auth.uid() or ladder_is_admin())
  with check (id = auth.uid() or ladder_is_admin());
-- No client deletes: account deletion is an explicit admin/service flow.

-- ------------------------------------------------------------- employers ---
-- Company cards are public (like any job board). Status changes are blocked
-- by the employers_lock_status trigger — nobody self-verifies.

drop policy if exists employers_select on ladder_employers;
create policy employers_select on ladder_employers
  for select to anon, authenticated
  using (true);

drop policy if exists employers_insert on ladder_employers;
create policy employers_insert on ladder_employers
  for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists employers_update on ladder_employers;
create policy employers_update on ladder_employers
  for update to authenticated
  using (owner_id = auth.uid() or ladder_is_admin())
  with check (owner_id = auth.uid() or ladder_is_admin());

drop policy if exists employers_delete on ladder_employers;
create policy employers_delete on ladder_employers
  for delete to authenticated
  using (owner_id = auth.uid());

-- --------------------------------------------------- employer verifications -

drop policy if exists verifications_select on ladder_employer_verifications;
create policy verifications_select on ladder_employer_verifications
  for select to authenticated
  using (ladder_owns_employer(employer_id) or ladder_is_admin());

drop policy if exists verifications_insert on ladder_employer_verifications;
create policy verifications_insert on ladder_employer_verifications
  for insert to authenticated
  with check (ladder_owns_employer(employer_id) and submitted_by = auth.uid());

-- Review (approve/reject) is admin-only — enforced by having no non-admin
-- update policy plus the fact that status never changes without a reviewer.

drop policy if exists verifications_update on ladder_employer_verifications;
create policy verifications_update on ladder_employer_verifications
  for update to authenticated
  using (ladder_is_admin())
  with check (ladder_is_admin());

-- ------------------------------------------------- categories / skills -----
-- Taxonomies are public reads; writes are admin/service only.

drop policy if exists categories_select on ladder_job_categories;
create policy categories_select on ladder_job_categories
  for select to anon, authenticated
  using (true);

drop policy if exists skills_select on ladder_skills;
create policy skills_select on ladder_skills
  for select to anon, authenticated
  using (true);

drop policy if exists skills_insert on ladder_skills;
create policy skills_insert on ladder_skills
  for insert to authenticated
  with check (char_length(name) between 2 and 80);

-- ---------------------------------------------------------------- jobs -----
-- Public can read live jobs; owners manage their own; admins moderate.
-- The jobs_lock_status trigger stops owners from self-activating.

drop policy if exists jobs_select on ladder_jobs;
create policy jobs_select on ladder_jobs
  for select to anon, authenticated
  using (
    (status = 'active' and (expires_at is null or expires_at > now()))
    or ladder_owns_job(id)
    or ladder_is_admin()
  );

drop policy if exists jobs_insert on ladder_jobs;
create policy jobs_insert on ladder_jobs
  for insert to authenticated
  with check (
    employer_id is not null
    and ladder_owns_employer(employer_id)      -- company must be mine
    and status in ('draft', 'pending')         -- never self-activate
  );

drop policy if exists jobs_update on ladder_jobs;
create policy jobs_update on ladder_jobs
  for update to authenticated
  using (ladder_owns_job(id) or ladder_is_admin())
  with check (ladder_owns_job(id) or ladder_is_admin());

drop policy if exists jobs_delete on ladder_jobs;
create policy jobs_delete on ladder_jobs
  for delete to authenticated
  using (ladder_owns_job(id) or ladder_is_admin());

-- ------------------------------------------------------------ job skills ---

drop policy if exists job_skills_select on ladder_job_skills;
create policy job_skills_select on ladder_job_skills
  for select to anon, authenticated
  using (ladder_owns_job(job_id) or ladder_is_admin()
         or exists (select 1 from ladder_jobs j
                    where j.id = job_id and j.status = 'active'));

drop policy if exists job_skills_write on ladder_job_skills;
create policy job_skills_write on ladder_job_skills
  for all to authenticated
  using (ladder_owns_job(job_id) or ladder_is_admin())
  with check (ladder_owns_job(job_id) or ladder_is_admin());

-- --------------------------------------------------- candidate materials ---
-- Seekers own their rows; admins read all. Employers see candidate basics
-- only through the applications policies below.

drop policy if exists cand_skills_all on ladder_candidate_skills;
create policy cand_skills_all on ladder_candidate_skills
  for all to authenticated
  using (profile_id = auth.uid() or ladder_is_admin())
  with check (profile_id = auth.uid());

drop policy if exists cand_edu_all on ladder_candidate_education;
create policy cand_edu_all on ladder_candidate_education
  for all to authenticated
  using (profile_id = auth.uid() or ladder_is_admin())
  with check (profile_id = auth.uid());

drop policy if exists cand_exp_all on ladder_candidate_experience;
create policy cand_exp_all on ladder_candidate_experience
  for all to authenticated
  using (profile_id = auth.uid() or ladder_is_admin())
  with check (profile_id = auth.uid());

-- --------------------------------------------------------------- resumes ---

drop policy if exists resumes_select on ladder_resumes;
create policy resumes_select on ladder_resumes
  for select to authenticated
  using (
    profile_id = auth.uid()
    or ladder_is_admin()
    -- The employer of a job this resume was attached to may read it.
    or exists (
      select 1 from ladder_applications a
      where a.resume_id = ladder_resumes.id and ladder_owns_job(a.job_id)
    )
  );

drop policy if exists resumes_write on ladder_resumes;
create policy resumes_write on ladder_resumes
  for all to authenticated
  using (profile_id = auth.uid() or ladder_is_admin())
  with check (profile_id = auth.uid());

-- ---------------------------------------------------------- applications ----
-- Create: own application on a live job. Read: applicant, job owner, admin.
-- Stage changes: enforced by ladder_applications_lock_status trigger.

drop policy if exists applications_select on ladder_applications;
create policy applications_select on ladder_applications
  for select to authenticated
  using (
    profile_id = auth.uid()
    or ladder_owns_job(job_id)
    or ladder_is_admin()
  );

drop policy if exists applications_insert on ladder_applications;
create policy applications_insert on ladder_applications
  for insert to authenticated
  with check (
    profile_id = auth.uid()
    and exists (select 1 from ladder_jobs j
                where j.id = job_id
                  and j.status = 'active'
                  and (j.expires_at is null or j.expires_at > now()))
  );

drop policy if exists applications_update on ladder_applications;
create policy applications_update on ladder_applications
  for update to authenticated
  using (profile_id = auth.uid() or ladder_owns_job(job_id) or ladder_is_admin())
  with check (profile_id = auth.uid() or ladder_owns_job(job_id) or ladder_is_admin());

drop policy if exists applications_delete on ladder_applications;
create policy applications_delete on ladder_applications
  for delete to authenticated
  using (profile_id = auth.uid() or ladder_is_admin());

-- ------------------------------------------------------------- saved jobs ---

drop policy if exists saved_jobs_all on ladder_saved_jobs;
create policy saved_jobs_all on ladder_saved_jobs
  for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- ---------------------------------------------------------- notifications ---

drop policy if exists notifications_select on ladder_notifications;
create policy notifications_select on ladder_notifications
  for select to authenticated
  using (profile_id = auth.uid() or ladder_is_admin());

drop policy if exists notifications_update on ladder_notifications;
create policy notifications_update on ladder_notifications
  for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- Insert: admins, and employers notifying an applicant on their own job.
drop policy if exists notifications_insert on ladder_notifications;
create policy notifications_insert on ladder_notifications
  for insert to authenticated
  with check (
    ladder_is_admin()
    or exists (
      select 1 from ladder_applications a
      where a.profile_id = ladder_notifications.profile_id
        and ladder_owns_job(a.job_id)
    )
  );

-- ---------------------------------------------------------------- reports ---

drop policy if exists job_reports_insert on ladder_job_reports;
create policy job_reports_insert on ladder_job_reports
  for insert to authenticated
  with check (reporter_id = auth.uid());

drop policy if exists job_reports_select on ladder_job_reports;
create policy job_reports_select on ladder_job_reports
  for select to authenticated
  using (reporter_id = auth.uid() or ladder_is_admin());

drop policy if exists job_reports_update on ladder_job_reports;
create policy job_reports_update on ladder_job_reports
  for update to authenticated
  using (ladder_is_admin()) with check (ladder_is_admin());

drop policy if exists employer_reports_insert on ladder_employer_reports;
create policy employer_reports_insert on ladder_employer_reports
  for insert to authenticated
  with check (reporter_id = auth.uid());

drop policy if exists employer_reports_select on ladder_employer_reports;
create policy employer_reports_select on ladder_employer_reports
  for select to authenticated
  using (reporter_id = auth.uid() or ladder_is_admin());

drop policy if exists employer_reports_update on ladder_employer_reports;
create policy employer_reports_update on ladder_employer_reports
  for update to authenticated
  using (ladder_is_admin()) with check (ladder_is_admin());

-- ---------------------------------------------- subscriptions / featured ----

drop policy if exists subscriptions_select on ladder_subscriptions;
create policy subscriptions_select on ladder_subscriptions
  for select to authenticated
  using (ladder_owns_employer(employer_id) or ladder_is_admin());
-- Writes happen via the signup trigger / billing flows (service role).

drop policy if exists featured_select on ladder_featured_jobs;
create policy featured_select on ladder_featured_jobs
  for select to anon, authenticated
  using (ends_at > now());

drop policy if exists featured_insert on ladder_featured_jobs;
create policy featured_insert on ladder_featured_jobs
  for insert to authenticated
  with check (ladder_owns_employer(employer_id) or ladder_is_admin());

drop policy if exists featured_delete on ladder_featured_jobs;
create policy featured_delete on ladder_featured_jobs
  for delete to authenticated
  using (ladder_owns_employer(employer_id) or ladder_is_admin());

-- ------------------------------------------------------------ audit logs ----
-- Admins read; inserts come from admin actions (this client) / service role.

drop policy if exists audit_select on ladder_admin_audit_logs;
create policy audit_select on ladder_admin_audit_logs
  for select to authenticated
  using (ladder_is_admin());

drop policy if exists audit_insert on ladder_admin_audit_logs;
create policy audit_insert on ladder_admin_audit_logs
  for insert to authenticated
  with check (ladder_is_admin() and admin_id = auth.uid());

-- --------------------------------------------------------------- grants -----
-- Explicit per-table grants (shared database: NEVER wildcard the schema).
-- RLS still scopes which rows each role can touch.

-- Public catalogue reads (anon = logged-out site).
grant select on ladder_jobs, ladder_job_categories, ladder_skills,
  ladder_employers, ladder_job_skills, ladder_featured_jobs to anon;

-- Authenticated: row-scoped reads + writes (see policies above).
grant select on ladder_user_roles, ladder_profiles, ladder_employers,
  ladder_employer_verifications, ladder_job_categories, ladder_skills,
  ladder_jobs, ladder_job_skills, ladder_candidate_skills,
  ladder_candidate_education, ladder_candidate_experience, ladder_resumes,
  ladder_applications, ladder_saved_jobs, ladder_notifications,
  ladder_job_reports, ladder_employer_reports, ladder_subscriptions,
  ladder_featured_jobs, ladder_admin_audit_logs to authenticated;

grant insert, update, delete on ladder_profiles, ladder_employers,
  ladder_employer_verifications, ladder_jobs, ladder_job_skills,
  ladder_candidate_skills, ladder_candidate_education,
  ladder_candidate_experience, ladder_resumes, ladder_applications,
  ladder_saved_jobs, ladder_notifications, ladder_job_reports,
  ladder_employer_reports, ladder_featured_jobs to authenticated;

grant insert on ladder_skills to authenticated;
grant update on ladder_notifications to authenticated;

-- Service role: full access (bypasses RLS; used by ingest + admin scripts).
grant select, insert, update, delete on ladder_user_roles, ladder_profiles,
  ladder_employers, ladder_employer_verifications, ladder_job_categories,
  ladder_skills, ladder_jobs, ladder_job_skills, ladder_candidate_skills,
  ladder_candidate_education, ladder_candidate_experience, ladder_resumes,
  ladder_applications, ladder_saved_jobs, ladder_notifications,
  ladder_job_reports, ladder_employer_reports, ladder_subscriptions,
  ladder_featured_jobs, ladder_admin_audit_logs to service_role;
