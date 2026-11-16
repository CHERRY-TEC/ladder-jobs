import { useCallback, useEffect, useState } from 'react'
import DashboardShell from '../components/DashboardShell.jsx'
import AdminNav from '../components/AdminNav.jsx'
import { supabase, probeBackend } from '../lib/supabase.js'

/**
 * Admin: category management.
 *
 * Reads ladder_job_categories for everyone, and (with migration 0011 applied)
 * allows admins to add, rename, reorder, and remove categories. Writes are
 * enforced admin-only by RLS; if 0011 isn't applied yet the UI shows the DB error
 * honestly instead of pretending the change succeeded.
 */

const empty = { slug: '', name: '', description: '', sort_order: 0, is_active: true }

export default function AdminCategories() {
  const [backend, setBackend] = useState('checking')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState(empty)

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
      .from('ladder_job_categories')
      .select('id, slug, name, description, sort_order, is_active')
      .order('sort_order', { ascending: true })
    if (err) setError(err.message)
    else setRows(data ?? [])
    setLoading(false)
  }, [dbReady])

  useEffect(() => {
    load()
  }, [load])

  const create = async (e) => {
    e.preventDefault()
    setError(null)
    const slug = draft.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '')
    const name = draft.name.trim()
    if (!slug || !name) {
      setError('Slug and name are required.')
      return
    }
    setBusy(true)
    const { error: err } = await supabase.from('ladder_job_categories').insert({
      slug,
      name,
      description: draft.description.trim() || null,
      sort_order: Number(draft.sort_order) || 0,
      is_active: Boolean(draft.is_active),
    })
    setBusy(false)
    if (err) setError(err.message + (err.code === '42501' ? ' — apply migration 0011 to enable admin category writes.' : ''))
    else {
      setDraft(empty)
      await load()
    }
  }

  const patch = async (id, changes) => {
    setError(null)
    setBusy(true)
    const { error: err } = await supabase.from('ladder_job_categories').update(changes).eq('id', id)
    setBusy(false)
    if (err) setError(err.message + (err.code === '42501' ? ' — apply migration 0011 to enable admin category writes.' : ''))
    else await load()
  }

  const remove = async (row) => {
    if (!window.confirm(`Delete category "${row.name}"? Jobs linked to it may need reassignment.`)) return
    setError(null)
    setBusy(true)
    const { error: err } = await supabase.from('ladder_job_categories').delete().eq('id', row.id)
    setBusy(false)
    if (err) setError(err.message + (err.code === '42501' ? ' — apply migration 0011 to enable admin category writes.' : ''))
    else await load()
  }

  return (
    <DashboardShell
      title="Category management"
      subtitle="Manage job categories shown across the site. Writes require admin access and migration 0011."
    >
      <AdminNav />

      {!dbReady && backend !== 'checking' && (
        <div className="mt-6 rounded-xl border border-line bg-signal px-4 py-3 text-sm text-ink-soft" data-testid="admin-categories-db-notice">
          {backend === 'unconfigured'
            ? 'Supabase is not configured — categories are unavailable.'
            : backend === 'missing'
              ? 'Database not set up yet — run the migrations (see supabase/README.md).'
              : 'Backend connection error — categories are paused until it recovers.'}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-[#fbf0ee] px-3 py-2 text-sm font-semibold text-alert" data-testid="admin-categories-error">
          {error}
        </p>
      )}

      <section className="mt-6 rounded-xl border border-line bg-white p-6">
        <h2 className="text-sm font-bold text-ink">Add category</h2>
        <form onSubmit={create} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5" data-testid="admin-categories-form">
          <label className="block text-sm font-bold">
            Slug
            <input className="mt-1.5 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-base" value={draft.slug} onChange={(e) => setDraft((d) => ({ ...d, slug: e.target.value }))} placeholder="healthcare" />
          </label>
          <label className="block text-sm font-bold">
            Name
            <input className="mt-1.5 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-base" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Healthcare" />
          </label>
          <label className="block text-sm font-bold lg:col-span-2">
            Description
            <input className="mt-1.5 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-base" value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} placeholder="Optional" />
          </label>
          <label className="block text-sm font-bold">
            Sort order
            <input type="number" className="mt-1.5 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-base" value={draft.sort_order} onChange={(e) => setDraft((d) => ({ ...d, sort_order: e.target.value }))} />
          </label>
          <div className="flex items-end gap-3 sm:col-span-2 lg:col-span-5">
            <label className="flex items-center gap-2 text-sm text-ink-soft">
              <input type="checkbox" checked={draft.is_active} onChange={(e) => setDraft((d) => ({ ...d, is_active: e.target.checked }))} />
              Active
            </label>
            <button type="submit" disabled={!dbReady || busy} className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50">
              {busy ? 'Saving…' : 'Add category'}
            </button>
          </div>
        </form>
      </section>

      <section className="mt-5 rounded-xl border border-line bg-white p-6" data-testid="admin-categories-list">
        <h2 className="text-sm font-bold text-ink">Categories</h2>
        {loading ? (
          <p className="mt-4 text-sm text-mute">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="mt-4 text-sm text-mute" data-testid="admin-categories-empty">No categories yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-4" data-testid="admin-categories-row">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-ink">{row.name}</p>
                    <code className="text-xs text-mute">{row.slug}</code>
                    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${row.is_active ? 'bg-signal text-accent border-transparent' : 'bg-paper text-mute border-line'}`}>
                      {row.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <span className="text-xs text-mute">#{row.sort_order}</span>
                  </div>
                  {row.description && <p className="mt-1 text-sm text-ink-soft">{row.description}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={busy} onClick={() => patch(row.id, { is_active: !row.is_active })} className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink-soft hover:border-mute disabled:opacity-50">
                    {row.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button type="button" disabled={busy} onClick={() => {
                    const name = window.prompt('Category name', row.name)
                    if (name == null) return
                    const sort = window.prompt('Sort order', String(row.sort_order ?? 0))
                    patch(row.id, { name: name.trim() || row.name, sort_order: sort == null ? row.sort_order : Number(sort) || 0 })
                  }} className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink-soft hover:border-mute disabled:opacity-50">
                    Edit
                  </button>
                  <button type="button" disabled={busy} onClick={() => remove(row)} className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-alert hover:border-alert disabled:opacity-50">
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </DashboardShell>
  )
}