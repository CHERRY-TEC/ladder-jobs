-- ============================================================ 0008 =========
-- Job attribution lock — Phase 6.
--
-- A listing's provenance belongs to the database, not to whoever writes the
-- row. Without this, an employer could insert `origin = 'feed'` (plus a fake
-- `source_name`/`source_url`) to look like a syndicated listing, backdate
-- `published_at` to jump to the top of "Newest first", or inflate `views`.
--
-- Trusted context = no JWT (SQL Editor / service-role feed ingest) or an
-- admin JWT: those writers legitimately set demo/feed rows and may moderate.
-- Browser users (any authenticated role) get their attribution pinned:
--
--   INSERT  origin forced to 'employer', source_* and external_id nulled,
--           published_at forced to now(), views forced to 0.
--   UPDATE  origin / source_name / source_url / external_id / published_at /
--           views / created_at all frozen at their previous values.
--
-- Content columns (title, pay, location, status transitions handled by
-- ladder_jobs_lock_status) stay editable — only provenance is locked.

create or replace function ladder_jobs_lock_attribution()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null or ladder_is_admin() then
    return new;                            -- trusted writer, no lock
  end if;

  if tg_op = 'INSERT' then
    new.origin       := 'employer';
    new.source_name  := null;
    new.source_url   := null;
    new.external_id  := null;
    new.published_at := now();
    new.views        := 0;
  else
    new.origin       := old.origin;
    new.source_name  := old.source_name;
    new.source_url   := old.source_url;
    new.external_id  := old.external_id;
    new.published_at := old.published_at;
    new.views        := old.views;
    new.created_at   := old.created_at;
  end if;
  return new;
end;
$$;

drop trigger if exists jobs_lock_attribution on ladder_jobs;
create trigger jobs_lock_attribution
  before insert or update on ladder_jobs
  for each row execute function ladder_jobs_lock_attribution();
