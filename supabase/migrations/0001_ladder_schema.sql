-- ============================================================================
-- Ladder 2.0 — 0001 schema
-- Shared Supabase project: every Ladder table is prefixed `ladder_` to avoid
-- collisions with other apps in the same database.
-- Run in: Supabase Dashboard → SQL Editor (or `supabase db push` after login).
-- ============================================================================

create extension if not exists pgcrypto;

-- --------------------------------------------------------------- user roles --
-- Created first: the helper functions below (used in RLS policies) read it,
-- and SQL function bodies are validated at creation time.

create table if not exists ladder_user_roles (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  role        text not null check (role in ('seeker', 'employer', 'admin')),
  granted_at  timestamptz not null default now(),
  granted_by  uuid
);

alter table ladder_user_roles enable row level security;

-- ------------------------------------------------------------------ helpers --

create or replace function ladder_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Role of the signed-in user (security definer: used inside RLS policies).
create or replace function ladder_my_role()
returns text
language sql stable security definer
set search_path = public
as $$
  select role from ladder_user_roles where user_id = auth.uid();
$$;

create or replace function ladder_is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(ladder_my_role() = 'admin', false);
$$;

-- ----------------------------------------------------------------- profiles --

create table if not exists ladder_profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  full_name      text check (full_name is null or char_length(full_name) between 2 and 120),
  email          text,
  phone          text,
  headline       text,
  bio            text,
  avatar_url     text,
  date_of_birth  date,
  -- Candidate-side experience, mirroring job experience_required rungs:
  -- no_experience (fresher) → 0-1 → 1-3 → 3-5 → 5+ ; null = not stated
  experience_level text check (experience_level is null or experience_level in
                   ('fresher', 'no_experience', '0-1', '1-3', '3-5', '5+')),
  country        text not null default 'India',
  state          text,
  district       text,
  city           text,
  locality       text,
  is_active      boolean not null default true,
  privacy_show_phone boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists profiles_city_idx on ladder_profiles (city);
alter table ladder_profiles enable row level security;
create trigger profiles_set_updated_at before update on ladder_profiles
  for each row execute function ladder_set_updated_at();

-- Default role on signup. NEVER allows 'admin' — that is granted only via
-- ladder_grant_admin() from the SQL Editor / service role.
create or replace function ladder_handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  requested text;
  final_role text;
begin
  requested := new.raw_user_meta_data ->> 'requested_role';
  final_role := case when requested in ('seeker', 'employer') then requested else 'seeker' end;

  insert into ladder_profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.email
  )
  on conflict (id) do nothing;

  insert into ladder_user_roles (user_id, role)
  values (new.id, final_role)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- --------------------------------------------------------------- employers --

