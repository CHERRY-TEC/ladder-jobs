import { useEffect, useState } from 'react'
import DashboardShell from '../components/DashboardShell.jsx'
import AdminNav from '../components/AdminNav.jsx'
import { supabase, probeBackend } from '../lib/supabase.js'

/**
 * Admin: platform analytics — DB-derived only, never invented.
 *
 * Every number on this screen is a real `count` from a `ladder_*` table via the
 * admin session. No sample data, no projections, no marketing maths.
 */

export default function AdminAnalytics() {
  const [backend, setBackend] = useState('checking')
  const [counts, setCounts] = useState(null)
  const [error, setError] = useState(null)

  const dbReady = backend === 'ready'

  useEffect(() => {
    let alive = true
    probeBackend().then((s) => {
      if (!alive) return
      setBackend(s)
      if (s !== 'ready') return
      Promise.all([
        supabase.from('ladder_jobs').select('id', { count: 'exact', head: true }).then(({ count, error: err }) => {
          if (!alive) return
          if (err) setError(err.message)
          else setCounts((c) => ({ ...c, jobs: count }))
        }),
        supabase.from('ladder_jobs').select('id', { count: 'exact', head: true }).eq('status', 'active').then(({ count, error: err }) => {
          if (!alive) return
          if (err) setError(err.message)
          else setCounts((c) => ({ ...c, activeJobs: count }))
        }),
        supabase.from('ladder_jobs').select('id', { count: 'exact', head: true }).eq('status', 'pending').then(({ count, error: err }) => {
          if (!alive) return
          if (err) setError(err.message)
          else setCounts((c) => ({ ...c, pendingJobs: count }))
        }),
        supabase.from('ladder_applications').select('id', { count: 'exact', head: true }).then(({ count, error: err }) => {
          if (!alive) return
          if (err) setError(err.message)
          else setCounts((c) => ({ ...c, applications: count }))
        }),
        supabase.from('ladder_job_reports').select('id', { count: 'exact', head: true }).eq('status', 'open').then(({ count, error: err }) => {
          if (!alive) return
          if (err) setError(err.message)
          else setCounts((c) => ({ ...c, openReports: count }))
        }),
      ])
    })
    return () => {
      alive = false
    }
  }, [])

  const cell = (label, value, testid) => (
    <div className="rounded-xl border border-line bg-white p-5" data-testid={testid}>
      <p className="text-xs font-semibold uppercase tracking-wide text-mute">{label}</p>
      <p className="mt-2 text-2xl font-bold text-ink" data-testid={testid + '-value'}>
        {value ?? '—'}
      </p>
    </div>
  )

  return (
    <DashboardShell title="Analytics" subtitle="Live platform numbers, read from the database.">
      <AdminNav />

      {!dbReady && backend !== 'checking' && (
        <div className="mt-6 rounded-xl border border-line bg-signal px-4 py-3 text-sm text-ink-soft" data-testid="admin-analytics-db-notice">
          {backend === 'unconfigured'
            ? 'Supabase is not configured — analytics cannot load.'
            : backend === 'missing'
              ? 'Database not set up yet — run the migrations (see supabase/README.md).'
              : 'Backend connection error — analytics are paused until it recovers.'}
        </div>
      )}

      {error ? (
        <p role="alert" className="mt-6 rounded-lg bg-[#fbf0ee] px-3 py-2 text-sm font-semibold text-alert" data-testid="admin-analytics-error">
          Could not read analytics: {error}
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cell('Active listings', counts?.activeJobs ?? null, 'analytics-active-jobs')}
        {cell('Pending moderation', counts?.pendingJobs ?? null, 'analytics-pending-jobs')}
        {cell('Applications received', counts?.applications ?? null, 'analytics-applications')}
        {cell('Open reports', counts?.openReports ?? null, 'analytics-open-reports')}
      </div>

      <div className="mt-6 rounded-xl border border-line bg-white p-6">
        <h2 className="text-sm font-bold text-ink">About these numbers</h2>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-soft">
          <li>· Active listings = jobs with status <code>active</code> visible on the public board right now.</li>
          <li>· Pending moderation = listings awaiting an admin decision.</li>
          <li>· Applications received = real rows in <code>ladder_applications</code>.</li>
          <li>· Open reports = reports still awaiting admin resolution.</li>
          <li>· Totals (all listings) are intentionally not shown here — per-status counts are the honest view.</li>
        </ul>
      </div>
    </DashboardShell>
  )
}
