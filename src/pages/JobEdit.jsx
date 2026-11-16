import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import DashboardShell from '../components/DashboardShell.jsx'
import EmployerNav from '../components/EmployerNav.jsx'
import JobForm, { autoPayLabel } from '../components/JobForm.jsx'
import { JobStatusExplain, JobStatusPill } from '../components/StatusPill.jsx'
import { useEmployer } from '../lib/useEmployer.js'
import { supabase } from '../lib/supabase.js'

const formatDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

/**
 * Edit one of my vacancies — Phase 6.
 *
 * RLS only lets an owner read their own rows, so an id that isn't mine comes
 * back as "not found" rather than leaking someone else's listing. Saving sends
 * content columns only: status/origin/published_at belong to the database
 * (migration 0008 pins them), so a client write can't touch moderation.
 */
export default function JobEdit() {
  const { id } = useParams()
  const { backend, company, loading } = useEmployer()

  const [job, setJob] = useState(null)
  const [rowLoading, setRowLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [categoryIds, setCategoryIds] = useState({})
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const dbReady = backend === 'ready'

  // slug → uuid for JobForm (it speaks public slugs).
  useEffect(() => {
    if (!dbReady) return
    let alive = true
    supabase
      .from('ladder_job_categories')
      .select('id, slug')
      .then(({ data, error: err }) => {
        if (!alive) return
        if (err) {
          console.info('edit: categories unavailable —', err.message)
          return
        }
        setCategoryIds(Object.fromEntries((data ?? []).map((c) => [c.slug, c.id])))
      })
    return () => {
      alive = false
    }
  }, [dbReady])

  const load = useCallback(async () => {
    if (!company) {
      setRowLoading(false)
      return
    }
    setRowLoading(true)
    const { data, error: err } = await supabase
      .from('ladder_jobs')
      .select(
        'id, title, status, category_id, job_type, education_required, experience_required, ' +
          'work_mode, state, district, city, locality, salary_min, salary_max, salary_period, ' +
          'salary_label, summary, duties, requirements, contact_kind, contact_value, ' +
          'contact_label, created_at, published_at, updated_at',
      )
      .eq('id', id)
      .eq('employer_id', company.id)
      .maybeSingle()
    if (err) setError(err.message)
    if (!data) setNotFound(true)
    else setJob(data)
    setRowLoading(false)
  }, [company, id])

  useEffect(() => {
    if (!dbReady || !company) {
      setRowLoading(false)
      return
    }
    load()
  }, [dbReady, company, load])

  const save = async (payload) => {
    setError(null)
    const { error: err } = await supabase
      .from('ladder_jobs')
      .update(payload)
      .eq('id', job.id)
      .eq('employer_id', company.id)
    if (err) return err.message
    setSaved(true)
    await load()
    return null
  }

  const setStatus = async (status) => {
    setError(null)
    setBusy(true)
    const { error: err } = await supabase
      .from('ladder_jobs')
      .update({ status })
      .eq('id', job.id)
      .eq('employer_id', company.id)
    if (err) setError(err.message)
    else await load()
    setBusy(false)
  }

  /* ------------------------------------------------------------- states -- */

  if (backend === 'checking' || (dbReady && (loading || rowLoading))) {
    return (
      <DashboardShell title="Edit vacancy" subtitle="Loading…">
        <EmployerNav />
        <p className="mt-6 text-sm text-mute">Loading the listing…</p>
      </DashboardShell>
    )
  }

  if (!dbReady) {
    return (
      <DashboardShell title="Edit vacancy" subtitle="Unavailable">
        <EmployerNav />
        <div className="mt-6 rounded-xl border border-line bg-signal px-4 py-3 text-sm text-ink-soft" data-testid="edit-db-notice">
          {backend === 'unconfigured'
            ? 'Supabase is not configured — vacancies cannot be edited.'
            : backend === 'missing'
              ? 'Database not set up yet — run the migrations (see supabase/README.md).'
              : 'Backend connection error — this page is paused until it recovers.'}
        </div>
      </DashboardShell>
    )
  }

  if (!company) {
    return (
      <DashboardShell title="Edit vacancy" subtitle="Company profile required">
        <EmployerNav />
        <div className="mt-6 rounded-xl border border-line bg-white p-6" data-testid="edit-no-company">
          <p className="text-sm leading-relaxed text-ink-soft">
            Vacancies attach to your company. Create the profile first, then edit listings.
          </p>
          <Link
            to="/employer/company"
            className="mt-4 inline-block rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover"
          >
            Create company profile
          </Link>
        </div>
      </DashboardShell>
    )
  }

  if (notFound || (!job && !rowLoading)) {
    return (
      <DashboardShell title="Edit vacancy" subtitle="Not found">
        <EmployerNav />
        <div className="mt-6 rounded-xl border border-line bg-white p-6" data-testid="edit-not-found">
          <p className="text-sm leading-relaxed text-ink-soft">
            This listing does not exist on your account — it may have been removed, or it belongs
            to another company.
          </p>
          <Link
            to="/employer/jobs"
            className="mt-4 inline-block rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover"
          >
            Back to vacancies
          </Link>
        </div>
      </DashboardShell>
    )
  }

  // Reverse map: category_id → slug for the form's select.
  const categorySlug =
    Object.entries(categoryIds).find(([, cid]) => cid === job.category_id)?.[0] ?? 'household'

  const initial = {
    title: job.title,
    category: categorySlug,
    type: job.job_type,
    education: job.education_required,
    experience: job.experience_required,
    workMode: job.work_mode,
    city: job.city ?? '',
    state: job.state ?? '',
    district: job.district ?? '',
    locality: job.locality ?? '',
    payMin: job.salary_min ?? '',
    payMax: job.salary_max ?? '',
    payNote:
      job.salary_label && job.salary_label !== autoPayLabel(job.salary_min, job.salary_max)
        ? job.salary_label
        : '',
    summary: job.summary ?? '',
    duties: (job.duties ?? []).join('\n'),
    requirements: (job.requirements ?? []).join('\n'),
    contact: job.contact_value ?? '',
  }

  return (
    <DashboardShell
      title="Edit vacancy"
      subtitle={job.title}
    >
      <EmployerNav />

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link to="/employer/jobs" className="text-sm font-semibold text-mute hover:text-ink">
          ← All vacancies
        </Link>
        <JobStatusPill status={job.status} />
        {job.status === 'active' && job.published_at && (
          <span className="text-xs text-mute">Live since {formatDate(job.published_at)}</span>
        )}
        {job.status !== 'active' && (
          <span className="text-xs text-mute">Created {formatDate(job.created_at)}</span>
        )}
      </div>

      <div className="mt-2 max-w-2xl">
        <JobStatusExplain status={job.status} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(job.status === 'closed' || job.status === 'rejected' || job.status === 'draft') && (
          <button
            type="button"
            onClick={() => setStatus('pending')}
            disabled={busy}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
            data-testid="edit-resubmit"
          >
            {job.status === 'draft' ? 'Submit for review' : 'Re-submit for review'}
          </button>
        )}
        {job.status === 'active' && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Mark “${job.title}” as filled? It will be removed from the public board.`))
                setStatus('closed')
            }}
            disabled={busy}
            className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-alert hover:border-mute disabled:opacity-50"
            data-testid="edit-close"
          >
            Mark as filled
          </button>
        )}
        {job.status === 'pending' && (
          <span className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-mute">
            In review — content edits are allowed, the status stays with the admins
          </span>
        )}
      </div>

      {saved && (
        <div
          role="status"
          className="mt-4 rounded-lg border border-line bg-signal px-4 py-3 text-sm font-semibold text-ink"
          data-testid="edit-saved"
        >
          Changes saved{job.status === 'active' ? ' — the live listing is updated' : ''}.
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-[#fbf0ee] px-3 py-2 text-sm font-semibold text-alert"
          data-testid="edit-error"
        >
          {error}
        </p>
      )}

      <div className="mt-6 max-w-3xl">
        {/* key → remount the form when the row reloads with fresh values */}
        <JobForm
          key={`${job.id}-${job.updated_at ?? job.status}`}
          initial={initial}
          categoryIds={categoryIds}
          onSubmit={save}
          submitLabel="Save changes"
        />
      </div>

      <p className="mt-6 max-w-2xl text-xs leading-relaxed text-mute">
        Editing content never changes who approved this listing or when it went live — those
        fields are pinned by the database.
      </p>
    </DashboardShell>
  )
}
