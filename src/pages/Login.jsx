import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth, homeForRole } from '../lib/auth.jsx'
import { isSupabaseConfigured } from '../lib/supabase.js'
import { checkRateLimit, formatRetryAfter } from '../lib/rateLimit.js'

const inputClass =
  'mt-1.5 w-full rounded-lg border border-line bg-[#fdfbf7] px-3.5 py-3 text-base placeholder:text-mute transition-shadow focus:bg-white focus:shadow-[0_0_0_3px_var(--color-signal)]'

export function AuthBanner() {
  if (isSupabaseConfigured) return null
  return (
    <div className="mb-6 rounded-xl border border-line bg-signal px-4 py-3 text-sm text-ink-soft">
      Supabase is not configured in <code>.env.local</code> — sign-in is disabled. Nothing is
      simulated: create an account once the backend is wired up.
    </div>
  )
}

export default function Login() {
  const { signIn, isAuthenticated, role, roleStatus, mode } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  // Already signed in? Go where this account belongs.
  useEffect(() => {
    if (isAuthenticated && roleStatus === 'ready' && role) {
      navigate(next || homeForRole(role), { replace: true })
    }
  }, [isAuthenticated, roleStatus, role, navigate, next])

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    const rl = checkRateLimit('auth:login', { limit: 6, windowMs: 60_000, blockMs: 60_000 })
    if (!rl.allowed) {
      setError(`Too many sign-in attempts. Try again in ${formatRetryAfter(rl.retryAfterMs)}.`)
      return
    }
    setBusy(true)
    const res = await signIn({ email: email.trim(), password })
    setBusy(false)
    if (res.error) setError(res.error)
    // On success the auth listener updates state; the effect above navigates.
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">KAAMVORI</p>
        <h1 className="display-tight mt-2 text-4xl sm:text-5xl">Welcome back</h1>
        <p className="mt-3 text-mute">Sign in to continue to your account.</p>
      </div>

      <AuthBanner />

      <form
        onSubmit={onSubmit}
        className="mt-8 rounded-2xl border border-line bg-white p-6 shadow-sm sm:p-7"
        data-testid="login-form"
      >
        <label className="block text-sm font-bold">
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
            autoComplete="current-password"
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
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
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="mt-4 text-center text-sm text-mute">
          New here?{' '}
          <Link to="/signup" className="font-semibold text-accent underline underline-offset-2">
            Create an account
          </Link>
        </p>
      </form>

      <p className="mt-4 text-center text-xs text-mute">
        Admin? Use the <Link to="/admin/login" className="underline underline-offset-2">admin sign-in</Link>.
      </p>
    </div>
  )
}
