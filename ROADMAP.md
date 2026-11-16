# KAAMVORI — Development Roadmap

Living checklist. Update status after each verified phase.

**Stack:** React 19 · Vite 8 · Tailwind CSS v4 · React Router 7 · Supabase (Auth, PostgreSQL, Storage) · Vercel
**Supabase project:** existing `cabvhwousbdkmfzisfin` (tables remain prefixed `ladder_` for schema compatibility in the shared project)

---

## Phase 1 — Inspect & improve existing UI ✅
- [x] Inspect existing project (React 19 + Vite + Tailwind v4, localStorage store, 38 demo listings)
- [x] Soft-minimal theme pass (warm white, sage accent, rounded corners, light footer)
- [x] Playwright verification: flows, console errors, mobile overflow — all green
- [x] Tagline + brand applied: "Every Job. Every Skill. Every Opportunity."

## Phase 2 — Supabase setup & database migrations
- [x] Install `@supabase/supabase-js`, env wiring (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
- [x] Migration 0001: schema — 20 tables, UUID PKs, FKs, indexes, checks, triggers, admin bootstrap fn
- [x] Migration 0002: Row Level Security policies for every table + per-table grants (shared DB — no schema wildcards)
- [x] Migration 0003: storage buckets (resumes, verification, avatars, logos) + path-scoped policies
- [x] Migration 0004: seed — 6 categories + 38 demo jobs, **generated** from `src/data/seed.js` (`scripts/gen-seed-sql.mjs`, checked by `scripts/check-sql.mjs`)
- [x] Apply migrations to the project — `supabase link --project-ref cabvhwousbdkmfzisfin` + `supabase db push` applied 0001–0004 (note: `ladder_user_roles` must be created *before* `ladder_my_role()`/`ladder_is_admin()` — SQL function bodies are validated at creation)
- [x] Verify applied schema: 38 active jobs + 6 categories readable through RLS via the anon key
- [x] App runs without DB (JSON feed/demo path) and surfaces clear config errors via `requireSupabase()`

## Phase 3 — Authentication & role management
- [x] Auth pages: `/login`, `/signup` (seeker/employer role cards), `/admin/login` (admin-only path)
- [x] Session context (`src/lib/auth.jsx`) + protected routes via `RequireAuth` — seeker `/me`, employer `/employer`, admin `/admin`
- [x] Default role `seeker` via DB trigger; roles never settable from client (signup metadata can request seeker/employer only; `ladder_grant_admin` revoked from client roles)
- [x] Admin role grant path documented (`select ladder_grant_admin('<email>')` — see `supabase/README.md`)
- [x] Header account menu (name, role home, sign out) + honest signed-out state
- [x] Tested now (Playwright, all green): page rendering, role toggle, **wrong password → "Invalid login credentials"**, signed-out redirects `/me` `/employer` `/admin` → `/login?next=…`, mobile 0px overflow, 0 unexpected console issues
- [x] Full flow test (Playwright `ladder_auth_test.py`, 35 checks green): signup → trigger-created profile+role rows → client `PATCH ladder_user_roles` rejected → login → logout → wrong-role redirects for all 3 roles → `ladder_grant_admin()` → `/admin/login` → `/admin` → wrong-password alert; 0 unexpected console issues

## Phase 4 — Job seeker profiles
- [x] Dashboard shell (seeker) + tab nav (`SeekerNav`: Overview / My Profile / My Resume / Settings)
- [x] My Profile (`/me/profile`) — basics, 10-level education ladder, skills (find-or-create), experience CRUD; full taxonomies in `src/data/ladder.js`
- [x] My Resume (`/me/resume`) — private `ladder-resumes` bucket, `<uid>/` paths, PDF/DOC/DOCX ≤ 5 MB enforced (`RESUME_RULES`), primary-resume uniqueness, signed-URL viewing, orphan-upload rollback
- [x] Account settings & privacy (`/me/settings`) — phone visibility toggle, contact fields, honest account-management note (no pretend self-serve deletion)
- [x] Honest gating: forms disable with a clear notice when backend is unconfigured / migrations missing / errored — never fake saves
- [x] Tested now (Playwright, all green): all three routes behind `RequireAuth role="seeker"` (signed-out → `/login?next=…`), 0 unexpected console issues, build passes
- [x] DB write flows verified (Playwright against the live project): save profile → `ladder_profiles` (city/headline persist after reload), add education → `ladder_candidate_education`, add/remove skill → `ladder_candidate_skills`, upload + delete resume → `ladder-resumes` bucket + `ladder_resumes` row (no orphans), privacy toggle → persists

## Phase 5 — Employer profiles & verification ✅
- [x] Employer dashboard shell — `EmployerNav` + rewritten `EmployerDashboard` (real status from DB, next-step nudges, no hard-coded numbers)
- [x] Company profile — `/employer/company` writes `ladder_employers` (name, industry, size, about, website, location) + logo upload to `ladder-logos`; status/`verified_at` are display-only
- [x] Verification submission — `/employer/verification` uploads to private `ladder-verification` bucket → row lands as `pending` → admin reviews on `/admin/verifications`
- [x] Verified badge only after approval — approval writes the *submission* row; a DB trigger moves `ladder_employers.status` (no direct company-status edit path anywhere)
- [x] Migrations 0005–0007 applied: 0005 closes the self-approval hole (insert forces `pending`, review fields nulled) + adds the status sync trigger; 0006 pins `verified_at`/review fields on every non-admin write; 0007 widens `employers_lock_status` to fire on **all** column updates (0001's `update of status` let single-column `verified_at` writes bypass the guard)
- [x] Security probes: employer inserting `status='approved'` → forced `pending`, company unchanged; forging `verified_at` → stays `null`; cross-tenant PATCH → 0 rows
- [x] E2E test (`ladder_phase5_test.py`, 38 checks green): signed-out `next` redirects, company create/persist, no status control in form, logo upload, submission → admin queue → reject-without-note refused → approve → badge + DB-stamped date, audit row `verification.approved`, cross-tenant write blocked; 0 unexpected console issues

## Feed automation — auto-posting real jobs ✅ (JSON path live)
- [x] `scripts/ingest-jobs.mjs` — fetches real listings from public APIs (Jobicy, Remotive, The Muse), deduplicates, age-limits (30 days = automatic expiry)
- [x] Currency-safe pay formatting (source currency kept — USD stays $, never falsely shown as ₹)
- [x] Merged into the site at build time via `src/data/feed-jobs.json` + store
- [x] Source attribution on every feed card ("via Jobicy") and on the detail page with original link
- [x] Local listings rank above feed listings at equal recency
- [x] Windows scheduling: `scripts/run-ingest.ps1` + schtasks command (documented in the file)
- [x] Cloud scheduling: `.github/workflows/ingest.yml` (daily cron + auto-commit → Vercel deploy)
- [x] Supabase sync path (code ready): set `VITE_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` and apply migrations, then `npm run ingest` upserts feed rows into `ladder_jobs` (`origin='feed'`, unique on `source_name,external_id`, 30-day `expires_at`)
- [ ] Optional India feed: `ADZUNA_APP_ID` + `ADZUNA_APP_KEY` (free at developers.adzuna.com)
- [ ] Optional: investigate The Muse 403 (currently skipped gracefully)

## Phase 6 — Job posting & discovery ✅
- [x] Post/edit/close job (employer) — `/post` gated (signed-out / seeker / admin / no-company → honest gate, never a fake form); real insert via `JobForm` → `ladder_jobs` with status never sent (DB forces `pending`)
- [x] Job moderation lock — migrations **0008** (attribution pin: browser inserts force `origin='employer'`, `published_at=now`, `views=0`; updates freeze provenance) + **0009** (`jobs_select` no longer self-references `ladder_owns_job(id)` — `INSERT … RETURNING` via PostgREST now works after the fix); employer can only move `unverified/rejected → pending`; admin/guest writers trusted
- [x] Close / re-submit — employer may close a live listing (or re-submit a rejected/draft); close removes from public board; editing content never touches moderation state
- [x] 10-level education ladder + experience filters + salary/work-mode/date filters — facets on the board (edu rungs incl. `10th`, exp `1–3`, pay `₹25,000+`, mode `remote`, `Last week`); board rows == facet counts (computed with the same matchers); unknown ≠ any for exp/pay/mode
- [x] Recommendation matching (skills/education/location) with visible reasons — `/me` recs score the live board against `ladder_candidate_skills` + `ladder_candidate_education` + profile city; chips: "Matches your skill: X", "Within your education", "In <city>"; ≥1 reason required; `MAX_RECS 6`
- [x] E2E test (`ladder_phase6_test.py`, 45 checks green): /post gates ×3, facets ×6, recs, real post → pending + pinned attribution, self-activation downgrade (insert `status='active'` stored `pending`), forged provenance pinned back, PATCH frozen, trusted activation → public board + company join, edit/close/resubmit cycle, foreign listing id → not-found, demo seed count = 38; 0 unexpected console issues
- [ ] Supabase service-role feed→DB sync (code ready — see Feed automation)

## Phase 7 — Application management ✅
- [x] Apply flow (seeker, duplicate prevention) — `/jobs/:id` Apply button + modal writes real `ladder_applications` row (status `applied`); duplicates refused, withdrawn rows replaceable
- [x] My Applications with stage tracking (Applied → Viewed → Shortlisted → Interview → Selected/Rejected/Withdrawn) — `/me/applications`; stage pill from shared `APPLICATION_STAGES` ladder; applicant may only withdraw
- [x] Employer applicant management + status updates — `/employer/applicants`; employer sees own jobs' applicants (fixed job-id filter bug during E2E), moves candidates through stages via `ladder_applications_lock_status`
- [x] Stage-move bugfix shipped — migration **0010** qualified the `id` column in the applications lock trigger's join (`column reference "id" is ambiguous` → employer stage moves now succeed, PATCH 400 → 204)
- [x] Notifications on status change (delivered in Phase 9)

## Phase 8 — Admin dashboard & moderation ✅
- [x] Admin overview, user management — overview with live counts; `/admin/users` lists accounts/roles (role elevation remains DB-only via `ladder_grant_admin()`)
- [x] Employer verification review (approve/reject) — shipped early in Phase 5 (`/admin/verifications`, audit rows written)
- [x] Job moderation (approve/reject/suspend) — shipped in Phase 8 (`/admin/jobs`; approve → `active`, reject → `rejected`, suspend → `closed`, each decision audited)
- [x] Reports review — shipped in Phase 8 (`/admin/reports`; open → reviewing → resolved/dismissed)
- [x] Category management, audit logs — `/admin/categories` (admin CRUD; migration **0011** adds admin write RLS/grants) and `/admin/audit` shipped

## Phase 9 — Notifications & regional languages
- [x] In-app notifications — employer stage moves now write a `ladder_notifications` row (type `application.stage`) to the applicant; seeker inbox at `/me/notifications` lists own notifications, marks read (`is_read`)
- [x] Language selector architecture: English / Telugu / Hindi — `src/lib/i18n.jsx` (context, `LANG_OPTIONS`, `t()` with English-source fallback, `isTranslated()`/`isFallback()`); header selector persists choice in localStorage
- [x] Translated content clearly marked vs original — key notification UI strings translated (Telugu/Hindi) and the inbox shows an honest "Translated" vs "Showing English (translation pending)" note when a non-English language is active; untranslated/fallback content stays in the English source rather than being presented as translated

## Phase 10 — Analytics & monetization infrastructure
- [x] DB-derived platform analytics (no invented numbers) — shipped in Phase 10 via `/admin/analytics` (live DB counts: active listings / pending moderation / applications / open reports; cross-checked in E2E)
- [ ] Free / Premium / Business plan structure (payment integration later, clearly configured) → **DECLINED**: no monetization — the platform will not take any money; payment integration explicitly out of scope. Only the `ladder_subscriptions` plan column exists DB-side, unused.

## Phase 11 — Security testing & production prep
- [x] RLS matrix tests per role — enforced + probed via migration locks and phase E2E attack suites
- [x] Unauthorized access attempts, file upload restrictions, rate limits — unauthorized probes + file upload restrictions covered by suites; client-side rate limiting added for sensitive actions (login/signup/apply) as best-effort UI hardening. For stronger enforcement, configure Supabase Auth rate limits / edge protections and (if needed) server-side quotas.
- [x] Responsive QA (mobile/tablet/desktop), error/empty states — responsive QA added (mobile 390px: no overflow on /, /jobs, /saved, /login, /post, /me, job detail)
- [x] Environment + deployment docs (Vercel), migration instructions — `docs/deployment.md` + `supabase/README.md`

---

### Open items / missing configuration
- [x] Supabase access for migrations: Supabase CLI login **or** paste SQL in Dashboard SQL Editor (see `supabase/README.md`)
- [x] Admin account bootstrap: run `ladder_grant_admin('<email>')` in SQL Editor after first signup
- [x] Apply migration **0011** (`0011_admin_categories_and_user_view.sql`) to the live project (applied via `supabase db push`) — enables admin category writes
- [ ] Vercel deployment: add `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` env vars and deploy/run post-deploy smoke per `docs/deployment.md` (not performed here; Vercel project not linked in repo)
- [ ] Feed→DB runtime sync: set/uncomment a valid `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (service key, never `VITE_`) and run `npm run ingest`/scheduler to upsert feed rows into `ladder_jobs` (JSON feed refreshed; DB sync skipped because key is commented out)
- [ ] Optional: configure Supabase Auth/server-side rate limits for stronger abuse protection beyond client-side guards
- [ ] Optional India feed: `ADZUNA_APP_ID` + `ADZUNA_APP_KEY`; investigate The Muse 403 if needed
