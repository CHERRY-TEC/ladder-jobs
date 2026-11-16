import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs/promises'
import path from 'node:path'

async function loadEnv() {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), '.env.local'), 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
      if (!m || process.env[m[1]]) continue
      let v = m[2]
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      process.env[m[1]] = v
    }
  } catch {}
}

await loadEnv()

const root = process.cwd()
const dist = path.join(root, 'dist')
const templatePath = path.join(dist, 'index.html')
const site = 'https://kaamvori.vercel.app'

function esc(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function strip(s = '') {
  return String(s).replace(/\s+/g, ' ').trim()
}

async function main() {
  let template
  try {
    template = await fs.readFile(templatePath, 'utf8')
  } catch {
    console.log('prerender: dist/index.html not found, skipping')
    return
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    console.log('prerender: Supabase env vars missing, skipping job page prerender')
    return
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } })
  const { data: jobs, error } = await supabase
    .from('ladder_jobs')
    .select('id,title,summary,job_type,education_required,experience_required,work_mode,city,state,location_label,salary_label,org_name,published_at,updated_at,created_at,contact_label,source_name,ladder_employers(company_name)')
    .eq('status', 'active')
    .order('published_at', { ascending: false })
    .limit(1000)

  if (error || !Array.isArray(jobs)) {
    console.log('prerender: could not fetch jobs', error?.message || '')
    return
  }

  let count = 0
  for (const job of jobs) {
    const org = job.ladder_employers?.company_name || job.org_name || 'Employer'
    const loc = [job.city, job.state].filter(Boolean).join(', ') || job.location_label || 'India'
    const title = `${strip(job.title)} at ${strip(org)} — ${strip(loc)} | KAAMVORI`
    const desc = strip(`${job.title} at ${org} in ${loc}. ${job.job_type || 'Job'} vacancy${job.education_required ? `, education: ${job.education_required}` : ''}. ${job.summary || ''}`).slice(0, 160)
    const pageUrl = `${site}/jobs/${job.id}`
    const datePosted = (job.published_at || job.created_at || '').slice(0, 10) || undefined

    const ld = {
      '@context': 'https://schema.org',
      '@type': 'JobPosting',
      title: strip(job.title),
      description: strip(job.summary || ''),
      datePosted,
      employmentType: job.job_type || undefined,
      hiringOrganization: { '@type': 'Organization', name: strip(org) },
      jobLocation: { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: strip(loc), addressCountry: 'IN' } },
    }

    let html = template
    html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(title)}</title>`)
    html = html.replace(/<meta\s+name="description"[\s\S]*?>/i, `<meta name="description" content="${esc(desc)}" />`)
    html = html.replace(/<link\s+rel="canonical"[\s\S]*?>/i, `<link rel="canonical" href="${pageUrl}" />`)
    html = html.replace(/<meta\s+property="og:title"[\s\S]*?>/i, `<meta property="og:title" content="${esc(title)}" />`)
    html = html.replace(/<meta\s+property="og:description"[\s\S]*?>/i, `<meta property="og:description" content="${esc(desc)}" />`)
    html = html.replace(/<meta\s+property="og:url"[\s\S]*?>/i, `<meta property="og:url" content="${pageUrl}" />`)
    html = html.replace(/<meta\s+name="twitter:title"[\s\S]*?>/i, `<meta name="twitter:title" content="${esc(title)}" />`)
    html = html.replace(/<meta\s+name="twitter:description"[\s\S]*?>/i, `<meta name="twitter:description" content="${esc(desc)}" />`)

    const ldTag = `<script type="application/ld+json">${JSON.stringify(ld)}</script>`
    html = html.replace('</head>', `    ${ldTag}\n  </head>`)

    const body = `<main style="max-width:800px;margin:0 auto;padding:24px;font-family:system-ui,sans-serif;line-height:1.5">` +
      `<p><a href="/">KAAMVORI</a> · Job vacancy</p>` +
      `<h1>${esc(strip(job.title))}</h1>` +
      `<p><strong>${esc(strip(org))}</strong> · ${esc(strip(loc))}</p>` +
      `<p><strong>Type:</strong> ${esc(strip(job.job_type || 'Job'))}` +
      `${job.education_required ? ` · <strong>Education:</strong> ${esc(strip(job.education_required))}` : ''}` +
      `${job.salary_label ? ` · <strong>Pay:</strong> ${esc(strip(job.salary_label))}` : ''}</p>` +
      `<p>${esc(strip(job.summary || ''))}</p>` +
      `<p><a href="${pageUrl}">View and apply on KAAMVORI</a></p>` +
      `</main>`

    html = html.replace('<div id="root"></div>', `<div id="root">${body}</div>`)

    const dir = path.join(dist, 'jobs', job.id)
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(path.join(dir, 'index.html'), html, 'utf8')
    count++
  }

  console.log(`prerender: generated ${count} job pages`)
}

main().catch((e) => {
  console.log('prerender: failed', e?.message || e)
})
