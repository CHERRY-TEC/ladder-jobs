import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth, homeForRole } from '../lib/auth.jsx'
import { AuthBanner } from './Login.jsx'
import { checkRateLimit, formatRetryAfter } from '../lib/rateLimit.js'

const inputClass =
  'mt-1.5 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-base placeholder:text-mute'

const ROLES = [
  {
    id: 'seeker',
    title: "I'm looking for work",
    body: 'Search, save and apply. Track every application from Applied to Hired.',
  },
  {
    id: 'employer',
    title: "I'm hiring",
    body: 'Post vacancies, review applicants and manage your company profile.',
  },
]

export default function Signup() {
  const { signUp, isAuthenticated, role, roleStatus, mode } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const presetRole = params.get('role') === 'employer' ? 'employer' : 'seeker'

  const [requestedRole, setRequestedRole] = useState(presetRole)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [needsConfirm, setNeedsConfirm] = useState(false)

  useEffect(() => {
    if (isAuthenticated && roleStatus === 'ready' && role) {
      navigate(homeForRole(role), { replace: true })
    }
  }, [isAuthenticated, roleStatus, role, navigate])

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    const rl = checkRateLimit('auth:signup', { limit: 4, windowMs: 10 * 60_000, blockMs: 10 * 60_000 })
    if (!rl.allowed) {
      setError(`Too many account attempts. Try again in ${formatRetryAfter(rl.retryAfterMs)}.`)
      return
    }
    setBusy(true)
    const res = await signUp({
      email: email.trim(),
      password,
      fullName: fullName.trim(),
      requestedRole, // 'seeker' | 'employer' — server rejects 'admin'
    })
    setBusy(false)
    if (res.error) setError(res.error)
    else if (res.needsConfirm) setNeedsConfirm(true)
    // else: session created → auth listener navigates to the role home
  }

  if (needsConfirm) {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <h1 className="display-tight text-4xl">Check your email</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          We sent a confirmation link to <strong>{email}</strong>. Open it to activate your{' '}
          {requestedRole === 'employer' ? 'employer' : 'job-seeker'} account, then sign in.
        </p>
        <Link
          to="/login"
          className="mt-6 inline-block rounded-lg bg-accent px-5 py-2.5 font-semibold text-white hover:bg-accent-hover"
        >
          Go to sign-in
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="display-tight text-4xl sm:text-5xl">Create your account</h1>
      <p className="mt-2 text-mute">Free for job seekers. Employers start on the free plan.</p>

      <AuthBanner />

      <form onSubmit={onSubmit} className="mt-6" data-testid="signup-form">
        <fieldset className="rounded-xl border border-line bg-white p-4">
          <legend className="px-2 text-sm font-bold">I am…</legend>
          <div className="grid gap-2">
            {ROLES.map((r) => (
              <button
                type="button"
                key={r.id}
                onClick={() => setRequestedRole(r.id)}
                aria-pressed={requestedRole === r.id}
                data-testid={`role-${r.id}`}
                className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                  requestedRole === r.id
                    ? 'border-accent bg-signal'
                    : 'border-line hover:border-mute'
                }`}
              >
                <span className="block text-sm font-bold text-ink">{r.title}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-mute">{r.body}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mt-4 rounded-xl border border-line bg-white p-6">
          <label className="block text-sm font-bold">
            Full name
            <input
              required
              minLength={2}
              autoComplete="name"
              className={inputClass}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name"
            />
          </label>

          <label className="mt-4 block text-sm font-bold">
            Email
            <input
              type="email"
              required
              autoComplete="email"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>

          <label className="mt-4 block text-sm font-bold">
            Password
            <input
              type="password"
              required
              autoComplete="new-password"
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </label>

          {error && (
            <p role="alert" className="mt-4 rounded-lg bg-[#fbf0ee] px-3 py-2 text-sm font-semibold text-alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || mode === 'unconfigured'}
            className="mt-6 w-full rounded-lg bg-accent px-4 py-2.5 font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Creating account…' : 'Create account'}
          </button>

          <p className="mt-4 text-center text-sm text-mute">
            Already registered?{' '}
            <Link to="/login" className="font-semibold text-accent underline underline-offset-2">
              Sign in
            </Link>
          </p>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-mute">
          Roles are assigned by the database — accounts can never grant themselves admin.
        </p>
      </form>
    </div>
  )
}
