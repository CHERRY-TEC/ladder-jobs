import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import FilterPanel from '../components/FilterPanel.jsx'
import JobRow from '../components/JobRow.jsx'
import StairNav from '../components/StairNav.jsx'
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
      if (sort === 'title') return a.title.localeCompare(b.title)
      // At equal recency, locally posted jobs rank above imported feed jobs.
      const localRank = (j) => (j.origin === 'feed' ? 1 : 0)
      return a.daysAgo - b.daysAgo || localRank(a) - localRank(b)
    })
  }, [jobs, q, loc, edu, exp, pay, mode, when, cats, type, sort])

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

  const hasQuery = q || loc || edu || exp || pay || mode || when || type || cats.length > 0

  return (
    <>
      {/* Hero */}
      <section className="border-b border-line bg-white">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
          <div className="grid items-end gap-10 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <h1 className="display-tight text-5xl sm:text-6xl lg:text-7xl">
                Every Person
                <br />
                <span className="hl">Deserves an Opportunity.</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
                KaamVori brings together housekeeping work, internships, delivery gigs, skilled trades,
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
                  className="rounded-lg bg-accent px-6 py-3 font-semibold text-white transition-colors hover:bg-accent-hover"
                >
                  Search
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
              className={`py-5 pr-4 ${i > 0 ? 'sm:border-l sm:border-line sm:pl-6' : ''} ${
                i % 2 === 1 ? 'border-l border-line pl-4 sm:pl-6' : ''
              }`}
            >
              <dt className="text-[13px] font-semibold text-mute">{stat.label}</dt>
              <dd className="display-tight mt-1 text-3xl">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Browse */}
      <section id="browse" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-10">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="display-tight text-3xl">Open listings</h2>
            <p className="mt-1 text-sm text-mute">
              {filtered.length} of {jobs.length} jobs
              {hasQuery ? ' matching your filters' : ' on the board right now'}
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[264px_1fr]">
          <aside>
            <FilterPanel
              jobs={jobs}
              params={params}
              sort={sort}
              onToggle={(key, value) => (key === 'cat' ? toggleCat(value) : setParam(key, value))}
              onClear={clearFilters}
              onSort={(value) => setParam('sort', value)}
            />
          </aside>

          <div className="overflow-hidden rounded-xl border border-line bg-white">
            {filtered.length > 0 ? (
              filtered.map((job) => <JobRow key={job.id} job={job} />)
            ) : (
              <div className="p-8 text-center sm:p-12">
                <p className="display text-xl">No listings match these filters.</p>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-mute">
                  Try another education rung or clear the filters to see everything on the board.
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