create table if not exists ladder_employers (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null unique references ladder_profiles (id) on delete cascade,
  company_name  text not null check (char_length(company_name) between 2 and 150),
  logo_url      text,
  about         text,
  website       text,
  industry      text,
  company_size  text,
  country       text not null default 'India',
  state         text,
  district      text,
  city          text,
  status        text not null default 'unverified'
                check (status in ('unverified', 'pending', 'verified', 'rejected', 'suspended')),
  verified_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table ladder_employers enable row level security;
create trigger employers_set_updated_at before update on ladder_employers
  for each row execute function ladder_set_updated_at();

-- Every new company gets the free plan row (replaces the dead branch that
-- previously ran at signup before any employer row existed).
create or replace function ladder_employers_init_subscription()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into ladder_subscriptions (employer_id, plan, status)
  values (new.id, 'free', 'active')
  on conflict do nothing;
  return new;
end;
$$;

create trigger employers_init_subscription after insert on ladder_employers
  for each row execute function ladder_employers_init_subscription();

-- Users can never grant themselves 'verified': force status on write.
-- Trusted context = no JWT (SQL Editor / migrations / service role — anon has
-- no write grants on this table) or an admin JWT.
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
    new.status := old.status;
    new.verified_at := old.verified_at;
  end if;
  return new;
end;
$$;

create trigger employers_lock_status before insert or update of status on ladder_employers
  for each row execute function ladder_employers_lock_status();

create table if not exists ladder_employer_verifications (
  id             uuid primary key default gen_random_uuid(),
  employer_id    uuid not null references ladder_employers (id) on delete cascade,
  submitted_by   uuid not null references ladder_profiles (id),
  document_type  text not null check (document_type in
                 ('gst', 'cin', 'udyam', 'business_license', 'id_proof', 'other')),
  document_path  text not null,              -- object path in ladder-verification bucket
  status         text not null default 'pending'
                 check (status in ('pending', 'approved', 'rejected')),
  review_notes   text,
  reviewer_id    uuid references ladder_profiles (id),
  submitted_at   timestamptz not null default now(),
  reviewed_at    timestamptz
);

create index if not exists verifications_status_idx on ladder_employer_verifications (status, submitted_at);
alter table ladder_employer_verifications enable row level security;

-- ------------------------------------------------------------ categories ----

create table if not exists ladder_job_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (char_length(name) between 2 and 80),
  slug        text not null unique check (slug ~ '^[a-z0-9-]+$'),
  parent_id   uuid references ladder_job_categories (id),
  description text,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

alter table ladder_job_categories enable row level security;

create table if not exists ladder_skills (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now()
);

alter table ladder_skills enable row level security;

-- ------------------------------------------------------------------- jobs ----

create table if not exists ladder_jobs (
  id                  uuid primary key default gen_random_uuid(),
  employer_id         uuid references ladder_employers (id) on delete cascade,
  category_id         uuid references ladder_job_categories (id),
  org_name            text,                  -- display name for feed/demo rows
  title               text not null check (char_length(title) between 3 and 200),
  summary             text not null check (char_length(summary) between 10 and 4000),
  description         text,
  duties              text[] not null default '{}',
  requirements        text[] not null default '{}',

  job_type            text not null default 'Full-time'
                      check (job_type in ('Full-time', 'Part-time', 'Internship', 'Contract',
                                          'Temporary', 'Freelance', 'Daily wage')),
  work_mode           text not null default 'onsite'
                      check (work_mode in ('onsite', 'remote', 'hybrid')),
  education_required  text not null default 'any'
                      check (education_required in ('no_formal', 'below_10th', '10th',
                              'intermediate', 'iti', 'diploma', 'undergraduate',
                              'graduate', 'postgraduate', 'any')),
  experience_required text not null default 'no_experience'
                      check (experience_required in ('fresher', 'no_experience', '0-1',
                              '1-3', '3-5', '5+')),

  salary_min          numeric check (salary_min is null or salary_min >= 0),
  salary_max          numeric check (salary_max is null or salary_max >= 0),
  salary_period       text check (salary_period is null or salary_period in ('hour', 'day', 'month', 'year')),
  salary_label        text,
  currency            text not null default 'INR',

  country             text not null default 'India',
  state               text,
  district            text,
  city                text,
  locality            text,
  location_label      text,
  is_remote           boolean not null default false,
  min_age             integer not null default 18 check (min_age between 18 and 100),

  contact_kind        text check (contact_kind is null or contact_kind in ('phone', 'email', 'link')),
  contact_value       text,
  contact_label       text,

  status              text not null default 'pending'
                      check (status in ('draft', 'pending', 'active', 'closed', 'rejected', 'expired')),
  origin              text not null default 'employer'
                      check (origin in ('employer', 'feed', 'demo')),
  source_name         text,
  source_url          text,
  external_id         text,
  views               integer not null default 0,

  expires_at          timestamptz,
  published_at        timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint jobs_owner_or_feed check (employer_id is not null or origin in ('feed', 'demo')),
  constraint jobs_feed_has_source check (origin <> 'feed' or (source_name is not null and source_url is not null)),
  constraint jobs_salary_range check (salary_max is null or salary_min is null or salary_max >= salary_min)
);

create unique index if not exists jobs_feed_source_uniq
  on ladder_jobs (source_name, external_id) where external_id is not null;
create index if not exists jobs_status_published_idx on ladder_jobs (status, published_at desc);
create index if not exists jobs_category_idx on ladder_jobs (category_id);
create index if not exists jobs_employer_idx on ladder_jobs (employer_id);
create index if not exists jobs_state_idx on ladder_jobs (state);
create index if not exists jobs_city_idx on ladder_jobs (city);
create index if not exists jobs_education_idx on ladder_jobs (education_required);
create index if not exists jobs_experience_idx on ladder_jobs (experience_required);
create index if not exists jobs_type_idx on ladder_jobs (job_type);
create index if not exists jobs_work_mode_idx on ladder_jobs (work_mode);
create index if not exists jobs_salary_idx on ladder_jobs (salary_min);
create index if not exists jobs_expires_idx on ladder_jobs (expires_at) where status = 'active';
create index if not exists jobs_search_idx on ladder_jobs
  using gin (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(org_name, '')));

alter table ladder_jobs enable row level security;
create trigger jobs_set_updated_at before update on ladder_jobs
  for each row execute function ladder_set_updated_at();

