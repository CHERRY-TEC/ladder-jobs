import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import FilterPanel from '../components/FilterPanel.jsx'
import JobRow from '../components/JobRow.jsx'
import JobCard from '../components/JobCard.jsx'
import StairNav from '../components/StairNav.jsx'
import { CATEGORIES } from '../data/seed.js'
import { useStore } from '../lib/store.jsx'
import {
  matchesEducation,
  matchesExperience,
  matchesLocation,
  matchesMode,
  matchesPay,
  matchesQuery,
  matchesWhen,
} from '../lib/format.js'
import { EDU_PRESETS } from '../data/ladder.js'

function groupJobs(jobs, group) {
  if (group === 'category') {
    const map = new Map()
    for (const job of jobs) {
      const key = job.category || 'other'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(job)
    }
    return [...map.entries()]
      .sort((a, b) => (CATEGORIES[a[0]]?.label || a[0]).localeCompare(CATEGORIES[b[0]]?.label || b[0]))
      .map(([key, items]) => ({ key, label: CATEGORIES[key]?.label || 'Other', items }))
  }
  if (group === 'location') {
    const map = new Map()
    for (const job of jobs) {
      const key = (job.location || 'Unknown').split('·')[0].trim() || 'Unknown'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(job)
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, items]) => ({ key, label: key, items }))
  }
  return [{ key: 'all', label: null, items: jobs }]
}

