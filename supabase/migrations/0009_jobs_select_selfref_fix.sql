-- ============================================================ 0009 =========
-- jobs_select: drop the self-referencing ownership check — Phase 6.
--
-- The SELECT policy used ladder_owns_job(id), which re-selects ladder_jobs
-- from inside a policy ON ladder_jobs. A row being inserted is not visible to
-- its own statement (the statement snapshot predates the row), so ownership
-- always evaluated false and every `INSERT ... RETURNING` — PostgREST's
-- `return=representation`, i.e. supabase-js `.insert().select()` — failed
-- with 42501 even though the insert policy itself passed. A plain insert
-- (no RETURNING) was never affected, which is all the app sends today.
--
-- Ownership is now checked straight against the employer row — a table that
-- never self-references — with identical visibility rules for everyone:
--   anon/authenticated see active, unexpired listings, plus
--   the owner sees their own rows at any status, admins see everything.
--
-- ladder_owns_job() itself is left intact: the other policies that use it
-- (update/delete on ladder_jobs, applications, saved_jobs, resumes) evaluate
-- it against rows that already exist, where the nested read is fine.

drop policy if exists jobs_select on ladder_jobs;

create policy jobs_select on ladder_jobs
  for select to anon, authenticated
  using (
    ((status = 'active') and ((expires_at is null) or (expires_at > now())))
    or ladder_owns_employer(employer_id)
    or ladder_is_admin()
  );
