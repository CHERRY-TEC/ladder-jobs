import { useCallback, useEffect, useMemo, useState } from 'react'
import DashboardShell from '../components/DashboardShell.jsx'
import AdminNav from '../components/AdminNav.jsx'
import { supabase, probeBackend } from '../lib/supabase.js'

/**
 * Admin: user management (read/manage view).
 *
 * Lists profiles with their assigned roles. Roles are assigned by the database
 * (signup trigger / ladder_grant_admin) and cannot be changed from the client —
 * this screen makes that state visible and searchable for admins. Profile fields
 * remain user-owned; admins can review accounts here but role elevation stays a
 * deliberate SQL/service action.
 */

export default function AdminUsers() {
  const [backend, setBackend] = useState('checking')
  const [profiles, setProfiles] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')

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
    setError(null)
    const [p, r] = await Promise.all([
      supabase
        .from('ladder_profiles')
        .select('id, full_name, email, phone, city, state, created_at')
        .order('created_at', { ascending: false })
        .limit(300),
      supabase.from('ladder_user_roles').select('user_id, role'),
    ])
    if (p.error) setError(p.error.message)
    else setProfiles(p.data ?? [])
    if (r.error) setError((e) => e || r.error.message)
    else setRoles(r.data ?? [])
    setLoading(false)
  }, [dbReady])

  useEffect(() => {
    load()
  }, [load])

  const roleByUser = useMemo(() => {
    const m = new Map()
    for (const row of roles) m.set(row.user_id, row.role)
    return m
  }, [roles])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const merged = profiles.map((p) => ({ ...p, role: roleByUser.get(p.id) ?? '—' }))
    if (!q) return merged
    return merged.filter((p) =>
      [p.full_name, p.email, p.phone, p.city, p.state, p.role, p.id]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    )
  }, [profiles, roleByUser, query])

  return (
    <DashboardShell
      title="User management"
      subtitle="Review registered accounts and roles. Role elevation is granted only via ladder_grant_admin() (database/admin action), never from the client."
    >
      <AdminNav />

      {!dbReady && backend !== 'checking' && (
        <div className="mt-6 rounded-xl border border-line bg-signal px-4 py-3 text-sm text-ink-soft" data-testid="admin-users-db-notice">
          {backend === 'unconfigured'
            ? 'Supabase is not configured — user records are unavailable.'
            : backend === 'missing'
              ? 'Database not set up yet — run the migrations (see supabase/README.md).'
              : 'Backend connection error — user records are paused until it recovers.'}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-[#fbf0ee] px-3 py-2 text-sm font-semibold text-alert" data-testid="admin-users-error">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label className="block min-w-64 flex-1 text-sm font-bold">
          Search users
          <input
            className="mt-1.5 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-base"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, email, city, role, id…"
            data-testid="admin-users-search"
          />
        </label>
        <button
          type="button"
          onClick={load}
          disabled={!dbReady || loading}
          className="mt-6 rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink-soft hover:border-mute disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      <section className="mt-5 rounded-xl border border-line bg-white p-6" data-testid="admin-users-list">
        <h2 className="text-sm font-bold text-ink">Accounts</h2>
        {loading ? (
          <p className="mt-4 text-sm text-mute">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="mt-4 text-sm text-mute" data-testid="admin-users-empty">No users found.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-mute">
                  <th className="px-2 py-2">Name</th>
                  <th className="px-2 py-2">Email</th>
                  <th className="px-2 py-2">Role</th>
                  <th className="px-2 py-2">Location</th>
                  <th className="px-2 py-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id} className="border-b border-line/70" data-testid="admin-users-row">
                    <td className="px-2 py-3 font-semibold text-ink">{u.full_name || '—'}</td>
                    <td className="px-2 py-3 text-ink-soft">{u.email || '—'}</td>
                    <td className="px-2 py-3">
                      <span className="rounded-full border border-line bg-paper px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-ink-soft">
                        {u.role}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-ink-soft">{[u.city, u.state].filter(Boolean).join(', ') || '—'}</td>
                    <td className="px-2 py-3 text-mute">{u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="mt-6 rounded-xl border border-line bg-white p-6">
        <h2 className="text-sm font-bold text-ink">How role changes work</h2>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-soft">
          <li>· Roles come from <code>ladder_user_roles</code> and are set by the database (signup trigger, or admin grant).</li>
          <li>· To grant admin: run <code>select ladder_grant_admin(&apos;user@example.com&apos;)</code> in the SQL Editor / service context.</li>
          <li>· The client cannot write role rows — this is intentional to prevent privilege escalation.</li>
        </ul>
      </div>
    </DashboardShell>
  )
}