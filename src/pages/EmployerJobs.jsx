import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import DashboardShell from '../components/DashboardShell.jsx'
import EmployerNav from '../components/EmployerNav.jsx'
import { JobStatusExplain, JobStatusPill } from '../components/StatusPill.jsx'
import { useEmployer } from '../lib/useEmployer.js'
import { supabase } from '../lib/supabase.js'
import { JOB_STATUS } from '../data/ladder.js'

const formatDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

/**
 * Employer vacancies — Phase 6.
 *
 * Reads the owner's `ladder_jobs` rows at EVERY status (RLS lets an owner see
 * their own listings, active or not). Status changes here go through the same
 * lock the database enforces: an owner may close a listing or push it back to
 * review, but can never move anything to `active` — that stays admin-only.
 */
export default function EmployerJobs() {
  const { backend, company, loading } = useEmployer()
  const location = useLocation()
  const [rows, setRows] = useState([])
  const [listLoading, setListLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const dbReady = backend === 'ready'
  const hasCompany = Boolean(company)

  const load = useCallback(async () => {
    if (!company) {
      setRows([])
      setListLoading(false)
      return
    }
    setListLoading(true)
    const { data, error: err } = await supabase
      .from('ladder_jobs')
      .select(
        'id, title, status, created_at, published_at, city, job_type, ' +
          'category:ladder_job_categories!left(slug)',
      )
      .eq('employer_id', company.id)
      .order('created_at', { ascending: false })
    if (err) setError(err.message)
    else setRows(data ?? [])
    setListLoading(false)
  }, [company])

  useEffect(() => {
    if (!dbReady) {
      setListLoading(false)
      return
    }
    load()
  }, [dbReady, load])

  const setStatus = async (row, status) => {
    setError(null)
    if (
      status === 'closed' &&
      !window.confirm(`Close “${row.title}”? It stops appearing to seekers until you re-submit it.`)
    )
      return
    setBusyId(row.id)
    const { error: err } = await supabase
      .from('ladder_jobs')
      .update({ status })
      .eq('id', row.id)
      .eq('employer_id', company.id)
    if (err) setError(err.message)
    else await load()
    setBusyId(null)
  }

  const postedTitle = location.state?.posted

  return (
    <DashboardShell
      title="Vacancies"
      subtitle="Everything you have posted — live, in review, closed."
    >
      <EmployerNav />

      {!dbReady && backend !== 'checking' && (
        <div className="mt-6 rounded-xl border border-line bg-signal px-4 py-3 text-sm text-ink-soft" data-testid="jobs-db-notice">
          {backend === 'unconfigured'
            ? 'Supabase is not configured — vacancies cannot be listed.'
            : backend === 'missing'
              ? 'Database not set up yet — run the migrations (see supabase/README.md).'
              : 'Backend connection error — this page is paused until it recovers.'}
        </div>
      )}

      {postedTitle && (
        <div
          role="status"
          className="mt-6 rounded-xl border border-line bg-signal px-4 py-3 text-sm font-semibold text-ink"
          data-testid="posted-notice"
        >
          “{postedTitle}” submitted for review — it appears on the board once an admin approves it.
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-[#fbf0ee] px-3 py-2 text-sm font-semibold text-alert"
          data-testid="jobs-error"
        >
          {error}
        </p>
      )}

      {!loading && !hasCompany && dbReady && (
        <div className="mt-6 rounded-xl border border-line bg-white p-6" data-testid="jobs-no-company">
          <h2 className="text-sm font-bold text-ink">Company profile required</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
            Vacancies attach to your company so seekers know who is hiring. Create the profile
            first — a name and a city is enough.
          </p>
          <Link
            to="/employer/company"
            className="mt-4 inline-block rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover"
          >
            Create company profile
          </Link>
        </div>
      )}

      {hasCompany && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-mute" data-testid="jobs-count">
            {listLoading
              ? 'Loading…'
              : `${rows.length} ${rows.length === 1 ? 'vacancy' : 'vacancies'} on your account`}
          </p>
          <Link
            to="/post"
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover"
            data-testid="post-another"
          >
            + Post a job
          </Link>
        </div>
      )}

      {hasCompany && (
        <section className="mt-4 overflow-hidden rounded-xl border border-line bg-white" data-testid="vacancy-list">
          {listLoading ? (
            <p className="p-6 text-sm text-mute">Loading…</p>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center sm:p-12">
              <p className="display text-xl">No vacancies yet.</p>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-mute">
                Post your first listing — it goes to seekers after a quick admin review, so real
                applicants see it.
              </p>
              <Link
                to="/post"
                className="mt-5 inline-block rounded-lg bg-accent px-5 py-2.5 font-semibold text-white hover:bg-accent-hover"
                data-testid="empty-post-cta"
              >
                Post a job
              </Link>
            </div>
          ) : (
            <ul>
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-5 last:border-b-0"
                  data-testid="vacancy-row"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-bold text-ink">{row.title}</p>
                      <JobStatusPill status={row.status} />
                    </div>
                    <p className="mt-1 text-sm text-mute">
                      {row.job_type}
                      {row.category?.slug && <> · {row.category.slug}</>}
                      {row.city && <> · {row.city}</>}
                    </p>
                    <p className="mt-1 text-xs text-mute">
                      {row.status === 'active' && row.published_at
                        ? `Live since ${formatDate(row.published_at)}`
                        : `Created ${formatDate(row.created_at)}`}
                    </p>
                    <div className="mt-2 max-w-xl">
                      <JobStatusExplain status={row.status} />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to={`/employer/jobs/${row.id}`}
                      className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft hover:border-mute"
                      data-testid="edit-vacancy"
                    >
                      Edit
                    </Link>
                    {row.status !== 'closed' && row.status !== 'expired' && (
                      <button
                        onClick={() => setStatus(row, 'closed')}
                        disabled={busyId === row.id}
                        className="rounded-lg px-2 py-1.5 text-xs font-semibold text-alert hover:underline disabled:opacity-50"
                        data-testid="close-vacancy"
                      >
                        Close
                      </button>
                    )}
                    {(row.status === 'closed' || row.status === 'rejected' || row.status === 'draft') && (
                      <button
                        onClick={() => setStatus(row, 'pending')}
                        disabled={busyId === row.id}
                        className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
                        data-testid="resubmit-vacancy"
                      >
                        {row.status === 'draft' ? 'Submit for review' : 'Re-submit'}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="mt-6 rounded-xl border border-line bg-white p-6">
        <h2 className="text-sm font-bold text-ink">What each status means</h2>
        <dl className="mt-3 space-y-2 text-sm leading-relaxed text-ink-soft">
          {['pending', 'active', 'closed', 'rejected'].map((status) => (
            <div key={status} className="flex flex-wrap gap-2">
              <dt className="font-semibold text-ink">{JOB_STATUS[status].label}</dt>
              <dd className="flex-1">{JOB_STATUS[status].explain}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs leading-relaxed text-mute">
          Only an admin can move a listing to <strong>Live</strong> — the database blocks that
          transition for employer accounts, including this page.
        </p>
      </div>
    </DashboardShell>
  )
}