-- Employers cannot self-activate: activation belongs to admin moderation.
-- Trusted context = no JWT (SQL Editor seeds / service-role ingest — anon has
-- no insert grant on ladder_jobs) or an admin JWT. Plain authenticated users
-- are always locked to draft/pending.
create or replace function ladder_jobs_lock_status()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null or ladder_is_admin() then
    return new;                            -- trusted writer, no lock
  end if;

  if tg_op = 'INSERT' then
    if new.status not in ('draft', 'pending') then
      new.status := 'pending';
    end if;
  elsif new.status is distinct from old.status
        and new.status in ('active', 'rejected') then
    new.status := old.status;
  end if;
  return new;
end;
$$;

create trigger jobs_lock_status before insert or update on ladder_jobs
  for each row execute function ladder_jobs_lock_status();

create table if not exists ladder_job_skills (
  job_id    uuid not null references ladder_jobs (id) on delete cascade,
  skill_id  uuid not null references ladder_skills (id) on delete cascade,
  primary key (job_id, skill_id)
);

alter table ladder_job_skills enable row level security;

-- ------------------------------------------------------- candidate profile ---

create table if not exists ladder_candidate_skills (
  profile_id  uuid not null references ladder_profiles (id) on delete cascade,
  skill_id    uuid not null references ladder_skills (id) on delete cascade,
  level       text not null default 'intermediate'
              check (level in ('beginner', 'intermediate', 'advanced')),
  primary key (profile_id, skill_id)
);

create table if not exists ladder_candidate_education (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid not null references ladder_profiles (id) on delete cascade,
  level          text not null
                 check (level in ('no_formal', 'below_10th', '10th', 'intermediate', 'iti',
                                  'diploma', 'undergraduate', 'graduate', 'postgraduate')),
  institution    text,
  field_of_study text,
  start_year     integer check (start_year is null or start_year between 1950 and 2100),
  end_year       integer check (end_year is null or end_year between 1950 and 2100),
  is_current     boolean not null default false,
  created_at     timestamptz not null default now(),
  constraint education_years check (is_current or end_year is null or start_year is null or end_year >= start_year)
);

create table if not exists ladder_candidate_experience (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references ladder_profiles (id) on delete cascade,
  title       text not null,
  company     text,
  start_date  date not null,
  end_date    date,
  is_current  boolean not null default false,
  description text,
  created_at  timestamptz not null default now(),
  constraint experience_dates check (is_current or end_date is null or end_date >= start_date)
);

create index if not exists cand_edu_profile_idx on ladder_candidate_education (profile_id);
create index if not exists cand_exp_profile_idx on ladder_candidate_experience (profile_id);
alter table ladder_candidate_skills enable row level security;
alter table ladder_candidate_education enable row level security;
alter table ladder_candidate_experience enable row level security;

-- ------------------------------------------------------------------ resumes --

