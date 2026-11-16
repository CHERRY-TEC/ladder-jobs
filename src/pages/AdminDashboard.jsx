import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import DashboardShell from '../components/DashboardShell.jsx'
import AdminNav from '../components/AdminNav.jsx'
import { supabase, probeBackend } from '../lib/supabase.js'

/**
 * Admin overview. Every number here is read from the database with the admin
 * session — nothing is hard-coded, and counts stay hidden unless the backend is
 * reachable.
 */
export default function AdminDashboard() {
  const [backend, setBackend] = useState('checking')
  const [pendingVerifications, setPendingVerifications] = useState(null)
  const [pendingJobs, setPendingJobs] = useState(null)
  const [openReports, setOpenReports] = useState(null)
  const [error, setError] = useState(null)

  const dbReady = backend === 'ready'

  useEffect(() => {
    let alive = true
    probeBackend().then((s) => {
      if (!alive) return
      setBackend(s)
      if (s !== 'ready') return
      Promise.all([
        supabase.from('ladder_employer_verifications').select('id', { count: 'exact', head: true }).eq('status', 'pending').then(({ count, error: err }) => {
          if (!alive) return
          if (err) setError(err.message)
          else setPendingVerifications(count)
        }),
        supabase.from('ladder_jobs').select('id', { count: 'exact', head: true }).eq('status', 'pending').then(({ count, error: err }) => {
          if (!alive) return
          if (err) setError(err.message)
          else setPendingJobs(count)
        }),
        supabase.from('ladder_job_reports').select('id', { count: 'exact', head: true }).eq('status', 'open').then(({ count, error: err }) => {
          if (!alive) return
          if (err) setError(err.message)
          else setOpenReports(count)
        }),
      ])
    })
    return () => {
      alive = false
    }
  }, [])

  return (
    <DashboardShell
      title="Admin"
      subtitle="Moderation and platform oversight."
    >
      <AdminNav />

      {!dbReady && backend !== 'checking' ? (
        <div className="mt-6 rounded-xl border border-line bg-signal px-4 py-3 text-sm text-ink-soft" data-testid="admin-db-notice">
          {backend === 'unconfigured'
            ? 'Supabase is not configured — admin data is unavailable. Nothing is faked.'
            : backend === 'missing'
              ? 'Database not set up yet — run the migrations (see supabase/README.md).'
              : 'Backend connection error — counts are hidden until it recovers.'}
        </div>
      ) : null}

      {error ? (
        <div className="mt-6 rounded-xl border border-line bg-[#fbf0ee] px-4 py-3 text-sm text-alert" data-testid="admin-count-error">
          Could not read the review queues: {error}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-white p-5" data-testid="cell-employer-verification">
          <p className="text-xs font-semibold uppercase tracking-wide text-mute">Employer verification</p>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Read each submitted GST / CIN / Udyam document and approve or reject it with a written reason.
            Only you can grant the Verified badge.
          </p>
          {backend === 'ready' && pendingVerifications !== null && !error && (
            <p className="mt-3 text-2xl font-bold text-ink" data-testid="pending-count">
              {pendingVerifications}
              <span className="ml-2 text-xs font-semibold text-mute">
                {pendingVerifications === 1 ? 'submission waiting' : 'submissions waiting'}
              </span>
            </p>
          )}
          <Link
            to="/admin/verifications"
            className="mt-3 inline-block rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-hover"
            data-testid="open-review-queue"
          >
            {backend === 'ready' && pendingVerifications === 0 ? 'Queue is clear — review history' : 'Open review queue'}
          </Link>
        </div>

        <div className="rounded-xl border border-line bg-white p-5" data-testid="cell-job-moderation">
          <p className="text-xs font-semibold uppercase tracking-wide text-mute">Job moderation</p>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Listings waiting for approval, plus live listings the admin may suspend.
          </p>
          {backend === 'ready' && pendingJobs !== null && !error && (
            <p className="mt-3 text-2xl font-bold text-ink" data-testid="pending-jobs-count">
              {pendingJobs}
              <span className="ml-2 text-xs font-semibold text-mute">submissions waiting</span>
            </p>
          )}
          <Link
            to="/admin/jobs"
            className="mt-3 inline-block rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-hover"
            data-testid="open-job-queue"
          >
            {backend === 'ready' && pendingJobs === 0 ? 'Queue is clear' : 'Open job queue'}
          </Link>
        </div>

        <div className="rounded-xl border border-line bg-white p-5" data-testid="cell-open-reports">
          <p className="text-xs font-semibold uppercase tracking-wide text-mute">Open reports</p>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Seeker-flagged listings awaiting review or resolution.
          </p>
          {backend === 'ready' && openReports !== null && !error && (
            <p className="mt-3 text-2xl font-bold text-ink" data-testid="open-reports-count">
              {openReports}
              <span className="ml-2 text-xs font-semibold text-mute">open</span>
            </p>
          )}
          <Link
            to="/admin/reports"
            className="mt-3 inline-block rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-hover"
            data-testid="open-reports-queue"
          >
            {backend === 'ready' && openReports === 0 ? 'Queue is clear' : 'Open report queue'}
          </Link>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-line bg-white p-6">
        <h2 className="text-sm font-bold text-ink">Access model</h2>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-soft">
          <li>· Your role lives in the database (<code>ladder_user_roles</code>), granted only via <code>ladder_grant_admin()</code> from the SQL Editor.</li>
          <li>· The client can never write that table — signup metadata asking for “admin” is ignored server-side.</li>
          <li>· Approving a document updates the submission row; a database trigger moves the company to verified. You never edit a company's status directly.</li>
          <li>· User, category, job, report moderation and audit/analytics screens are available here. Role elevation and destructive account actions remain database/service operations by design.</li>
        </ul>
      </div>
    </DashboardShell>
  )
}
