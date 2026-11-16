#!/usr/bin/env node
/**
 * Ladder job-feed ingestion.
 *
 * Fetches REAL listings from public job APIs, normalises them, deduplicates,
 * and writes src/data/feed-jobs.json (merged into the site at build time).
 *
 * If VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are configured, it ALSO
 * upserts rows into the ladder_jobs table (requires migrations applied —
 * see supabase/README.md). The service key is read from .env.local and is
 * NEVER bundled into the frontend (no VITE_ prefix).
 *
 * Sources (no key required):
 *   - Jobicy    https://jobicy.com/api/v2/remote-jobs
 *   - Remotive  https://remotive.com/api/remote-jobs
 *   - The Muse  https://www.themuse.com/api/public/jobs
 * Optional India feed (free key: https://developers.adzuna.com):
 *   - Adzuna India  via ADZUNA_APP_ID + ADZUNA_APP_KEY
 *
 * Every ingested listing keeps its source name + original URL so the site
 * can attribute it — feed jobs are never presented as local vacancies.
 */

import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_FILE = path.join(ROOT, 'src', 'data', 'feed-jobs.json')
const STATE_FILE = path.join(ROOT, 'scripts', '.ingest-state.json')

const MAX_JOBS = 60
const MAX_AGE_DAYS = 30
const FETCH_TIMEOUT_MS = 15000

/* ------------------------------------------------------------------ env -- */

async function loadEnvLocal() {
  try {
    const text = await readFile(path.join(ROOT, '.env.local'), 'utf8')
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
      if (!m) continue
      const key = m[1]
      const value = m[2].replace(/^["']|["']$/g, '')
      if (value && !(key in process.env)) process.env[key] = value
    }
  } catch {
    /* no .env.local yet — that's fine */
  }
}

/* ----------------------------------------------------------------- util -- */

async function fetchJson(url, headers = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'LadderJobFeed/1.0 (+https://ladder.example)', ...headers },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

const ENTITIES = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
  ndash: '–', mdash: '—', hellip: '…', middot: '·', copy: '©',
}

