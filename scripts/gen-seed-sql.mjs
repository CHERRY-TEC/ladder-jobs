#!/usr/bin/env node
/**
 * Generates supabase/migrations/0004_demo_seed.sql FROM src/data/seed.js
 * so the database demo rows can never drift from what the app ships.
 *
 * Run: node scripts/gen-seed-sql.mjs
 *
 * Notes:
 *  - IDs are deterministic (UUIDv5 of the seed id), so re-running upserts
 *    instead of duplicating.
 *  - Category slugs match the feed ingestor exactly:
 *    household, trades, internship, office, professional, gigs.
 *  - Education mapping (site 4-level → DB 10-level ladder):
 *      none → no_formal, diploma → diploma, graduate → graduate, any → any
 */

import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SEED_JOBS, CATEGORIES } from '../src/data/seed.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'supabase', 'migrations', '0004_demo_seed.sql')

/* Deterministic UUIDv5 (URL namespace) so seeds are idempotent. */
const URL_NS = '6ba7b811-9dad-11d1-80b4-00c04fd430c8'
import { createHash } from 'node:crypto'
function uuidv5(name) {
  const hash = createHash('sha1').update(URL_NS + name).digest()
  const b = [...hash.subarray(0, 16)]
  b[6] = (b[6] & 0x0f) | 0x50 // version 5
  b[8] = (b[8] & 0x3f) | 0x80 // RFC 4122 variant
  const hex = b.map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

const q = (s) => (s === null || s === undefined ? 'null' : `'${String(s).replace(/'/g, "''")}'`)
const arr = (a) =>
  !a || a.length === 0
    ? "'{}'"
    : `array[${a.map((s) => q(s)).join(', ')}]::text[]`

const EDU_MAP = {
  none: 'no_formal',
  diploma: 'diploma',
  graduate: 'graduate',
  any: 'any',
}

function locationFields(location) {
  const label = location
  const hybrid = /\(hybrid\)/i.test(location)
  const remote = /remote/i.test(location) && !hybrid
  const city = label.replace(/\s*\([^)]*\)/g, '').trim()
  return {
    location_label: q(label),
    work_mode: q(hybrid ? 'hybrid' : remote ? 'remote' : 'onsite'),
    is_remote: remote ? 'true' : 'false',
    city: remote ? 'null' : q(city),
  }
}

/* ------------------------------------------------------------------ categories */
const catRows = Object.entries(CATEGORIES).map(([slug, c], i) => {
  const id = uuidv5(`cat:${slug}`)
  return `  (${q(id)}, ${q(c.label)}, ${q(slug)}, ${i * 10})`
})

/* ----------------------------------------------------------------------- jobs */
const now = Date.now()
const jobRows = SEED_JOBS.map((job) => {
  const id = uuidv5(`job:${job.id}`)
  const loc = locationFields(job.location)
  const published = new Date(now - (job.daysAgo ?? 0) * 86_400_000).toISOString()
  const contact = job.contact ?? {}
  return `  (
    ${q(id)},
    ${q(uuidv5(`cat:${job.category}`))},
    ${q(job.org)},
    ${q(job.title)},
    ${q(job.summary)},
    ${arr(job.duties)},
    ${arr(job.requirements)},
    ${q(job.type)},
    ${loc.work_mode},
    ${q(EDU_MAP[job.education] ?? 'any')},
    ${job.salaryMin != null ? String(job.salaryMin) : 'null'},
    ${q(job.salary)},
    'INR',
    ${loc.location_label},
    ${loc.is_remote},
    ${loc.city},
    ${q(contact.kind)},
    ${q(contact.value)},
    ${q(contact.label)},
    ${q(published)},
    'active',
    'demo',
    null,
    null
  )`
})

const lines = [
  '-- ============================================================================',
  '-- Ladder 2.0 — 0004 demo seed',
  '-- GENERATED from src/data/seed.js by scripts/gen-seed-sql.mjs — do not edit',
  '-- by hand; edit the seed data and regenerate. Idempotent (deterministic IDs).',
  '-- Demo rows: origin = demo, status = active, labelled as sample data in-app.',
  '-- Run AFTER 0001 + 0002 + 0003.',
  '-- ============================================================================',
  '',
  '-- Keep demo rows in sync with the app seed (safe: demo rows are not applied to).',
  "delete from ladder_jobs where origin = 'demo' and external_id is null;",
  '',
  'insert into ladder_job_categories (id, name, slug, sort_order) values',
  catRows.join(',\n'),
  'on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;',
  '',
  '-- Demo listings (sample data — contact details are placeholders).',
  'insert into ladder_jobs (',
  '  id, category_id, org_name, title, summary, duties, requirements,',
  "  job_type, work_mode, education_required,",
  '  salary_min, salary_label, currency,',
  '  location_label, is_remote, city,',
  '  contact_kind, contact_value, contact_label,',
  "  published_at, status, origin, employer_id, external_id",
  ') values',
  jobRows.join(',\n'),
  'on conflict (id) do update set',
  '  title = excluded.title, summary = excluded.summary,',
  '  salary_label = excluded.salary_label, published_at = excluded.published_at,',
  "  status = 'active';",
  '',
  '-- Demo categories must match scripts/ingest-jobs.mjs slugs:',
  '--   household, trades, internship, office, professional, gigs',
  '',
]

await writeFile(OUT, `${lines.join('\n')}`, 'utf8')
console.log(`Wrote ${OUT} (${SEED_JOBS.length} jobs, ${Object.keys(CATEGORIES).length} categories)`)
