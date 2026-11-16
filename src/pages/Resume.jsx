import { useEffect, useState } from 'react'
import DashboardShell from '../components/DashboardShell.jsx'
import SeekerNav from '../components/SeekerNav.jsx'
import { useAuth } from '../lib/auth.jsx'
import { supabase, probeBackend } from '../lib/supabase.js'
import { RESUME_RULES } from '../data/ladder.js'

const ACCEPT = RESUME_RULES.extensions.join(',')

function validate(file) {
  const lower = file.name.toLowerCase()
  const extOk = RESUME_RULES.extensions.some((ext) => lower.endsWith(ext))
  if (!extOk) return `Only ${RESUME_RULES.extensions.join(', ')} files are allowed.`
  if (!RESUME_RULES.mimeTypes.includes(file.type) && file.type !== '')
    return `Unsupported file type (${file.type || 'unknown'}). ${RESUME_RULES.label}.`
  if (file.size > RESUME_RULES.maxBytes)
    return `File is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is 5 MB.`
  if (file.size === 0) return 'That file is empty.'
  return null
}

const formatSize = (bytes) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`

export default function Resume() {
  const { user } = useAuth()
  const [backend, setBackend] = useState('checking')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [dragOver, setDragOver] = useState(false)

  const dbReady = backend === 'ready'

  useEffect(() => {
    let alive = true
    probeBackend().then((s) => alive && setBackend(s))
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!dbReady || !user) {
      if (!dbReady) setLoading(false)
      return
    }
    let alive = true
    supabase
      .from('ladder_resumes')
      .select('id, file_path, file_name, size_bytes, mime_type, is_primary, created_at')
      .eq('profile_id', user.id)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (!alive) return
        if (err) setError(err.message)
        else setRows(data ?? [])
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [dbReady, user])

  const upload = async (file) => {
    if (!file || busy) return
    setError(null)
    const problem = validate(file)
    if (problem) {
      setError(problem)
      return
    }
    setBusy(true)
    try {
      // Private bucket path convention: <uid>/<unique-filename>
      const safe = file.name.replace(/[^\w.\-]+/g, '_').slice(-80)
      const path = `${user.id}/${Date.now()}-${safe}`

      const { error: upErr } = await supabase.storage
        .from('ladder-resumes')
        .upload(path, file, { upsert: false, contentType: file.type || undefined })
      if (upErr) throw new Error(upErr.message)

      const { error: insErr } = await supabase.from('ladder_resumes').insert({
        profile_id: user.id,
        file_path: path,
        file_name: file.name,
        size_bytes: file.size,
        mime_type: file.type || 'application/pdf',
        // First resume becomes primary automatically.
        is_primary: rows.length === 0,
      })
      if (insErr) {
        // Roll the orphan upload back so storage never drifts from the table.
        await supabase.storage.from('ladder-resumes').remove([path])
        throw new Error(insErr.message)
      }

      const { data } = await supabase
        .from('ladder_resumes')
        .select('id, file_path, file_name, size_bytes, mime_type, is_primary, created_at')
        .eq('profile_id', user.id)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: false })
      setRows(data ?? [])
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const onPick = (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    upload(file)
  }

  const setPrimary = async (id) => {
    setError(null)
    // Partial unique index: clear the current primary first, then set the new one.
    const { error: clearErr } = await supabase
      .from('ladder_resumes')
      .update({ is_primary: false })
      .eq('profile_id', user.id)
      .eq('is_primary', true)
    if (clearErr) return setError(clearErr.message)
    const { error: err } = await supabase
      .from('ladder_resumes')
      .update({ is_primary: true })
      .eq('id', id)
    if (err) setError(err.message)
    else setRows((list) => list.map((r) => ({ ...r, is_primary: r.id === id })))
  }

  const remove = async (row) => {
    if (!window.confirm(`Delete "${row.file_name}"? Applications that already use it keep their copy attached until you withdraw them.`))
      return
    setError(null)
    const { error: err } = await supabase.from('ladder_resumes').delete().eq('id', row.id)
    if (err) return setError(err.message)
    await supabase.storage.from('ladder-resumes').remove([row.file_path])
    setRows((list) => list.filter((r) => r.id !== row.id))
  }

  const open = async (row) => {
    setError(null)
    const { data, error: err } = await supabase.storage
      .from('ladder-resumes')
      .createSignedUrl(row.file_path, 120)
    if (err) setError(err.message)
    else window.open(data.signedUrl, '_blank', 'noopener')
  }

  return (
    <DashboardShell title="My Resume" subtitle="Attach a real file — employers download exactly what you upload.">
      <SeekerNav />

      {!dbReady && backend !== 'checking' && (
        <div className="mt-6 rounded-xl border border-line bg-signal px-4 py-3 text-sm text-ink-soft" data-testid="resume-db-notice">
          {backend === 'unconfigured'
            ? 'Supabase is not configured — resume upload is disabled. Nothing is faked or stored locally.'
            : backend === 'missing'
              ? 'Database not set up yet — run the migrations (see supabase/README.md) and upload goes live.'
              : 'Backend connection error — upload is paused until it recovers.'}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-[#fbf0ee] px-3 py-2 text-sm font-semibold text-alert" data-testid="resume-error">
          {error}
        </p>
      )}

      {/* ------------------------------------------------------------ dropzone */}
      <label
        data-testid="resume-dropzone"
        onDragOver={(e) => {
          e.preventDefault()
          if (dbReady) setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          if (dbReady) upload(e.dataTransfer.files?.[0])
        }}
        className={`mt-6 block cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          dragOver ? 'border-accent bg-signal' : 'border-line bg-white hover:border-mute'
        } ${!dbReady ? 'cursor-not-allowed opacity-60' : ''}`}
      >
        <input
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={onPick}
          disabled={!dbReady || busy}
          data-testid="resume-input"
        />
        <p className="display text-xl text-ink">{busy ? 'Uploading…' : 'Drop your resume here'}</p>
        <p className="mt-2 text-sm text-mute">
          or <span className="font-semibold text-accent">choose a file</span> — {RESUME_RULES.label}
        </p>
        <p className="mt-1 text-xs text-mute">Stored privately: only you, admins, and employers you apply to can open it.</p>
      </label>

      {/* --------------------------------------------------------------- list */}
      <section className="mt-6 rounded-xl border border-line bg-white p-6" data-testid="resume-list-section">
        <h2 className="text-sm font-bold text-ink">Uploaded resumes</h2>

        {loading ? (
          <p className="mt-4 text-sm text-mute">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="mt-4 text-sm text-mute" data-testid="resume-empty">
            {dbReady ? 'No resume yet — add one so you can apply in a single click.' : '—'}
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-3 py-3" data-testid="resume-row">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink">{row.file_name}</p>
                  <p className="mt-0.5 text-xs text-mute">
                    {formatSize(row.size_bytes)} · uploaded{' '}
                    {new Date(row.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </div>

                {row.is_primary && (
                  <span className="rounded-full bg-signal px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-accent">
                    Primary
                  </span>
                )}

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => open(row)}
                    className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft hover:border-mute"
                  >
                    View
                  </button>
                  {!row.is_primary && (
                    <button
                      onClick={() => setPrimary(row.id)}
                      className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft hover:border-mute"
                    >
                      Make primary
                    </button>
                  )}
                  <button
                    onClick={() => remove(row)}
                    className="rounded-lg px-2 py-1.5 text-xs font-semibold text-alert hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-6 text-xs leading-relaxed text-mute">
        Applications that already reference a resume keep pointing at it until you withdraw them —
        deleting a file here does not rewrite history.
      </p>
    </DashboardShell>
  )
}
