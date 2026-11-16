import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import JobForm from '../components/JobForm.jsx'
import { useAuth } from '../lib/auth.jsx'
import { useEmployer } from '../lib/useEmployer.js'
import { supabase } from '../lib/supabase.js'

/**
 * Post a job — Phase 6.
 *
 * For a signed-in employer this writes a real `ladder_jobs` row (status is
 * never sent: RLS + ladder_jobs_lock_status force it to 'pending', so the
 * listing reaches seekers only after admin moderation). Everyone else gets an
 * honest gate instead of a demo form that only pretends to publish.
 */
export default function PostJob() {
  const { mode, isAuthenticated, role, signOut } = useAuth()
  const { backend, company } = useEmployer()
  const navigate = useNavigate()

  const [categoryIds, setCategoryIds] = useState({})

  const authLoading = mode === 'loading'
  const dbReady = backend === 'ready'
  const isEmployer = isAuthenticated && role === 'employer'

  // slug → uuid, so the form can keep speaking the public category slugs.
  useEffect(() => {
    if (!dbReady) return
    let alive = true
    supabase
      .from('ladder_job_categories')
      .select('id, slug')
      .then(({ data, error: err }) => {
        if (!alive) return
        if (err) {
          console.info('post: categories unavailable —', err.message)
          return
        }
        setCategoryIds(Object.fromEntries((data ?? []).map((c) => [c.slug, c.id])))
      })
    return () => {
      alive = false
    }
  }, [dbReady])

  const publish = async (payload) => {
    const { error: err } = await supabase.from('ladder_jobs').insert({
      ...payload,
      employer_id: company.id,
      // status/origin/published_at deliberately absent — the database owns them.
    })
    if (err) return err.message
    navigate('/employer/jobs', { state: { posted: payload.title } })
    return null
  }

  /* ------------------------------------------------------------- gates -- */

  if (authLoading || backend === 'checking') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-mute">Checking your account…</div>
    )
  }

  const gate = (title, body, actions) => (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="display-tight text-4xl sm:text-5xl">{title}</h1>
      <div className="mt-6 rounded-xl border border-line bg-white p-6" data-testid="post-gate">
        <p className="max-w-xl text-[15px] leading-relaxed text-ink-soft">{body}</p>
        <div className="mt-5 flex flex-wrap gap-3">{actions}</div>
      </div>
      <p className="mt-6 max-w-xl text-sm leading-relaxed text-mute">
        Ladder listings are real: they are reviewed by an admin before seekers see them, and the
        platform never charges a fee to post or to apply.
      </p>
    </div>
  )

  if (!isAuthenticated) {
    return gate(
      'Post a job',
      'Posting on Ladder needs an employer account — every vacancy is attached to a real company ' +
        'profile so seekers know who is hiring. Creating one takes a minute.',
      <>
        <Link
          to="/signup"
          className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-white hover:bg-accent-hover"
          data-testid="post-signup"
        >
          Create an employer account
        </Link>
        <Link
          to="/login"
          className="rounded-lg border border-line bg-white px-5 py-2.5 font-semibold text-ink-soft hover:border-mute"
        >
          Sign in
        </Link>
      </>,
    )
  }

  if (role === 'seeker') {
    return gate(
      'This account applies for work',
      'Seeker accounts browse and apply — they do not publish vacancies. Post with an employer ' +
        'account instead (you can create a separate one for hiring).',
      <>
        <Link
          to="/me"
          className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-white hover:bg-accent-hover"
        >
          Back to my dashboard
        </Link>
        <button
          type="button"
          onClick={() => signOut()}
          className="rounded-lg border border-line bg-white px-5 py-2.5 font-semibold text-ink-soft hover:border-mute"
          data-testid="post-signout"
        >
          Sign out & use an employer account
        </button>
      </>,
    )
  }

  if (role === 'admin') {
    return gate(
      'Admin accounts moderate, they do not post',
      'Your admin account reviews vacancies from other employers. Sign in with an employer account ' +
        'to publish a listing of your own.',
      <Link
        to="/admin"
        className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-white hover:bg-accent-hover"
      >
        Back to admin
      </Link>,
    )
  }

  if (!isEmployer) {
    return gate(
      'Employer account required',
      'Only employer accounts can publish vacancies. This account has no employer role — sign in ' +
        'with an employer account to post.',
      <Link
        to="/login"
        className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-white hover:bg-accent-hover"
      >
        Sign in
      </Link>,
    )
  }

  if (!dbReady) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="display-tight text-4xl sm:text-5xl">Post a job</h1>
        <div className="mt-6 rounded-xl border border-line bg-signal px-4 py-3 text-sm text-ink-soft" data-testid="post-db-notice">
          {backend === 'unconfigured'
            ? 'Supabase is not configured — vacancies cannot be saved. Nothing is faked or stored locally.'
            : backend === 'missing'
              ? 'Database not set up yet — run the migrations (see supabase/README.md) and posting goes live.'
              : 'Backend connection error — posting is paused until it recovers.'}
        </div>
      </div>
    )
  }

  if (!company) {
    return gate(
      'Company profile first',
      'A vacancy has to belong to a company. Create your company profile — a name and a city is ' +
        'enough — then come back and post.',
      <Link
        to="/employer/company"
        className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-white hover:bg-accent-hover"
        data-testid="post-go-company"
      >
        Create company profile
      </Link>,
    )
  }

  /* -------------------------------------------------------------- form -- */

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link to="/employer" className="text-sm font-semibold text-mute hover:text-ink">
        ← Employer dashboard
      </Link>

      <h1 className="display-tight mt-4 text-4xl sm:text-5xl">Post a job</h1>
      <p className="mt-3 max-w-xl text-lg text-ink-soft">
        Posting as <strong>{company.company_name}</strong>. Be specific about pay and education —
        it is what helps the right people apply.
      </p>

      <div className="mt-5 rounded-lg border border-line bg-signal px-4 py-3 text-sm font-semibold text-ink">
        New listings start <strong>in review</strong>: an admin approves them before seekers see
        the vacancy on the board.
      </div>

      <div className="mt-6">
        <JobForm categoryIds={categoryIds} onSubmit={publish} submitLabel="Submit for review" />
      </div>

      <p className="mt-6 text-xs leading-relaxed text-mute">
        Saved to the database as <code>pending</code> — the status is set by the database, not by
        this form, so it can never skip moderation.
      </p>
    </div>
  )
}