create table if not exists ladder_resumes (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references ladder_profiles (id) on delete cascade,
  file_path   text not null,               -- private storage path: <uid>/<file>
  file_name   text not null,
  size_bytes  bigint not null check (size_bytes between 1 and 5 * 1024 * 1024),
  mime_type   text not null check (mime_type in
              ('application/pdf',
               'application/msword',
               'application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
  is_primary  boolean not null default false,
  created_at  timestamptz not null default now()
);

create unique index if not exists resumes_one_primary
  on ladder_resumes (profile_id) where is_primary;
alter table ladder_resumes enable row level security;

-- ------------------------------------------------------------- applications --

create table if not exists ladder_applications (
  id                uuid primary key default gen_random_uuid(),
  job_id            uuid not null references ladder_jobs (id) on delete cascade,
  profile_id        uuid not null references ladder_profiles (id) on delete cascade,
  resume_id         uuid references ladder_resumes (id) on delete set null,
  cover_note        text,
  status            text not null default 'applied'
                    check (status in ('applied', 'viewed', 'shortlisted', 'interview',
                                      'selected', 'rejected', 'withdrawn')),
  status_updated_at timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (job_id, profile_id)              -- duplicate prevention; withdrawn rows can be re-used
);

create index if not exists applications_job_status_idx on ladder_applications (job_id, status);
create index if not exists applications_profile_idx on ladder_applications (profile_id, created_at desc);
alter table ladder_applications enable row level security;
create trigger applications_set_updated_at before update on ladder_applications
  for each row execute function ladder_set_updated_at();

-- Applicants may only withdraw; employers move candidates through stages;
-- only admins may set terminal platform states outside that rule.
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

  select id into my_employer
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

create trigger applications_lock_status before update on ladder_applications
  for each row execute function ladder_applications_lock_status();

-- --------------------------------------------------------------- saved jobs --

create table if not exists ladder_saved_jobs (
  profile_id  uuid not null references ladder_profiles (id) on delete cascade,
  job_id      uuid not null references ladder_jobs (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (profile_id, job_id)
);

alter table ladder_saved_jobs enable row level security;

-- ------------------------------------------------------------- notifications --

create table if not exists ladder_notifications (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references ladder_profiles (id) on delete cascade,
  type        text not null,
  title       text not null,
  body        text,
  link        text,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_inbox_idx
  on ladder_notifications (profile_id, is_read, created_at desc);
alter table ladder_notifications enable row level security;

-- ------------------------------------------------------------------ reports --

create table if not exists ladder_job_reports (
  id               uuid primary key default gen_random_uuid(),
  job_id           uuid not null references ladder_jobs (id) on delete cascade,
  reporter_id      uuid not null references ladder_profiles (id),
  reason           text not null check (reason in
                   ('fraud', 'fee_request', 'misleading', 'duplicate', 'discrimination', 'other')),
  details          text,
  status           text not null default 'open'
                   check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  resolution_notes text,
  resolved_by      uuid references ladder_profiles (id),
  resolved_at      timestamptz,
  created_at       timestamptz not null default now()
);

create table if not exists ladder_employer_reports (
  id               uuid primary key default gen_random_uuid(),
  employer_id      uuid not null references ladder_employers (id) on delete cascade,
  reporter_id      uuid not null references ladder_profiles (id),
  reason           text not null check (reason in
                   ('fraud', 'fee_request', 'misleading', 'fake_jobs', 'discrimination', 'other')),
  details          text,
  status           text not null default 'open'
                   check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  resolution_notes text,
  resolved_by      uuid references ladder_profiles (id),
  resolved_at      timestamptz,
  created_at       timestamptz not null default now()
);

create index if not exists job_reports_status_idx on ladder_job_reports (status, created_at);
create index if not exists employer_reports_status_idx on ladder_employer_reports (status, created_at);
alter table ladder_job_reports enable row level security;
alter table ladder_employer_reports enable row level security;

-- --------------------------------------------------- subscriptions / feature --

create table if not exists ladder_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  employer_id uuid not null unique references ladder_employers (id) on delete cascade,
  plan        text not null default 'free' check (plan in ('free', 'premium', 'business')),
  status      text not null default 'active' check (status in ('active', 'expired', 'cancelled')),
  started_at  timestamptz not null default now(),
  ends_at     timestamptz,
  created_at  timestamptz not null default now()
);

create table if not exists ladder_featured_jobs (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null unique references ladder_jobs (id) on delete cascade,
  employer_id uuid not null references ladder_employers (id) on delete cascade,
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz not null,
  created_at  timestamptz not null default now(),
  constraint featured_window check (ends_at > starts_at)
);

alter table ladder_subscriptions enable row level security;
alter table ladder_featured_jobs enable row level security;

-- ------------------------------------------------------------ audit logging --

create table if not exists ladder_admin_audit_logs (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid not null references ladder_profiles (id),
  action      text not null,
  entity_type text not null,
  entity_id   text,
  details     jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

create index if not exists audit_recent_idx on ladder_admin_audit_logs (created_at desc);
create index if not exists audit_admin_idx on ladder_admin_audit_logs (admin_id);
alter table ladder_admin_audit_logs enable row level security;

-- ------------------------------------------------------- admin bootstrap ------

-- Run ONCE from the SQL Editor after signing up the admin account:
--   select ladder_grant_admin('admin@example.com');
create or replace function ladder_grant_admin(target_email text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  target_uid uuid;
begin
  select id into target_uid from auth.users where lower(email) = lower(target_email) limit 1;
  if target_uid is null then
    raise exception 'No auth user found for email % — sign up first', target_email;
  end if;

  insert into ladder_profiles (id, email)
  values (target_uid, target_email)
  on conflict (id) do nothing;

  insert into ladder_user_roles (user_id, role)
  values (target_uid, 'admin')
  on conflict (user_id) do update set role = 'admin', granted_at = now();
end;
$$;

revoke execute on function ladder_grant_admin(text) from public, anon, authenticated;
grant execute on function ladder_grant_admin(text) to service_role, postgres;

-- ------------------------------------------------------------ auth trigger ----

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function ladder_handle_new_user();
