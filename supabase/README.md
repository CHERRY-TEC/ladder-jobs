# KAAMVORI — Supabase migrations

Shared project: **every KAAMVORI table/bucket is prefixed `ladder_`** so it never
collides with other apps in this database. (Prefix kept for schema compatibility.)

## Apply the migrations

**Option A — SQL Editor (no CLI login needed):**
1. Open <https://supabase.com/dashboard/project/cabvhwousbdkmfzisfin/sql/new>
2. Run the files **in order**, one at a time:

   | # | File | What it does |
   |---|------|--------------|
   | 1 | `migrations/0001_ladder_schema.sql` | 20 tables, checks, indexes, triggers, admin bootstrap fn |
   | 2 | `migrations/0002_rls.sql` | Row-level-security policies + per-table grants |
   | 3 | `migrations/0003_storage.sql` | 4 storage buckets + object policies |
   | 4 | `migrations/0004_demo_seed.sql` | 6 categories + 38 demo listings (generated) |
   | … | `migrations/0005–0011*.sql` | Verification/jobs/applications hardening, moderation/analytics support, and admin category write policies (apply in order through head) |

**Option B — CLI (after `supabase login`):**

```powershell
supabase db push
```

## Admin bootstrap (one-time)

1. Start the app (`npm run dev`), open `/signup`, create the account you want
   as admin (any role — the role gets overwritten in step 2).
2. In the SQL Editor run:

   ```sql
   select ladder_grant_admin('you@example.com');
   ```

   ⚠️ Self-signup can **never** produce an admin: the signup trigger only
   allows `seeker`/`employer`, and this function is executable by
   `service_role`/`postgres` only.

## Security properties (enforced in the database, not just the UI)

- Employers cannot activate their own jobs (status locked to `pending`;
  admin moderation moves it to `active`).
- Employers cannot self-verify — only `ladder_is_admin()` writes `verified`.
- Applicants may only set their application to `withdrawn`; the job's owner
  controls all other stage transitions; admins can always act.
- One application per (job, seeker); withdrawn rows can be re-applied.
- Resumes/verification docs live in private buckets under `<uid>/<filename>`.
  Employers can read only resumes attached to applications on their own jobs.
- No `service_role` key in the frontend — it exists only in `.env.local`
  (no `VITE_` prefix) for `scripts/ingest-jobs.mjs`.

## Verifying it worked

```sql
select count(*) from ladder_jobs;            -- expect 38 after seed
select slug, name from ladder_job_categories order by sort_order;
select ladder_my_role();                      -- null in SQL editor (no JWT)
```

In the app: `/browse` should still show 98 rows (60 feed + 38 demo) — the
frontend currently reads its own data; DB-backed reads land in a later phase.

## Regenerating the seed

`0004_demo_seed.sql` is **generated** from `src/data/seed.js` so demo data
never drifts between the app and the database:

```powershell
node scripts/gen-seed-sql.mjs   # rewrite 0004
node scripts/check-sql.mjs      # structural sanity check on all 4 files
```

## Feed jobs → database

With `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set in `.env.local` **and** migrations applied,
`npm run ingest` upserts feed rows into `ladder_jobs`
(`origin='feed'`, unique on `source_name, external_id`, 30-day `expires_at`).
It always writes `src/data/feed-jobs.json` as well — the site can still render the merged feed even if DB sync is unavailable.
