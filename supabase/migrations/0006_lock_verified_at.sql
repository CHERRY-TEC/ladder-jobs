-- ============================================================================
-- Ladder 2.0 — 0006 pin verified_at for non-admins
--
-- 0005's ladder_employers_lock_status() only guarded `status`. Because the
-- guard sits in an `elsif`, a write that left status untouched slipped past it
-- — so an already-verified employer could PATCH their own verified_at to any
-- date and falsify the public "Verified on <date>" line. The badge itself was
-- never at risk (status could not change), but the date it carries was.
--
-- This replaces the 0005 body with one that pins verified_at on EVERY
-- non-admin write, regardless of whether status moved.
-- ============================================================================

create or replace function ladder_employers_lock_status()
returns trigger
language plpgsql
as $$
begin
  -- Trusted context = no JWT (SQL Editor / migrations / service role) or admin.
  if auth.uid() is null or ladder_is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Owners always start unverified; they cannot seed their own trust state.
    new.status := 'unverified';
    new.verified_at := null;
    return new;
  end if;

  -- Non-admin UPDATE: status may only move unverified/rejected → pending
  -- (asking for review). Everything else — including a forged verified_at on
  -- an unchanged status — is reverted to what the row already held.
  if new.status = 'pending' and old.status in ('unverified', 'rejected') then
    new.verified_at := null;
  elsif new.status is distinct from old.status then
    new.status := old.status;
    new.verified_at := old.verified_at;
  else
    new.verified_at := old.verified_at;
  end if;

  return new;
end;
$$;

-- Same class of hole on the submission table: 0005 guarded the review fields
-- only inside branches that compared them, so a non-admin could rewrite
-- reviewed_at on an unchanged status. Pin all four, always.
create or replace function ladder_verifications_lock_status()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null or ladder_is_admin() then
    if tg_op = 'INSERT' and new.status in ('approved', 'rejected') and new.reviewed_at is null then
      new.reviewed_at := now();
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- A submission is always a submission: never a decision, never reviewed.
    new.status       := 'pending';
    new.review_notes := null;
    new.reviewer_id  := null;
    new.reviewed_at  := null;
    return new;
  end if;

  -- Non-admin UPDATE: the whole review outcome is immutable, including a
  -- timestamp rewrite that leaves status untouched.
  new.status       := old.status;
  new.review_notes := old.review_notes;
  new.reviewer_id  := old.reviewer_id;
  new.reviewed_at  := old.reviewed_at;
  return new;
end;
$$;
