import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { SEED_JOBS } from '../data/seed.js'
import feedData from '../data/feed-jobs.json'
import { probeBackend, supabase } from './supabase.js'

// Feed listings from scripts/ingest-jobs.mjs — real jobs from public APIs,
// each with source attribution. Recomputed relative to page load.
const FEED_JOBS = (feedData?.jobs ?? []).map((job) => ({
  ...job,
  daysAgo: Math.max(0, Math.floor((Date.now() - Date.parse(job.postedAt)) / 86_400_000)),
}))

const KEYS = {
  userJobs: 'ladder.userJobs.v1',
  favorites: 'ladder.favorites.v1',
}

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    const value = raw ? JSON.parse(raw) : null
    return value ?? fallback
  } catch {
    return fallback
  }
}

const DAY = 86_400_000

/**
 * `ladder_jobs` row → the card shape every listing component already speaks.
 * Left-joined employer/category come back as null for demo and feed rows, so
 * `org_name` and the seed category ids carry those.
 */
function mapDbJob(row) {
  const posted = Date.parse(row.published_at)
  const daysAgo = Number.isFinite(posted)
    ? Math.max(0, Math.floor((Date.now() - posted) / DAY))
    : 0

  const place =
    row.location_label ||
    [row.city, row.state].filter(Boolean).join(', ') ||
    (row.is_remote ? 'Remote' : row.country || 'India')

  // Remote work still has a home city — say both, so the card reads honestly
  // and the location filter keeps matching the actual place.
  const location =
    row.work_mode === 'remote' && !/^remote/i.test(place) ? `${place} · Remote` : place

  const salary =
    row.salary_label ||
    (row.salary_min != null
      ? `₹${Number(row.salary_min).toLocaleString('en-IN')}${
          row.salary_period ? ` / ${row.salary_period}` : ''
        }`
      : 'Pay not disclosed')

  return {
    id: row.id,
    title: row.title,
    org: row.org_name || row.employer?.company_name || '—',
    category: row.category?.slug ?? null,
    type: row.job_type,
    education: row.education_required,
    experience: row.experience_required,
    workMode: row.work_mode,
    location,
    salary,
    salaryMin: row.salary_min == null ? null : Number(row.salary_min),
    daysAgo,
    summary: row.summary,
    duties: row.duties ?? [],
    requirements: row.requirements ?? [],
    contact: row.contact_kind
      ? {
          kind: row.contact_kind,
          value: row.contact_value,
          label: row.contact_label || row.contact_value,
        }
      : row.contact_value
        ? { kind: 'note', value: row.contact_value, label: row.contact_label || row.contact_value }
        : null,
    origin: row.origin,
    source: row.source_name ?? undefined,
    sourceUrl: row.source_url ?? undefined,
    postedAt: row.published_at,
  }
}

const StoreContext = createContext(null)

export function StoreProvider({ children }) {
  const [userJobs, setUserJobs] = useState(() => read(KEYS.userJobs, []))
  const [favorites, setFavorites] = useState(() => read(KEYS.favorites, []))
  const [dbJobs, setDbJobs] = useState(null) // null = live board not loaded yet
  const [board, setBoard] = useState('checking') // checking | live | local
  const [toast, setToast] = useState('')
  const toastTimer = useRef(null)

  // Load the public board from Supabase when the backend is reachable.
  // On any problem we fall back to the offline demo seed — never to nothing.
  useEffect(() => {
    let alive = true
    probeBackend().then((status) => {
      if (!alive) return
      if (status !== 'ready') {
        setBoard('local')
        return
      }
      supabase
        .from('ladder_jobs')
        .select(
          'id, title, org_name, summary, duties, requirements, job_type, work_mode, ' +
            'education_required, experience_required, salary_min, salary_period, salary_label, ' +
            'country, state, city, location_label, is_remote, contact_kind, contact_value, ' +
            'contact_label, origin, source_name, source_url, published_at, ' +
            'employer:ladder_employers!left(company_name), ' +
            'category:ladder_job_categories!left(slug)',
        )
        .eq('status', 'active')
        .order('published_at', { ascending: false })
        .then(({ data, error }) => {
          if (!alive) return
          if (error) {
            // RLS already hides expired rows; anything else means the query is
            // wrong for this schema — degrade to the demo board, loudly.
            console.info('board: falling back to local demo data —', error.message)
            setBoard('local')
            return
          }
          setDbJobs((data ?? []).map(mapDbJob))
          setBoard('live')
        })
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(KEYS.userJobs, JSON.stringify(userJobs))
    } catch {
      /* storage full or unavailable — listings stay in memory */
    }
  }, [userJobs])

  useEffect(() => {
    try {
      localStorage.setItem(KEYS.favorites, JSON.stringify(favorites))
    } catch {
      /* ignore */
    }
  }, [favorites])

  useEffect(() => () => clearTimeout(toastTimer.current), [])

  const notify = useCallback((message) => {
    clearTimeout(toastTimer.current)
    setToast(message)
    toastTimer.current = setTimeout(() => setToast(''), 4000)
  }, [])

  const addJob = useCallback((job) => {
    const id = `u${Date.now().toString(36)}`
    const newJob = { ...job, id, daysAgo: 0, mine: true }
    setUserJobs((prev) => [newJob, ...prev])
    return newJob
  }, [])

  const toggleFavorite = useCallback((id) => {
    setFavorites((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [id, ...prev]))
  }, [])

  // Live board (demo rows + employer posts from the DB) replaces the offline
  // seed once it has loaded; the feed JSON rides along either way because it
  // is not synced into the database until SUPABASE_SERVICE_ROLE_KEY is set.
  const localJobs = board === 'live' ? dbJobs : SEED_JOBS
  const jobs = useMemo(
    () => [...userJobs, ...localJobs, ...FEED_JOBS],
    [userJobs, localJobs],
  )

  const value = useMemo(
    () => ({ jobs, favorites, toggleFavorite, addJob, toast, notify, board }),
    [jobs, favorites, toggleFavorite, addJob, toast, notify, board],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}
