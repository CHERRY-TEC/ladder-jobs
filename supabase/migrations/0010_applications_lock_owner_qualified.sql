-- ============================================================================
-- Ladder 2.0 — 0010 qualify the applications lock's join column
--
-- `ladder_applications_lock_status` ran `select id into my_employer
-- from ladder_employers e join ladder_jobs j on j.employer_id = e.id ...` with
-- the column UNQUALIFIED. Both tables have an `id` column, so Postgres resolves
-- the bare reference ambiguously and the trigger raised
--   42702: column reference "id" is ambiguous
-- which failed every employer stage move (the whole UPDATE statement aborted).
--
-- Qualification is purely a correctness fix — the previous behaviour was meant to
-- select the owning employer's uuid; only the bare-column reference was wrong.
-- ============================================================================

create or replace function ladder_applications_lock_status()
returns trigger
language plpgsql
as $$
declare
  my_employer uuid;
begin
  new.status_updated_at := now();

  if old.status = new.status then
    return new;
  end if;

  -- Trusted writer (SQL Editor / service role / admin): full control.
  if auth.uid() is null or ladder_is_admin() then
    return new;
  end if;

  select e.id into my_employer
  from ladder_employers e
  join ladder_jobs j on j.employer_id = e.id
  where j.id = new.job_id and e.owner_id = auth.uid();

  if my_employer is not null then
    return new;                          -- employer owns the job: any stage change
  end if;

  if new.profile_id = auth.uid() and new.status = 'withdrawn' then
    return new;                          -- applicant may withdraw only
  end if;

  new.status := old.status;
  return new;
end;
$$;