function stripHtml(html = '') {
  return String(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(Number(num)))
    .replace(/&([a-z]+);/gi, (match, name) => ENTITIES[name.toLowerCase()] ?? ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function truncate(text, max = 600) {
  if (text.length <= max) return text
  return `${text.slice(0, max - 1).trimEnd()}…`
}

function parseDate(value) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

const CURRENCY_SYMBOLS = { USD: '$', EUR: '€', GBP: '£', INR: '₹', CAD: 'C$', AUD: 'A$' }

/** Formats money in the SOURCE's currency — never assume INR. */
function money(amount, currency) {
  const locale = currency === 'INR' ? 'en-IN' : 'en-US'
  const number = Math.round(amount).toLocaleString(locale)
  const symbol = CURRENCY_SYMBOLS[currency]
  if (symbol) return `${symbol}${number}`
  if (currency) return `${number} ${currency}`
  return number
}

const slug = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

function hashId(...parts) {
  return createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 16)
}

/* ------------------------------------------------------- normalisation -- */

function mapCategory(title, tags = []) {
  const s = `${title} ${tags.join(' ')}`.toLowerCase()
  if (/\bintern(ship)?\b/.test(s)) return 'internship'
  if (/\b(housekeep|cleaner|cleaning|cook|driver|babysit|gardener|security guard|watchman|tailor)\b/.test(s))
    return 'household'
  if (/\b(electrician|plumber|carpenter|mechanic|welder|ac technician|painter|technician)\b/.test(s))
    return 'trades'
  if (/\b(delivery|rider|warehouse|packer|helper|loader)\b/.test(s)) return 'gigs'
  if (/\b(data entry|receptionist|office|administrat|clerical|customer support|back.?office|sales executive)\b/.test(s))
    return 'office'
  return 'professional'
}

function mapType(sourceType = '') {
  const t = String(sourceType).toLowerCase()
  if (t.includes('intern')) return 'Internship'
  if (t.includes('part')) return 'Part-time'
  if (t.includes('contract') || t.includes('freelance') || t.includes('temporary')) return 'Contract'
  return 'Full-time'
}

/** Monthly-equivalent pay for fair sorting (currency left as the source gave it). */
function monthlyEquivalent(min, period) {
  if (!min) return 0
  if (period === 'year') return Math.round(min / 12)
  if (period === 'day') return min * 26
  return Math.round(min)
}

/**
 * Builds the final job object. `education` is always 'any' for feed jobs
 * unless the source states a requirement — we never invent requirements.
 */
function normalise(raw, source) {
  const url = raw.url
  const title = stripHtml(raw.title)
  const org = stripHtml(raw.org)
  if (!url || !title || !org) return null

  const postedAt = raw.postedAt
  const ageDays = (Date.now() - postedAt.getTime()) / 86_400_000
  if (ageDays > MAX_AGE_DAYS) return null

  const category = mapCategory(title, raw.tags ?? [])
  const type = raw.jobType ? mapType(raw.jobType) : 'Full-time'
  const location = raw.isRemote ? 'Remote' : (raw.location?.trim() || 'Remote')
  const rawPeriod = String(raw.salaryPeriod ?? '')
  const period = /^(year|annual)/i.test(rawPeriod)
    ? 'year'
    : /^day/i.test(rawPeriod)
      ? 'day'
      : raw.salaryPeriod ?? null
  const salaryMinMonthly = monthlyEquivalent(raw.salaryMin, period)

  let salary = raw.salaryLabel?.trim() || ''
  if (!salary && raw.salaryMin) {
    const per = period === 'year' ? ' / year' : period === 'day' ? ' / day' : ''
    const min = money(raw.salaryMin, raw.salaryCurrency)
    const max =
      raw.salaryMax && raw.salaryMax !== raw.salaryMin
        ? money(raw.salaryMax, raw.salaryCurrency)
        : null
    salary = max ? `${min} – ${max}${per}` : `${min}${per}`
  }
  if (!salary) salary = 'Pay not specified by source'

  const summary = truncate(stripHtml(raw.summary) || `Listing from ${source.name}.`)

  return {
    id: `f-${source.id}-${hashId(url)}`,
    title,
    org,
    category,
    type,
    education: 'any', // source does not state a requirement
    location,
    salary,
    salaryMin: salaryMinMonthly,
    summary,
    duties: [],
    requirements: [],
    contact: { kind: 'link', value: url, label: `Apply on ${source.name}` },
    postedAt: postedAt.toISOString(),
    source: source.name,
    sourceUrl: url,
    origin: 'feed',
  }
}

/* ------------------------------------------------------------- sources -- */

const sources = [
  {
    id: 'jobicy',
    name: 'Jobicy',
    async fetch() {
      const data = await fetchJson('https://jobicy.com/api/v2/remote-jobs?count=50')
      return (data?.jobs ?? []).map((j) => ({
        externalId: String(j.id ?? ''),
        url: j.url,
        title: j.jobTitle,
        org: j.companyName,
        isRemote: true,
        location: j.jobGeo || 'Remote',
        jobType: j.jobType,
        summary: j.jobExcerpt || j.jobDescription,
        postedAt: parseDate(j.pubDate),
        salaryMin: Number(j.salaryMin) || null,
        salaryMax: Number(j.salaryMax) || null,
        salaryCurrency: j.salaryCurrency || null,
        salaryPeriod: j.salaryPeriod || null,
        tags: [j.jobIndustry, j.jobLevel].flat().filter(Boolean),
      }))
    },
  },
  {
    id: 'remotive',
    name: 'Remotive',
    async fetch() {
      const data = await fetchJson('https://remotive.com/api/remote-jobs?limit=50')
      return (data?.jobs ?? []).map((j) => ({
        externalId: String(j.id ?? ''),
        url: j.url,
        title: j.title,
        org: j.company_name,
        isRemote: true,
        location: j.candidate_required_location || 'Remote',
        jobType: j.job_type,
        summary: j.description,
        postedAt: parseDate(j.publication_date),
        salaryLabel: /not disclosed|n\/a/i.test(j.salary ?? '') ? '' : j.salary || '',
        tags: [j.category].filter(Boolean),
      }))
    },
  },
  {
    id: 'muse',
    name: 'The Muse',
    async fetch() {
      const data = await fetchJson(
        'https://www.themuse.com/api/public/jobs?page=1&results_per_page=20',
      )
      return (data?.results ?? []).map((j) => ({
        externalId: String(j.id ?? ''),
        url: j.refs?.landing_page || j.url,
        title: j.name,
        org: j.company?.name || j.contents?.split(' ')[0],
        isRemote: /remote/i.test(j.locations?.map((l) => l.name).join(' ') ?? ''),
        location: j.locations?.map((l) => l.name).join(', '),
        jobType: j.type,
        summary: j.contents,
        postedAt: parseDate(j.publication_date),
        tags: (j.categories ?? []).map((c) => c.name),
      }))
    },
  },
  {
    id: 'adzuna-in',
    name: 'Adzuna India',
    optional: true,
    async fetch() {
      const appId = process.env.ADZUNA_APP_ID
      const appKey = process.env.ADZUNA_APP_KEY
      if (!appId || !appKey) {
        console.log('  · Adzuna India skipped (set ADZUNA_APP_ID + ADZUNA_APP_KEY to enable)')
        return []
      }
      const url =
        `https://api.adzuna.com/v1/api/jobs/in/search/1?app_id=${appId}` +
        `&app_key=${appKey}&results_per_page=50&sort=date`
      const data = await fetchJson(url)
      return (data?.results ?? []).map((j) => ({
        externalId: String(j.id ?? ''),
        url: j.redirect_url,
        title: j.title,
        org: j.company?.display_name,
        isRemote: false,
        location: j.location?.display_name,
        jobType: j.contract_time || '',
        summary: j.description,
        postedAt: parseDate(j.created),
        salaryMin: Number(j.salary_min) || null,
        salaryMax: Number(j.salary_max) || null,
        salaryCurrency: 'INR',
        salaryPeriod: 'year',
        tags: [j.category?.label].filter(Boolean),
      }))
    },
  },
]

/* ------------------------------------------------------------ supabase -- */

async function upsertToSupabase(jobs) {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.log(
      '[supabase] DB sync skipped — set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local ' +
        '(and apply migrations, including 0001–0010/0011 as needed) to upsert feed jobs into ladder_jobs.',
    )
    return
  }

  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=minimal',
  }

  try {
    // Map category slugs to ids (tables created by supabase/migrations).
    const catRes = await fetch(`${url}/rest/v1/ladder_job_categories?select=id,slug`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    })
    if (!catRes.ok) {
      const body = (await catRes.text()).slice(0, 300)
      throw new Error(`categories query failed (HTTP ${catRes.status}) — migrations not applied or service key invalid? ${body}`)
    }
    const catMap = new Map((await catRes.json()).map((c) => [c.slug, c.id]))

    const rows = jobs.map((j) => ({
      title: j.title,
      org_name: j.org,
      category_id: catMap.get(j.category) ?? null,
      summary: j.summary,
      job_type: j.type,
      education_required: j.education,
      work_mode: /remote/i.test(j.location) ? 'remote' : 'onsite',
      location_label: j.location,
      is_remote: /remote/i.test(j.location),
      salary_min: j.salaryMin || null,
      salary_label: j.salary,
      status: 'active',
      origin: 'feed',
      source_name: j.source,
      source_url: j.sourceUrl,
      external_id: j.id.replace(/^f-/, ''),
      published_at: j.postedAt,
      expires_at: new Date(Date.parse(j.postedAt) + MAX_AGE_DAYS * 86_400_000).toISOString(),
    }))

    const res = await fetch(`${url}/rest/v1/ladder_jobs?on_conflict=source_name,external_id`, {
      method: 'POST',
      headers,
      body: JSON.stringify(rows),
    })
    if (!res.ok) {
      const body = (await res.text()).slice(0, 300)
      throw new Error(`upsert failed (HTTP ${res.status}): ${body}`)
    }
    console.log(`[supabase] upserted ${rows.length} feed jobs into ladder_jobs (origin=feed, deduped by source_name+external_id)`)
  } catch (err) {
    console.error(`[supabase] sync failed: ${err.message}`)
    console.error('[supabase] JSON feed was still written — the site keeps working from it.')
  }
}

