import { useCallback, useEffect, useState } from 'react'
import DashboardShell from '../components/DashboardShell.jsx'
import AdminNav from '../components/AdminNav.jsx'
import StatusPill from '../components/StatusPill.jsx'
import { useAuth } from '../lib/auth.jsx'
import { supabase, probeBackend } from '../lib/supabase.js'
import { VERIFICATION_DOCUMENT_TYPES } from '../data/ladder.js'

const inputClass =
  'mt-1.5 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-base placeholder:text-mute'

const docLabel = (id) =>
  VERIFICATION_DOCUMENT_TYPES.find((d) => d.id === id)?.label ?? id

/**
 * Admin: employer verification review.
 *
 * This is the ONLY screen in Ladder that can grant the Verified badge, and even
 * here it is indirect — approving writes `status='approved'` on the submission,
 * and the 0005 sync trigger moves `ladder_employers.status`. The company row is
 * never edited directly, so there is no second path to a badge.
 *
 * Every decision is written to `ladder_admin_audit_logs` (admin-only RLS).
 */
export default function AdminVerifications() {
  const { user } = useAuth()
  const [backend, setBackend] = useState('checking')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [notes, setNotes] = useState({})
  const [filter, setFilter] = useState('pending')

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
      .from('ladder_employer_verifications')
      .select(
        'id, document_type, document_path, status, review_notes, submitted_at, reviewed_at, ' +
          'employer:ladder_employers!inner(id, company_name, city, status, verified_at, owner_id), ' +
          'submitter:ladder_profiles!ladder_employer_verifications_submitted_by_fkey(full_name, email)',
      )
      .order('submitted_at', { ascending: true })
    if (err) setError(err.message)
    else setRows(data ?? [])
    setLoading(false)
  }, [dbReady])

  useEffect(() => {
    load()
  }, [load])

  const visible = rows.filter((r) => (filter === 'all' ? true : r.status === filter))
  const counts = {
    pending: rows.filter((r) => r.status === 'pending').length,
    approved: rows.filter((r) => r.status === 'approved').length,
    rejected: rows.filter((r) => r.status === 'rejected').length,
    all: rows.length,
  }

  const decide = async (row, status) => {
    setError(null)
    const note = (notes[row.id] ?? '').trim()
    if (status === 'rejected' && note.length < 5) {
      setError('Rejections need a written reason the employer can act on (at least 5 characters).')
      return
    }
    if (status === 'approved' && !window.confirm(
      `Approve ${row.employer?.company_name ?? 'this company'}? This grants the public Verified badge.`,
    )) return

    setBusyId(row.id)
    try {
      // reviewer_id + reviewed_at are also defaulted server-side (0005), but
      // sending them keeps the intent explicit and the audit trail complete.
      const { error: err } = await supabase
        .from('ladder_employer_verifications')
        .update({
          status,
          review_notes: note || null,
          reviewer_id: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', row.id)
        .eq('status', 'pending') // never overwrite an already-decided row
      if (err) throw new Error(err.message)

      const { error: auditErr } = await supabase.from('ladder_admin_audit_logs').insert({
        admin_id: user.id,
        action: status === 'approved' ? 'verification.approved' : 'verification.rejected',
        entity_type: 'employer_verification',
        entity_id: row.id,
        details: {
          employer_id: row.employer?.id ?? null,
          company_name: row.employer?.company_name ?? null,
          document_type: row.document_type,
          note: note || null,
        },
      })
      if (auditErr) console.warn('audit log write failed:', auditErr.message)

      setNotes((n) => ({ ...n, [row.id]: '' }))
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusyId(null)
    }
  }

  const openDoc = async (row) => {
    setError(null)
    const { data, error: err } = await supabase.storage
      .from('ladder-verification')
      .createSignedUrl(row.document_path, 120)
    if (err) setError(err.message)
    else window.open(data.signedUrl, '_blank', 'noopener')
  }

  return (
    <DashboardShell
      title="Employer verification"
      subtitle="Read the document, then approve or reject with a reason. Approval is what grants the badge."
    >
      <AdminNav />

      {!dbReady && backend !== 'checking' && (
        <div className="mt-6 rounded-xl border border-line bg-signal px-4 py-3 text-sm text-ink-soft" data-testid="admin-verification-db-notice">
          {backend === 'unconfigured'
            ? 'Supabase is not configured — the review queue cannot load.'
            : backend === 'missing'
              ? 'Database not set up yet — run the migrations (see supabase/README.md).'
              : 'Backend connection error — the queue is paused until it recovers.'}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-[#fbf0ee] px-3 py-2 text-sm font-semibold text-alert" data-testid="admin-verification-error">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Filter submissions">
        {['pending', 'approved', 'rejected', 'all'].map((key) => (
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
            data-testid={`filter-${key}`}
          >
            {key[0].toUpperCase() + key.slice(1)}
            <span className="ml-1.5 text-xs text-mute">{counts[key]}</span>
          </button>
        ))}
      </div>

      <section className="mt-5 rounded-xl border border-line bg-white p-6" data-testid="review-queue">
        <h2 className="text-sm font-bold text-ink">
          {filter === 'all' ? 'All submissions' : `${filter[0].toUpperCase() + filter.slice(1)} submissions`}
        </h2>

        {loading ? (
          <p className="mt-4 text-sm text-mute">Loading…</p>
        ) : visible.length === 0 ? (
          <p className="mt-4 text-sm text-mute" data-testid="review-empty">
            {filter === 'pending'
              ? 'No documents waiting for review.'
              : `No ${filter} submissions.`}
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {visible.map((row) => (
              <li key={row.id} className="rounded-xl border border-line p-5" data-testid="review-row">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-bold text-ink">
                        {row.employer?.company_name ?? 'Unknown company'}
                      </p>
                      <StatusPill status={row.employer?.status ?? 'unverified'} />
                    </div>
                    <p className="mt-1 text-sm text-ink-soft">
                      {docLabel(row.document_type)} · submitted{' '}
                      {new Date(row.submitted_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                      {row.employer?.city && <> · {row.employer.city}</>}
                    </p>
                    <p className="mt-1 text-xs text-mute">
                      {row.submitter?.full_name || row.submitter?.email || 'Unknown submitter'}
                      {row.reviewed_at && (
                        <> · reviewed {new Date(row.reviewed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</>
                      )}
                    </p>
                    {row.review_notes && (
                      <p className="mt-2 text-xs text-ink-soft">
                        <strong>Previous note:</strong> {row.review_notes}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openDoc(row)}
                      className="rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink-soft hover:border-mute"
                      data-testid="open-document"
                    >
                      Open document
                    </button>
                  </div>
                </div>

                {row.status === 'pending' && (
                  <div className="mt-4 border-t border-line pt-4">
                    <label className="block text-sm font-bold">
                      Reviewer note
                      <span className="mb-1 block text-xs font-normal text-mute">
                        Required when rejecting — the employer sees this word for word.
                      </span>
                      <textarea
                        rows={2}
                        maxLength={500}
                        className={inputClass}
                        value={notes[row.id] ?? ''}
                        onChange={(e) => setNotes((n) => ({ ...n, [row.id]: e.target.value }))}
                        placeholder="GSTIN does not match the company name on the profile."
                        disabled={busyId === row.id}
                        data-testid="review-notes-input"
                      />
                    </label>
                    <div className="mt-3 flex flex-wrap gap-3">
                      <button
                        onClick={() => decide(row, 'approved')}
                        disabled={busyId === row.id}
                        className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                        data-testid="approve-button"
                      >
                        {busyId === row.id ? 'Saving…' : 'Approve & grant badge'}
                      </button>
                      <button
                        onClick={() => decide(row, 'rejected')}
                        disabled={busyId === row.id}
                        className="rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-alert hover:border-alert disabled:cursor-not-allowed disabled:opacity-50"
                        data-testid="reject-button"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )}

                {row.status !== 'pending' && (
                  <p className="mt-3 text-xs text-mute" data-testid="decision-record">
                    {row.status === 'approved'
                      ? 'Approved — this submission is what keeps the Verified badge on the company.'
                      : 'Rejected — the employer can submit a corrected document.'}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-6 rounded-xl border border-line bg-white p-6">
        <h2 className="text-sm font-bold text-ink">What approval actually does</h2>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-soft">
          <li>· You update this submission row — you never edit the company's status directly.</li>
          <li>· A database trigger (migration 0005) moves the company to <strong>verified</strong> and stamps the date.</li>
          <li>· Rejecting writes your note; the company can re-submit, and a previous approval still stands.</li>
          <li>· Every decision is written to the audit log with your admin id.</li>
        </ul>
      </div>
    </DashboardShell>
  )
}