export default function Home() {
  const { jobs } = useStore()
  const [params, setParams] = useSearchParams()
  const [keyword, setKeyword] = useState(() => params.get('q') ?? '')
  const [place, setPlace] = useState(() => params.get('loc') ?? '')

  const q = params.get('q') ?? ''
  const loc = params.get('loc') ?? ''
  const edu = params.get('edu') ?? ''
  const type = params.get('type') ?? ''
  const exp = params.get('exp') ?? ''
  const pay = params.get('pay') ?? ''
  const mode = params.get('mode') ?? ''
  const when = params.get('when') ?? ''
  const sort = params.get('sort') ?? 'newest'
  const view = params.get('view') === 'list' ? 'list' : 'grid'
  const group = ['category', 'location'].includes(params.get('group')) ? params.get('group') : 'none'
  const cats = params.get('cat')?.split(',').filter(Boolean) ?? []

  const setParam = (key, value) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )

  const toggleCat = (id) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        const current = (next.get('cat') ?? '').split(',').filter(Boolean)
        const updated = current.includes(id) ? current.filter((c) => c !== id) : [...current, id]
        if (updated.length) next.set('cat', updated.join(','))
        else next.delete('cat')
        return next
      },
      { replace: true },
    )

  const clearFilters = () => {
    setKeyword('')
    setPlace('')
    setParams(new URLSearchParams(), { replace: true })
  }

  const scrollToBrowse = () => {
    requestAnimationFrame(() =>
      document.getElementById('browse')?.scrollIntoView({ block: 'start' }),
    )
  }

  const runSearch = (e) => {
    e.preventDefault()
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (keyword.trim()) next.set('q', keyword.trim())
        else next.delete('q')
        if (place.trim()) next.set('loc', place.trim())
        else next.delete('loc')
        return next
      },
      { replace: true },
    )
    scrollToBrowse()
  }

  const pickRung = (id) => {
    setParam('edu', edu === id ? '' : id)
    scrollToBrowse()
  }

  const filtered = useMemo(() => {
    const list = jobs.filter(
      (job) =>
        matchesQuery(job, q) &&
        matchesLocation(job, loc) &&
        matchesEducation(job, edu) &&
        matchesExperience(job, exp) &&
        matchesPay(job, pay) &&
        matchesMode(job, mode) &&
        matchesWhen(job, when) &&
        (cats.length === 0 || cats.includes(job.category)) &&
        (!type || job.type === type),
    )
    return list.sort((a, b) => {
      if (sort === 'pay') return (b.salaryMin ?? 0) - (a.salaryMin ?? 0)
      if (sort === 'pay_low') return (a.salaryMin ?? Number.POSITIVE_INFINITY) - (b.salaryMin ?? Number.POSITIVE_INFINITY)
      if (sort === 'title') return a.title.localeCompare(b.title)
      if (sort === 'title_desc') return b.title.localeCompare(a.title)
      if (sort === 'oldest') {
        const localRank = (j) => (j.origin === 'feed' ? 1 : 0)
        return b.daysAgo - a.daysAgo || localRank(a) - localRank(b)
      }
      const localRank = (j) => (j.origin === 'feed' ? 1 : 0)
      return a.daysAgo - b.daysAgo || localRank(a) - localRank(b)
    })
  }, [jobs, q, loc, edu, exp, pay, mode, when, cats, type, sort])

  const grouped = useMemo(() => groupJobs(filtered, group), [filtered, group])

  const stairCounts = useMemo(() => {
    const counts = {}
    for (const preset of EDU_PRESETS) {
      counts[preset.id] = jobs.filter((j) => matchesEducation(j, preset.id)).length
    }
    return counts
  }, [jobs])

  const stats = useMemo(() => {
    const noDegree = jobs.filter((j) => matchesEducation(j, 'none')).length
    const interns = jobs.filter((j) => j.category === 'internship').length
    const today = jobs.filter((j) => (j.daysAgo ?? 0) === 0).length
    return [
      { value: jobs.length, label: 'Open listings' },
      { value: noDegree, label: 'No degree needed' },
      { value: interns, label: 'Internships' },
      { value: today, label: 'Posted today' },
    ]
  }, [jobs])

  const freshJobs = useMemo(() => filtered.filter((j) => (j.daysAgo ?? 99) <= 2).slice(0, 6), [filtered])
  const categoryCounts = useMemo(
    () =>
      Object.entries(CATEGORIES).map(([id, meta]) => ({
        id,
        label: meta.label,
        count: jobs.filter((j) => j.category === id).length,
      })),
    [jobs],
  )

  const hasQuery = q || loc || edu || exp || pay || mode || when || type || cats.length > 0
  const Item = view === 'grid' ? JobCard : JobRow

  useEffect(() => {
    document.title = 'KAAMVORI — Job Vacancies, Internships & Jobs for 10th Pass and All Levels'
    const desc = 'Find job vacancies, internships and work opportunities for 10th pass, below 10th, 12th, ITI, diploma, graduates and all education levels on KAAMVORI.'
    let meta = document.querySelector('meta[name="description"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.setAttribute('name', 'description')
      document.head.appendChild(meta)
    }
    meta.setAttribute('content', desc)

    const ld = {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'KAAMVORI',
      url: 'https://kaamvori.vercel.app/',
      description: desc,
      potentialAction: {
        '@type': 'SearchAction',
        target: 'https://kaamvori.vercel.app/?q={search_term_string}',
        'query-input': 'required name=search_term_string',
      },
    }
    const id = 'website-jsonld'
    let script = document.getElementById(id)
    if (!script) {
      script = document.createElement('script')
      script.id = id
      script.type = 'application/ld+json'
      document.head.appendChild(script)
    }
    script.textContent = JSON.stringify(ld)
    return () => {
      const s = document.getElementById(id)
      if (s) s.remove()
    }
  }, [])

  return (
    <>
      {/* Hero */}
      <section className="border-b border-line bg-gradient-to-b from-white to-[#f3efe7]">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16 lg:py-20">
          <div className="grid items-end gap-10 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <h1 className="display-tight text-5xl sm:text-6xl lg:text-7xl">
                Every Person
                <br />
                <span className="hl">Deserves an Opportunity.</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
                KAAMVORI brings together housekeeping work, internships, delivery gigs, skilled trades,
                office roles and professional jobs — one board that says up front what education each job needs.
              </p>

              <form onSubmit={runSearch} className="mt-7 flex flex-col gap-2 sm:flex-row">
                <label htmlFor="kw" className="sr-only">
                  Job title, skill or company
                </label>
                <input
                  id="kw"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Job title, skill or company"
                  className="min-w-0 flex-1 rounded-lg border border-line bg-white px-4 py-3 text-base placeholder:text-mute"
                />
                <label htmlFor="loc" className="sr-only">
                  City
                </label>
                <input
                  id="loc"
                  value={place}
                  onChange={(e) => setPlace(e.target.value)}
                  placeholder="City or remote"
                  className="min-w-0 rounded-lg border border-line bg-white px-4 py-3 text-base placeholder:text-mute sm:w-44"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-accent px-7 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-accent-hover"
                >
                  Search jobs
                </button>
              </form>
            </div>

            <StairNav counts={stairCounts} active={edu} onPick={pickRung} />
          </div>
        </div>
      </section>

      {/* Stats */}
      <div className="border-b border-line bg-paper">
        <dl className="mx-auto grid max-w-6xl grid-cols-2 px-4 sm:grid-cols-4">
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className={`py-6 pr-4 ${i > 0 ? 'sm:border-l sm:border-line sm:pl-6' : ''} ${
                i % 2 === 1 ? 'border-l border-line pl-4 sm:pl-6' : ''
              }`}
            >
              <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-mute">{stat.label}</dt>
              <dd className="display-tight mt-2 text-3xl text-ink">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Browse */}
      <section id="browse" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="display-tight text-3xl">Open listings</h2>
            <p className="mt-1 text-sm text-mute">
              {filtered.length} of {jobs.length} jobs
              {hasQuery ? ' matching your filters' : ' on the board right now'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-mute">
            <span className="rounded-full border border-line bg-white px-3 py-1.5">View: {view}</span>
            <span className="rounded-full border border-line bg-white px-3 py-1.5">Group: {group}</span>
          </div>
        </div>

        {/* Sections */}
        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h3 className="display text-xl">Fresh opportunities</h3>
              <span className="text-xs text-mute">Recently posted</span>
            </div>
            {freshJobs.length > 0 ? (
              <ul className="mt-4 space-y-3">
                {freshJobs.map((job) => (
                  <li key={job.id} className="rounded-xl border border-line bg-[#fdfbf7] p-3">
                    <Link to={`/jobs/${job.id}`} className="block">
                      <p className="text-sm font-bold text-ink">{job.title}</p>
                      <p className="mt-0.5 text-xs text-ink-soft">{job.org} · {job.location}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-mute">No fresh listings in the current selection. Clear filters to see more.</p>
            )}
          </section>

          <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h3 className="display text-xl">Browse by category</h3>
              <span className="text-xs text-mute">Quick access</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {categoryCounts.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    toggleCat(c.id)
                    scrollToBrowse()
                  }}
                  className={`rounded-full border px-3 py-2 text-sm font-semibold transition-colors ${
                    cats.includes(c.id)
                      ? 'border-accent bg-signal text-accent'
                      : 'border-line bg-[#fdfbf7] text-ink-soft hover:border-accent/50'
                  }`}
                >
                  {c.label} <span className="ml-1 text-xs text-mute">{c.count}</span>
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <FilterPanel
            jobs={jobs}
            params={params}
            sort={sort}
            view={view}
            group={group}
            variant="top"
            onToggle={(key, value) => (key === 'cat' ? toggleCat(value) : setParam(key, value))}
            onClear={clearFilters}
            onSort={(value) => setParam('sort', value)}
            onView={(value) => setParam('view', value)}
            onGroup={(value) => setParam('group', value)}
          />

          <div>
            {filtered.length > 0 ? (
              <div className="space-y-6">
                {grouped.map((section) => (
                  <section key={section.key} className="space-y-3">
                    {section.label && (
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="display text-2xl">{section.label}</h3>
                        <span className="rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-mute">
                          {section.items.length} {section.items.length === 1 ? 'job' : 'jobs'}
                        </span>
                      </div>
                    )}
                    {view === 'grid' ? (
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {section.items.map((job) => (
                          <Item key={job.id} job={job} />
                        ))}
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
                        {section.items.map((job) => (
                          <Item key={job.id} job={job} />
                        ))}
                      </div>
                    )}
                  </section>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-line bg-white p-8 text-center shadow-sm sm:p-12">
                <p className="display text-xl">No listings match these filters.</p>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-mute">
                  Try another filter, change grouping/view, or clear everything to see the full board.
                </p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-5 rounded-lg bg-accent px-5 py-2.5 font-semibold text-white hover:bg-accent-hover"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  )
}