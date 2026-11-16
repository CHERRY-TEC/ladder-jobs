import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import DashboardShell from '../components/DashboardShell.jsx'
import EmployerNav from '../components/EmployerNav.jsx'
import StatusPill, { StatusExplain } from '../components/StatusPill.jsx'
import { supabase } from '../lib/supabase.js'
import { useEmployer } from '../lib/useEmployer.js'
import { VERIFICATION_DOCUMENT_TYPES, VERIFICATION_RULES } from '../data/ladder.js'

const inputClass =
  'mt-1.5 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-base placeholder:text-mute'

const SUBMISSION_LABELS = {
  pending: 'In review',
  approved: 'Approved',
  rejected: 'Rejected',
}

const formatSize = (bytes) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`

function validate(file) {
  const lower = file.name.toLowerCase()
  if (!VERIFICATION_RULES.extensions.some((ext) => lower.endsWith(ext)))
    return `Only ${VERIFICATION_RULES.extensions.join(', ')} files are allowed.`
  if (file.type && !VERIFICATION_RULES.mimeTypes.includes(file.type))
    return `Unsupported file type (${file.type}). ${VERIFICATION_RULES.label}.`
  if (file.size > VERIFICATION_RULES.maxBytes)
    return `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is 10 MB.`
  if (file.size === 0) return 'That file is empty.'
  return null
}

/**
 * Employer verification: submit a registration document → row lands as
 * `pending` (the DB forces it; a client-supplied 'approved' is overwritten by
 * ladder_verifications_lock_status) → admin reviews it on /admin/verifications.
 *
 * The company badge is driven purely by ladder_employers.status, which only the
 * 0005 sync trigger moves. Nothing here can grant it.
 */
export default function Verification() {
  const { backend, company, loading, reload } = useEmployer()
  const dbReady = backend === 'ready'

  const [rows, setRows] = useState([])
  const [listLoading, setListLoading] = useState(true)
  const [docType, setDocType] = useState('gst')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const hasCompany = Boolean(company)

  useEffect(() => {
    if (!dbReady || !company) {
      if (!dbReady || !company) setListLoading(false)
      return
    }
    let alive = true
    setListLoading(true)
    supabase
      .from('ladder_employer_verifications')
      .select('id, document_type, document_path, status, review_notes, submitted_at, reviewed_at')
      .eq('employer_id', company.id)
      .order('submitted_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (!alive) return
        if (err) setError(err.message)
        setRows(data ?? [])
        setListLoading(false)
      })
    return () => {
      alive = false
    }
  }, [dbReady, company])

  const upload = async (file) => {
    if (!file || busy) return
    setError(null)
    if (!hasCompany) {
      setError('Create your company profile first — a document needs a company to attach to.')
      return
    }
    const problem = validate(file)
    if (problem) return setError(problem)

    setBusy(true)
    try {
      const safe = file.name.replace(/[^\w.\-]+/g, '_').slice(-80)
      const ownerPath = `${company.owner_id}/${Date.now()}-${safe}`

      const { error: upErr } = await supabase.storage
        .from('ladder-verification')
        .upload(ownerPath, file, { upsert: false, contentType: file.type || undefined })
      if (upErr) throw new Error(upErr.message)

      // status is deliberately NOT sent — the lock trigger forces 'pending',
      // and omitting it keeps the intent obvious at the call site.
      const { error: insErr } = await supabase.from('ladder_employer_verifications').insert({
        employer_id: company.id,
        submitted_by: company.owner_id,
        document_type: docType,
        document_path: ownerPath,
      })
      if (insErr) {
        await supabase.storage.from('ladder-verification').remove([ownerPath])
        throw new Error(insErr.message)
      }

      await Promise.all([reload(), refresh()])
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const refresh = async () => {
    if (!company) return
    const { data } = await supabase
      .from('ladder_employer_verifications')
      .select('id, document_type, document_path, status, review_notes, submitted_at, reviewed_at')
      .eq('employer_id', company.id)
      .order('submitted_at', { ascending: false })
    setRows(data ?? [])
  }

  const onPick = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    upload(file)
  }

  const view = async (row) => {
    setError(null)
    const { data, error: err } = await supabase.storage
      .from('ladder-verification')
      .createSignedUrl(row.document_path, 120)
    if (err) setError(err.message)
    else window.open(data.signedUrl, '_blank', 'noopener')
  }

  const remove = async (row) => {
    if (row.status === 'approved') {
      setError('This document is what earned the Verified badge — contact support to replace it.')
      return
    }
    if (!window.confirm('Withdraw this submission? You can upload a new one straight after.'))
      return
    setError(null)
    const { error: err } = await supabase
      .from('ladder_employer_verifications')
      .delete()
      .eq('id', row.id)
    if (err) return setError(err.message)
    await supabase.storage.from('ladder-verification').remove([row.document_path])
    await Promise.all([refresh(), reload()])
  }

  const selectedDoc = VERIFICATION_DOCUMENT_TYPES.find((d) => d.id === docType)

  return (
    <DashboardShell
      title="Verification"
      subtitle="Submit a registration document. An admin reviews it — you cannot approve your own."
    >
      <EmployerNav />

      {!dbReady && backend !== 'checking' && (
        <div className="mt-6 rounded-xl border border-line bg-signal px-4 py-3 text-sm text-ink-soft" data-testid="verification-db-notice">
          {backend === 'unconfigured'
            ? 'Supabase is not configured — document upload is disabled. Nothing is faked or stored locally.'
            : backend === 'missing'
              ? 'Database not set up yet — run the migrations (see supabase/README.md) and upload goes live.'
              : 'Backend connection error — upload is paused until it recovers.'}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-[#fbf0ee] px-3 py-2 text-sm font-semibold text-alert" data-testid="verification-error">
          {error}
        </p>
      )}

      {/* ----------------------------------------------------------- status -- */}
      <section className="mt-6 rounded-xl border border-line bg-white p-6" data-testid="verification-status-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <h2 className="text-sm font-bold text-ink">Where your company stands</h2>
            <StatusExplain status={company?.status ?? 'unverified'} />
            {company?.status === 'verified' && company.verified_at && (
              <p className="mt-2 text-xs font-semibold text-accent" data-testid="verified-at">
                Verified on{' '}
                {new Date(company.verified_at).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            )}
            {company?.status === 'rejected' && (
              <p className="mt-2 text-xs text-mute">
                The reviewer's reason is on the most recent submission below.
              </p>
            )}
          </div>
          <StatusPill status={company?.status ?? 'unverified'} />
        </div>
      </section>

      {/* ------------------------------------------------------------ gate -- */}
      {!loading && !hasCompany && (
        <div className="mt-6 rounded-xl border border-line bg-white p-6" data-testid="verification-no-company">
          <h2 className="text-sm font-bold text-ink">Company profile required</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
            A verification document has to attach to a company. Create your company profile first —
            it takes a name and a city.
          </p>
          <Link
            to="/employer/company"
            className="mt-4 inline-block rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover"
            data-testid="go-company"
          >
            Create company profile
          </Link>
        </div>
      )}

      {/* --------------------------------------------------------- upload -- */}
      {hasCompany && (
        <section className="mt-6 rounded-xl border border-line bg-white p-6">
          <h2 className="text-sm font-bold text-ink">Submit a document</h2>

          <label className="mt-4 block max-w-md text-sm font-bold">
            Document type
            <select
              className={inputClass}
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              disabled={!dbReady || busy}
              data-testid="doc-type"
            >
              {VERIFICATION_DOCUMENT_TYPES.map((d) => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
          </label>
          {selectedDoc && (
            <p className="mt-1.5 text-xs text-mute" data-testid="doc-hint">{selectedDoc.hint}</p>
          )}

          <label
            data-testid="verification-dropzone"
            onDragOver={(e) => {
              e.preventDefault()
              if (dbReady && hasCompany) setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              if (dbReady && hasCompany) upload(e.dataTransfer.files?.[0])
            }}
            className={`mt-5 block cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
              dragOver ? 'border-accent bg-signal' : 'border-line bg-white hover:border-mute'
            } ${!dbReady || !hasCompany ? 'cursor-not-allowed opacity-60' : ''}`}
          >
            <input
              type="file"
              accept={VERIFICATION_RULES.extensions.join(',')}
              className="sr-only"
              onChange={onPick}
              disabled={!dbReady || !hasCompany || busy}
              data-testid="verification-input"
            />
            <p className="display text-xl text-ink">{busy ? 'Uploading…' : 'Drop the document here'}</p>
            <p className="mt-2 text-sm text-mute">
              or <span className="font-semibold text-accent">choose a file</span> — {VERIFICATION_RULES.label}
            </p>
            <p className="mt-1 text-xs text-mute">
              Stored privately: only you and admins can open it. Ladder never asks you to pay for verification.
            </p>
          </label>
        </section>
      )}

      {/* ----------------------------------------------------------- list -- */}
      {hasCompany && (
        <section className="mt-6 rounded-xl border border-line bg-white p-6" data-testid="submission-list">
          <h2 className="text-sm font-bold text-ink">Your submissions</h2>

          {listLoading ? (
            <p className="mt-4 text-sm text-mute">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="mt-4 text-sm text-mute" data-testid="submission-empty">
              Nothing submitted yet — a GST certificate, CIN or Udyam registration all work.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {rows.map((row) => (
                <li key={row.id} className="flex flex-wrap items-start gap-3 py-4" data-testid="submission-row">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-ink">
                        {VERIFICATION_DOCUMENT_TYPES.find((d) => d.id === row.document_type)?.label ?? row.document_type}
                      </p>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                          row.status === 'approved'
                            ? 'bg-signal text-accent'
                            : row.status === 'rejected'
                              ? 'bg-[#fbf0ee] text-alert'
                              : 'bg-paper text-mute'
                        }`}
                        data-testid="submission-status"
                        data-status={row.status}
                      >
                        {SUBMISSION_LABELS[row.status] ?? row.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-mute">
                      Submitted {new Date(row.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {row.reviewed_at && (
                        <> · reviewed {new Date(row.reviewed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</>
                      )}
                    </p>
                    {row.status === 'rejected' && row.review_notes && (
                      <p className="mt-2 rounded-lg bg-[#fbf0ee] px-3 py-2 text-sm text-ink-soft" data-testid="review-notes">
                        <strong className="text-alert">Reviewer:</strong> {row.review_notes}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => view(row)}
                      className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft hover:border-mute"
                      data-testid="view-submission"
                    >
                      View
                    </button>
                    {row.status !== 'approved' && (
                      <button
                        onClick={() => remove(row)}
                        className="rounded-lg px-2 py-1.5 text-xs font-semibold text-alert hover:underline"
                        data-testid="withdraw-submission"
                      >
                        Withdraw
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
        <h2 className="text-sm font-bold text-ink">How review works</h2>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-soft">
          <li>· Your document is stored privately and read only by you and the admin team.</li>
          <li>· Submitting sets your company to <strong>in review</strong> — that is not a verified badge.</li>
          <li>· An admin approves or rejects with a written reason; only approval produces the badge.</li>
          <li>· Rejected? Fix what the reviewer flagged and submit again — there is no fee, ever.</li>
        </ul>
      </div>
    </DashboardShell>
  )
}
