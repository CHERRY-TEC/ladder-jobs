# Ladder — deployment (Vercel) & operations

## Frontend (Vercel)

- Framework preset: **Vite** (build output in `dist/`).
- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`

Environment variables (Project → Settings → Environment Variables):

| Var | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL, e.g. `https://cabvhwousbdkmfzisfin.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase **anon** key (safe for browser; RLS enforces everything) |

⚠️ Never put the `service_role` key (`SUPABASE_SERVICE_ROLE_KEY`) in the frontend.
It is only read by `scripts/ingest-jobs.mjs` via `.env.local` (non-`VITE_` prefixed).

## Database (Supabase)

- Shared project: `cabvhwousbdkmfzisfin`.
- Migrations applied via CLI (`supabase db push`) — files in `supabase/migrations/`.
- Current head in repo/live: `0011_admin_categories_and_user_view.sql` applied (admin category write RLS/grants) — `/admin/categories` writes enabled when migrations are current.
- Admin bootstrap: `select ladder_grant_admin('<admin email>');` from the SQL Editor
  (or Management API `POST /v1/projects/cabvhwousbdkmfzisfin/database/query`).
- `mailer_autoconfirm` is off; test accounts are Gmail-addressed, password
  `LadderTest!2026`.

## Post-deploy smoke

1. `npm run build` passes; preview serves `dist/`.
2. Home loads, board renders seeded rows.
3. Sign in as employer → post → admin approves → seekers see the listing.
4. Seeker applies → employer moves stage → seeker sees notification + stage.
5. Admin: `/admin/jobs`, `/admin/reports`, `/admin/audit`, `/admin/analytics` all gated to admin.

## Known operational notes

- Backend status is probed (`probeBackend`) and surfaces honest db-notices
  (unconfigured / missing / error) instead of faked data.
- Feed automation: `scripts/ingest-jobs.mjs` writes `src/data/feed-jobs.json` and, when `VITE_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set and migrations applied, upserts feed rows into `ladder_jobs` (`origin='feed'`).
- Sensitive actions (login/signup/apply) have client-side rate limiting as best-effort UI hardening; configure Supabase Auth/server-side limits for stronger abuse protection.
- E2E suites live in `/tmp/opencode/ladder_*_test.py` (Playwright) — not shipped in
  the repo; re-create from the phase history when re-running.
