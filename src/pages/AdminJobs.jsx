import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import DashboardShell from '../components/DashboardShell.jsx'
import AdminNav from '../components/AdminNav.jsx'
import { JobStatusPill, JobStatusExplain } from '../components/StatusPill.jsx'
import { useAuth } from '../lib/auth.jsx'
import { supabase, probeBackend } from '../lib/supabase.js'

/**
 * Admin: job moderation queue.
 *
 * Lists listings and lets the admin move them through the moderation states:
 *   pending → approve (→ active) | reject (→ rejected)
 *   active  → suspend (→ closed)
 * Decisions write `ladder_admin_audit_logs` and only ever come from this screen —
 * the employer-side lock (`ladder_jobs_lock_status`) keeps employers from
 * self-activating, and the DB treats admin JWTs as trusted writers.
 *
 * The screen never invents a status: every action maps to a real `ladder_jobs`
 * status transition owned by the database.
 */

const FILTERS = [
  { id: 'pending', label: 'Pending' },
  { id: 'active', label: 'Live' },
  { id: 'closed', label: 'Closed' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'all', label: 'All' },
]

export default function AdminJobs() {
  const { user } = useAuth()
  const [backend, setBackend] = useState('checking')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('pending')
  const [busyId, setBusyId] = useState(null)
  const [notes, setNotes] = useState({})

  const dbReady = backend === 'ready'

  useEffect(() => {
    let alive = true
    probeBackend().then((s) => alive && setBackend(s))
    return () => {
      alive = false
    }
  }, [])

  const load = useCallback(async () => {
    if (!dbReady) {
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('ladder_jobs')
      .select(
        'id, title, summary, status, employer:ladder_employers!inner(id, company_name, owner_id, city, status) as employer, created_at',
      )
      .order('created_at', { ascending: false })
    if (err) setError(err.message)
    else setRows(data ?? [])
    setLoading(false)
  }, [dbReady])

  useEffect(() => {
    load()
  }, [load])

  const visible = rows.filter((r) => (filter === 'all' ? true : r.status === filter))

  const act = async (row, status, note) => {
    setError(null)
    const cleanNote = (note ?? '').trim()
    if (status === 'rejected' && cleanNote.length < 5) {
      setError('Rejections need a written reason the employer can act on (at least 5 characters).')
      return
    }
    setBusyId(row.id)
    try {
      const { error: updErr } = await supabase
        .from('ladder_jobs')
        .update({ status })
        .eq('id', row.id)
      if (updErr) throw new Error(updErr.message)

      const action = status === 'active' ? 'job.approved' : status === 'rejected' ? 'job.rejected' : 'job.suspended'
      const auditNote = {
        job_id: row.id,
        job_title: row.title,
        employer_id: row.employer?.id ?? null,
        company_name: row.employer?.company_name ?? null,
        note: cleanNote || null,
      }
      const { error: auditErr } = await supabase.from('ladder_admin_audit_logs').insert({
        admin_id: user?.id ?? null,
        action,
        entity_type: 'job',
        entity_id: row.id,
        details: auditNote,
      })
      if (auditErr) console.warn('audit log write failed:', auditErr.message)

      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusyId(null)
    }
  }

  const counts = {
    pending: rows.filter((r) => r.status === 'pending').length,
    active: rows.filter((r) => r.status === 'active').length,
    all: rows.length,
  }

  return (
    <DashboardShell
      title="Job moderation"
      subtitle="Review employer submissions and keep the live board honest."
    >
      <AdminNav />

      {!dbReady && backend !== 'checking' && (
        <div className="mt-6 rounded-xl border border-line bg-signal px-4 py-3 text-sm text-ink-soft" data-testid="admin-jobs-db-notice">
          {backend === 'unconfigured'
            ? 'Supabase is not configured — the moderation queue cannot load.'
            : backend === 'missing'
              ? 'Database not set up yet — run the migrations (see supabase/README.md).'
              : 'Backend connection error — the queue is paused until it recovers.'}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-[#fbf0ee] px-3 py-2 text-sm font-semibold text-alert" data-testid="admin-jobs-error">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Moderation filter">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
              filter === f.id
                ? 'border-accent bg-signal text-accent'
                : 'border-line bg-white text-ink-soft hover:border-mute'
            }`}
            data-testid={`admin-jobs-filter-${f.id}`}
          >
            {f.label}
            <span className="ml-1.5 text-xs text-mute">{f.id === 'all' ? counts.all : counts[f.id] ?? 0}</span>
          </button>
        ))}
      </div>

      <section className="mt-5 rounded-xl border border-line bg-white p-6" data-testid="admin-jobs-queue">
        <h2 className="text-sm font-bold text-ink">
          {filter === 'all' ? 'All listings' : `${filter[0].toUpperCase() + filter.slice(1)} listings`}
        </h2>

        {loading ? (
          <p className="mt-4 text-sm text-mute">Loading…</p>
        ) : visible.length === 0 ? (
          <p className="mt-4 text-sm text-mute" data-testid="admin-jobs-empty">
            No listings in this state.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {visible.map((row) => (
              <li key={row.id} className="rounded-xl border border-line p-5" data-testid="admin-jobs-row">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-bold text-ink">{row.title}</p>
                      <JobStatusPill status={row.status} />
                    </div>
                    <p className="mt-1 text-sm text-ink-soft">
                      {row.employer?.company_name ?? 'Unknown company'}
                      {row.employer?.city ? <> · {row.employer.city}</> : null}
                    </p>
                    {row.summary && <p className="mt-1 text-sm text-ink-soft">{row.summary}</p>}
                    <JobStatusExplain status={row.status} />
                  </div>
                </div>

                {row.status === 'pending' && (
                  <div className="mt-4 border-t border-line pt-4">
                    <label className="block text-sm font-bold">
                      Moderation note
                      <span className="mb-1 block text-xs font-normal text-mute">
                        Required when rejecting — the employer sees this word for word.
                      </span>
                      <textarea
                        rows={2}
                        maxLength={500}
                        className="mt-1.5 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-base"
                        value={notes[row.id] ?? ''}
                        onChange={(e) => setNotes((n) => ({ ...n, [row.id]: e.target.value }))}
                        placeholder="Listing does not match the salary the seeker expects."
                        disabled={busyId === row.id}
                        data-testid="admin-jobs-note-input"
                      />
                    </label>
                    <div className="mt-3 flex flex-wrap gap-3">
                      <button
                        onClick={() => act(row, 'active', notes[row.id])}
                        disabled={busyId === row.id}
                        className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                        data-testid="admin-jobs-approve"
                      >
                        {busyId === row.id ? 'Saving…' : 'Approve & list live'}
                      </button>
                      <button
                        onClick={() => act(row, 'rejected', notes[row.id])}
                        disabled={busyId === row.id}
                        className="rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold text-alert hover:border-alert disabled:cursor-not-allowed disabled:opacity-50"
                        data-testid="admin-jobs-reject"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )}

                {row.status === 'active' && (
                  <div className="mt-4 border-t border-line pt-4">
                    <button
                      onClick={() => act(row, 'closed', '')}
                      disabled={busyId === row.id}
                      className="rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink-soft hover:border-mute disabled:cursor-not-allowed disabled:opacity-50"
                      data-testid="admin-jobs-suspend"
                    >
                      {busyId === row.id ? 'Saving…' : 'Suspend listing'}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-6 rounded-xl border border-line bg-white p-6">
        <h2 className="text-sm font-bold text-ink">What moderation does</h2>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-soft">
          <li>· Approving lists the vacancy live; rejecting takes it down with a written note the employer can act on.</li>
          <li>· Suspending takes a live listing offline immediately (same status the employer close flow uses).</li>
          <li>· You update the listing through this screen — the database lock keeps employers from self-activating.</li>
          <li>· Every decision is written to the audit log.</li>
          <li>
            <Link to="/employer/jobs" className="font-semibold text-accent underline underline-offset-2">
              Employers manage their own listings from /employer/jobs
            </Link>
          </li>
        </ul>
      </div>
    </DashboardShell>
  )
}
