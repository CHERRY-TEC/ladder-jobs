import { useCallback, useEffect, useState } from 'react'
import DashboardShell from '../components/DashboardShell.jsx'
import AdminNav from '../components/AdminNav.jsx'
import { useAuth } from '../lib/auth.jsx'
import { supabase, probeBackend } from '../lib/supabase.js'

const REPORT_STATUSES = ['open', 'reviewing', 'resolved', 'dismissed']

/**
 * Admin: report queue.
 *
 * Job reports land here from the reporter (see `ladder_job_reports`). The admin
 * moves a report through open → reviewing → resolved | dismissed and records the
 * resolution. Resolution is the admin's call; the underlying job status is
 * managed from the job moderation queue.
 */

export default function AdminReports() {
  const { user } = useAuth()
  const [backend, setBackend] = useState('checking')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('open')
  const [busyId, setBusyId] = useState(null)
  const [resolution, setResolution] = useState({})

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
      .from('ladder_job_reports')
      .select(
        'id, job_id, reason, details, status, resolution_notes, resolved_by, resolved_at, created_at, job:ladder_jobs(id, title, status)',
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

  const setStatus = async (row, status, note) => {
    setError(null)
    const cleanNote = (note ?? '').trim()
    setBusyId(row.id)
    try {
      const { error: updErr } = await supabase
        .from('ladder_job_reports')
        .update({
          status,
          resolution_notes: cleanNote || null,
          resolved_by: user?.id ?? null,
          resolved_at: status === 'resolved' ? new Date().toISOString() : null,
        })
        .eq('id', row.id)
      if (updErr) throw new Error(updErr.message)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusyId(null)
    }
  }

  const counts = {
    open: rows.filter((r) => r.status === 'open').length,
    all: rows.length,
  }

  return (
    <DashboardShell
      title="Reports"
      subtitle="Review listings seekers flag: fraud, fees, misleading content, duplicates."
    >
      <AdminNav />

      {!dbReady && backend !== 'checking' && (
        <div className="mt-6 rounded-xl border border-line bg-signal px-4 py-3 text-sm text-ink-soft" data-testid="admin-reports-db-notice">
          {backend === 'unconfigured'
            ? 'Supabase is not configured — the report queue cannot load.'
            : backend === 'missing'
              ? 'Database not set up yet — run the migrations (see supabase/README.md).'
              : 'Backend connection error — the queue is paused until it recovers.'}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-[#fbf0ee] px-3 py-2 text-sm font-semibold text-alert" data-testid="admin-reports-error">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Report filter">
        {['open', 'resolved', 'dismissed', 'all'].map((key) => (
          <button
            key={key}
            role="tab"
            aria-selected={filter === key}
            onClick={() => setFilter(key)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
              filter === key
                ? 'border-accent bg-signal text-accent'
                : 'border-line bg-white text-ink-soft hover:border-mute'
            }`}
            data-testid={`admin-reports-filter-${key}`}
          >
            {key[0].toUpperCase() + key.slice(1)}
            <span className="ml-1.5 text-xs text-mute">{key === 'all' ? counts.all : rows.filter((r) => r.status === key).length}</span>
          </button>
        ))}
      </div>

      <section className="mt-5 rounded-xl border border-line bg-white p-6" data-testid="admin-reports-queue">
        <h2 className="text-sm font-bold text-ink">
          {filter === 'all' ? 'All job reports' : `${filter[0].toUpperCase() + filter.slice(1)} reports`}
        </h2>

        {loading ? (
          <p className="mt-4 text-sm text-mute">Loading…</p>
        ) : visible.length === 0 ? (
          <p className="mt-4 text-sm text-mute" data-testid="admin-reports-empty">
            No reports in this state.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {visible.map((row) => (
              <li key={row.id} className="rounded-xl border border-line p-5" data-testid="admin-reports-row">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-bold text-ink">{row.job?.title ?? 'Listing removed'}</p>
                      <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                        row.status === 'open'
                          ? 'bg-[#fdf6e6] text-[#8a6d1a] border-transparent'
                          : row.status === 'resolved'
                            ? 'bg-signal text-accent border-transparent'
                            : row.status === 'dismissed'
                              ? 'bg-paper text-mute border-line'
                              : 'bg-signal text-accent border-transparent'
                      }`} data-testid="admin-reports-status">
                        {row.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-ink-soft">Reason: {row.reason}</p>
                    {row.details && <p className="mt-1 text-sm text-ink-soft">“{row.details}”</p>}
                    {row.resolved_at && (
                      <p className="mt-1 text-xs text-mute">Resolved {new Date(row.resolved_at).toLocaleString('en-IN')}.</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {row.status === 'open' && (
                      <button
                        onClick={() => setStatus(row, 'reviewing', '')}
                        disabled={busyId === row.id}
                        className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink-soft hover:border-mute disabled:cursor-not-allowed disabled:opacity-50"
                        data-testid="admin-reports-start-reviewing"
                      >
                        Start reviewing
                      </button>
                    )}
                    {(row.status === 'open' || row.status === 'reviewing') && (
                      <>
                        <button
                          onClick={() => setStatus(row, 'resolved', (resolution[row.id] ?? '').trim())}
                          disabled={busyId === row.id}
                          className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                          data-testid="admin-reports-resolve"
                        >
                          Resolve
                        </button>
                        <button
                          onClick={() => setStatus(row, 'dismissed', (resolution[row.id] ?? '').trim())}
                          disabled={busyId === row.id}
                          className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink-soft hover:border-mute disabled:cursor-not-allowed disabled:opacity-50"
                          data-testid="admin-reports-dismiss"
                        >
                          Dismiss
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-6 rounded-xl border border-line bg-white p-6">
        <h2 className="text-sm font-bold text-ink">What happens on resolution</h2>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-soft">
          <li>· Start reviewing records that a report is being looked at.</li>
          <li>· Resolve closes the report; dismiss drops it as not actionable. Both write the resolution notes.</li>
          <li>· Job listings themselves are approved / rejected / suspended from the Job moderation queue.</li>
        </ul>
      </div>
    </DashboardShell>
  )
}
