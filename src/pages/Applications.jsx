import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import DashboardShell from '../components/DashboardShell.jsx'
import SeekerNav from '../components/SeekerNav.jsx'
import ApplicationStagePill from '../components/ApplicationStagePill.jsx'
import { useAuth } from '../lib/auth.jsx'
import { supabase } from '../lib/supabase.js'
import { relTime } from '../lib/format.js'

/**
 * Seeker's applications — Phase 7.
 *
 * Reads the seeker's own `ladder_applications` rows and joins to the live
 * job for context. The stage pill is display-only; withdrawing is the only
 * applicant-side move the database allows (`ladder_applications_lock_status`).
 */

export default function Applications() {
  const { user } = useAuth()
  const [apps, setApps] = useState([])
  const [jobs, setJobs] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    if (!user?.id) {
      setLoading(false)
      return
    }
    setLoading(true)
    supabase
      .from('ladder_applications')
      .select('id, job_id, status, cover_note, created_at')
      .eq('profile_id', user.id)
      .order('created_at', { ascending: false })
      .then(async ({ data, error }) => {
        if (!alive) return
        if (error) {
          setApps([])
          setLoading(false)
          return
        }
        const list = data ?? []
        setApps(list)
        const ids = [...new Set(list.map((a) => a.job_id).filter(Boolean))]
        if (ids.length) {
          const { data: jobRows } = await supabase
            .from('ladder_jobs')
            .select('id, title, status')
            .in('id', ids)
          if (!alive) return
          const map = {}
          for (const j of jobRows ?? []) map[j.id] = j
          setJobs(map)
        }
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [user?.id])

  const withdraw = async (app) => {
    const { error } = await supabase
      .from('ladder_applications')
      .update({ status: 'withdrawn' })
      .eq('id', app.id)
    if (!error) {
      setApps((prev) => prev.map((a) => (a.id === app.id ? { ...a, status: 'withdrawn' } : a)))
    }
  }

  const terminal = (status) => ['selected', 'rejected', 'withdrawn'].includes(status)

  return (
    <DashboardShell title="My applications" subtitle="Every application you have sent, with its stage.">
      <SeekerNav />

      {loading ? (
        <p className="mt-6 text-sm text-mute" data-testid="apps-loading">Loading applications…</p>
      ) : apps.length === 0 ? (
        <div className="mt-6 rounded-xl border border-line bg-white p-6" data-testid="apps-empty">
          <p className="font-semibold text-ink">No applications yet.</p>
          <p className="mt-2 text-sm text-ink-soft">
            When you apply to a live listing you will see it here with the stage your application is in.
          </p>
          <Link
            to="/#browse"
            className="mt-4 inline-block rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover"
          >
            Browse jobs
          </Link>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-line rounded-xl border border-line bg-white" data-testid="apps-list">
          {apps.map((app) => (
            <li key={app.id} className="flex flex-wrap items-start justify-between gap-3 p-5" data-testid="app-row">
              <div className="min-w-0 flex-1">
                <Link to={`/jobs/${app.job_id}`} className="block">
                  <p className="text-base font-bold text-ink">{jobs[app.job_id]?.title ?? 'A listing you applied to'}</p>
                  {app.cover_note && <p className="mt-1 text-sm text-ink-soft">“{app.cover_note}”</p>}
                  <p className="mt-1 text-xs text-mute">{relTime(Math.floor((Date.now() - new Date(app.created_at).getTime()) / 86_400_000))}</p>
                </Link>
              </div>
              <div className="flex items-center gap-3">
                <ApplicationStagePill status={app.status} />
                {!terminal(app.status) && (
                  <button
                    type="button"
                    onClick={() => withdraw(app)}
                    className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink-soft hover:border-mute"
                    data-testid="app-withdraw"
                  >
                    Withdraw
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </DashboardShell>
  )
}
