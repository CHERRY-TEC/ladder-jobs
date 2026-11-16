import { useCallback, useEffect, useState } from 'react'
import DashboardShell from '../components/DashboardShell.jsx'
import AdminNav from '../components/AdminNav.jsx'
import { supabase, probeBackend } from '../lib/supabase.js'

/**
 * Admin: audit log.
 *
 * Every admin decision (verification approve/reject, job moderation, report
 * resolution) writes a row to `ladder_admin_audit_logs`. This screen reads it
 * back — read-only, admin-only via RLS.
 */

const ACTION_LABELS = {
  'verification.approved': 'Verification approved',
  'verification.rejected': 'Verification rejected',
  'job.approved': 'Job approved',
  'job.rejected': 'Job rejected',
  'job.suspended': 'Job suspended',
}

export default function AdminAudit() {
  const [backend, setBackend] = useState('checking')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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
      .from('ladder_admin_audit_logs')
      .select('id, action, entity_type, entity_id, details, created_at')
      .order('created_at', { ascending: false })
      .limit(100)
    if (err) setError(err.message)
    else setRows(data ?? [])
    setLoading(false)
  }, [dbReady])

  useEffect(() => {
    load()
  }, [load])

  return (
    <DashboardShell
      title="Audit log"
      subtitle="Every moderation decision, written by the admin actions themselves."
    >
      <AdminNav />

      {!dbReady && backend !== 'checking' && (
        <div className="mt-6 rounded-xl border border-line bg-signal px-4 py-3 text-sm text-ink-soft" data-testid="admin-audit-db-notice">
          {backend === 'unconfigured'
            ? 'Supabase is not configured — the audit log cannot load.'
            : backend === 'missing'
              ? 'Database not set up yet — run the migrations (see supabase/README.md).'
              : 'Backend connection error — the audit log is paused until it recovers.'}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-[#fbf0ee] px-3 py-2 text-sm font-semibold text-alert" data-testid="admin-audit-error">
          {error}
        </p>
      )}

      <section className="mt-5 rounded-xl border border-line bg-white p-6" data-testid="admin-audit-list">
        <h2 className="text-sm font-bold text-ink">Recent decisions</h2>

        {loading ? (
          <p className="mt-4 text-sm text-mute">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="mt-4 text-sm text-mute" data-testid="admin-audit-empty">
            No decisions recorded yet.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {rows.map((r) => (
              <li key={r.id} className="py-3" data-testid="admin-audit-row">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-bold text-ink">{ACTION_LABELS[r.action] ?? r.action}</p>
                  <p className="text-xs text-mute">{new Date(r.created_at).toLocaleString('en-IN')}</p>
                </div>
                <p className="mt-1 text-xs text-ink-soft">
                  {r.entity_type}
                  {r.entity_id ? <> · <code>{r.entity_id}</code></> : null}
                  {r.details?.job_title ? <> · {r.details.job_title}</> : null}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </DashboardShell>
  )
}
