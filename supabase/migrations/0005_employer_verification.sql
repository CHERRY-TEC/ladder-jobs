-- ============================================================================
-- Ladder 2.0 — 0005 employer verification lifecycle
--
-- Closes a hole in 0001: ladder_employer_verifications had no trigger forcing
-- status, and the insert RLS policy only checks ownership — so an employer
-- could have inserted a row with status='approved' and walked away with the
-- Verified badge. Same pattern as employers_lock_status, applied here.
--
-- Also adds the sync trigger: a review outcome (or a fresh submission) moves
-- ladder_employers.status, which is the ONLY source of the public badge.
-- Run AFTER 0001 + 0002 + 0003 + 0004.
-- ============================================================================

-- ---------------------------------------------------- status lock on writes --
-- Trusted context = no JWT (SQL Editor / migrations / service role) or admin.
-- Everyone else may only create a 'pending' submission and may never touch a
-- row's review outcome.

create or replace function ladder_verifications_lock_status()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if not (auth.uid() is null or ladder_is_admin()) then
      new.status := 'pending';
      new.review_notes := null;
      new.reviewer_id   := null;
      new.reviewed_at   := null;
    end if;
    -- A review that arrives without a reviewer/time is still recorded honestly.
    if new.status in ('approved', 'rejected') and new.reviewed_at is null then
      new.reviewed_at := now();
    end if;
  elsif new.status is distinct from old.status
        or new.review_notes is distinct from old.review_notes
        or new.reviewer_id is distinct from old.reviewer_id
        or new.reviewed_at is distinct from old.reviewed_at then
    if not (auth.uid() is null or ladder_is_admin()) then
      new.status       := old.status;
      new.review_notes := old.review_notes;
      new.reviewer_id  := old.reviewer_id;
      new.reviewed_at  := old.reviewed_at;
    else
      if new.status in ('approved', 'rejected') and new.reviewed_at is null then
        new.reviewed_at := now();
      end if;
      if new.status in ('approved', 'rejected') and new.reviewer_id is null then
        new.reviewer_id := auth.uid();
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists verifications_lock_status on ladder_employer_verifications;
create trigger verifications_lock_status
  before insert or update on ladder_employer_verifications
  for each row execute function ladder_verifications_lock_status();

-- --------------------------------------------- review outcome → company row --
-- Recomputes ladder_employers.status from that employer's submissions instead
-- of trusting any single row, so two concurrent submissions cannot fight:
--   any approved  → verified   (badge appears)
--   any pending   → pending    (never touches an already-verified company)
--   none of those → rejected   (only if it was pending; a previous approval
--                               still stands — the old documents were good)
-- 'suspended' is sticky: an admin punishment must not be undone by a review.

create or replace function ladder_sync_employer_status()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  emp uuid;
  cur text;
  has_approved boolean;
  has_pending  boolean;
begin
  emp := new.employer_id;

  select status into cur from ladder_employers where id = emp;
  if cur is null or cur = 'suspended' then
    return new;
  end if;

  select exists (
    select 1 from ladder_employer_verifications
    where employer_id = emp and status = 'approved'
  ) into has_approved;

  select exists (
    select 1 from ladder_employer_verifications
    where employer_id = emp and status = 'pending'
  ) into has_pending;

  if has_approved then
    update ladder_employers
       set status = 'verified',
           verified_at = coalesce(verified_at, now())
     where id = emp and status <> 'verified';
  elsif has_pending then
    update ladder_employers
       set status = 'pending',
           verified_at = null
     where id = emp and status in ('unverified', 'rejected');
  else
    update ladder_employers
       set status = 'rejected',
           verified_at = null
     where id = emp and status = 'pending';
  end if;

  return new;
end;
$$;

-- AFTER INSERT: a fresh submission moves the company to 'pending'.
-- AFTER UPDATE OF status: an approve/reject recomputes the company row.
-- The BEFORE lock above always runs first, so a non-admin can never feed a
-- fake 'approved' row into this function.
drop trigger if exists employer_verifications_sync_status on ladder_employer_verifications;
create trigger employer_verifications_sync_status
  after insert or update of status on ladder_employer_verifications
  for each row execute function ladder_sync_employer_status();

-- -------------------------------------------------------- owner self-review --
-- Replaces the 0001 version of ladder_employers_lock_status(): the employer
-- owner may now move their own company to 'pending' by submitting documents.
-- Still nothing else — 'verified' and 'suspended' remain admin/trusted only.
-- The trigger `employers_lock_status` keeps pointing at this function OID, so
-- replacing the body updates it in place.

create or replace function ladder_employers_lock_status()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if not (auth.uid() is null or ladder_is_admin()) then
      new.status := 'unverified';
      new.verified_at := null;
    end if;
  elsif new.status is distinct from old.status
        and not (auth.uid() is null or ladder_is_admin()) then
    -- Ask for review: unverified/rejected → pending. Anything else is refused.
    if new.status = 'pending' and old.status in ('unverified', 'rejected') then
      new.verified_at := null;
    else
      new.status := old.status;
      new.verified_at := old.verified_at;
    end if;
  end if;
  return new;
end;
$$;

-- Trigger functions are only invoked as triggers; keep them off the RPC surface.
revoke execute on function ladder_verifications_lock_status() from public, anon, authenticated;
revoke execute on function ladder_sync_employer_status() from public, anon, authenticated;