/* ----------------------------------------------------------------- main -- */

async function main() {
  await loadEnvLocal()
  console.log('Ladder feed ingest — fetching sources…')

  const collected = []
  const seen = new Set()
  const summary = {}

  for (const source of sources) {
    try {
      const rawJobs = await source.fetch()
      let accepted = 0
      for (const raw of rawJobs) {
        const job = normalise(raw, source)
        if (!job) continue
        const key = job.sourceUrl || `${source.id}|${raw.externalId}`
        if (seen.has(key)) continue
        seen.add(key)
        collected.push(job)
        accepted += 1
      }
      summary[source.name] = accepted
      console.log(`  ✓ ${source.name}: ${rawJobs.length} fetched, ${accepted} usable`)
    } catch (err) {
      summary[source.name] = `failed: ${err.message}`
      console.error(`  ✗ ${source.name}: ${err.message}`)
    }
  }

  collected.sort((a, b) => Date.parse(b.postedAt) - Date.parse(a.postedAt))
  const jobs = collected.slice(0, MAX_JOBS)

  const payload = { generatedAt: new Date().toISOString(), jobs }
  await writeFile(OUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')

  let previousUrls = new Set()
  try {
    const prev = JSON.parse(await readFile(STATE_FILE, 'utf8'))
    previousUrls = new Set(prev.urls ?? [])
  } catch {
    /* first run */
  }
  const newSince = jobs.filter((j) => !previousUrls.has(j.sourceUrl)).length
  await writeFile(
    STATE_FILE,
    `${JSON.stringify({ lastRun: payload.generatedAt, urls: jobs.map((j) => j.sourceUrl) }, null, 2)}\n`,
    'utf8',
  )

  console.log(
    `\nDone: ${jobs.length} listings written (${newSince} new since last run) → src/data/feed-jobs.json`,
  )
  if (collected.length === 0) {
    console.warn(
      'WARNING: no feed jobs fetched — check internet access. The site keeps the previous/demo listings.',
    )
    process.exitCode = 1
  }

  await upsertToSupabase(jobs)
}

main().catch((err) => {
  console.error(`Ingest failed: ${err.message}`)
  process.exitCode = 1
})
