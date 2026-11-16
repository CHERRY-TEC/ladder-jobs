-- ============================================================================
-- Ladder 2.0 — 0007 fire the employer lock on EVERY update
--
-- 0001 declared the trigger as `before insert or update OF status`, so it only
-- ran when the UPDATE's SET clause mentioned `status`. A write that changed
-- anything else — notably `verified_at` on its own — skipped the guard
-- entirely and landed untouched. 0006 tightened the function body, but the
-- body was unreachable for exactly those writes (proved: an employer set
-- verified_at to 1999-01-01 with status untouched and it stuck).
--
-- Recreate the trigger so it fires on any column change. The function itself
-- already decides column-by-column what a non-admin may alter, so widening the
-- trigger only makes the guard run more often — it never loosens it.
-- ============================================================================

drop trigger if exists employers_lock_status on ladder_employers;
create trigger employers_lock_status
  before insert or update on ladder_employers
  for each row execute function ladder_employers_lock_status();

-- The verification lock was already declared without `of status` in 0005, so
-- its body covers every column; restated here only to make the asymmetry
-- explicit for whoever reads these files next.
comment on trigger employers_lock_status on ladder_employers is
  'Fires on all inserts/updates: ladder_employers_lock_status() decides per column what a non-admin may change.';
