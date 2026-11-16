import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { AuthBanner } from './Login.jsx'

const inputClass =
  'mt-1.5 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-base placeholder:text-mute'

/**
 * Admin sign-in. Credentials go through the same Supabase auth as everyone
 * else; access depends ONLY on the database role row (granted via
 * ladder_grant_admin), never on anything the client can set.
 */
export default function AdminLogin() {
  const { signIn, isAuthenticated, role, roleStatus, mode, signOut } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const checkedRef = useRef(false)

  const signedInNotAdmin = isAuthenticated && roleStatus === 'ready' && role !== 'admin'

  useEffect(() => {
    if (isAuthenticated && roleStatus === 'ready' && role === 'admin' && !checkedRef.current) {
      checkedRef.current = true
      navigate('/admin', { replace: true })
    }
  }, [isAuthenticated, roleStatus, role, navigate])

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const res = await signIn({ email: email.trim(), password })
    setBusy(false)
    if (res.error) setError(res.error)
    // Success → auth listener fires; effect above redirects if role is admin.
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="display-tight text-4xl">Admin sign-in</h1>
      <p className="mt-2 text-mute">
        Restricted area. The database decides who is an admin.
      </p>

      <AuthBanner />

      {signedInNotAdmin ? (
        <div className="mt-6 rounded-xl border border-line bg-white p-6" data-testid="not-admin">
          <p className="text-sm font-bold text-ink">This account is not an administrator.</p>
          <p className="mt-2 text-sm leading-relaxed text-mute">
            You signed in as <strong>{role}</strong>. Admin rights are granted from the SQL
            Editor with <code>ladder_grant_admin('&lt;email&gt;')</code> — never from the
            client.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              to={role === 'employer' ? '/employer' : '/me'}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
            >
              Go to my dashboard
            </Link>
            <button
              onClick={() => signOut()}
              className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink-soft hover:border-mute"
            >
              Sign out
            </button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={onSubmit}
          className="mt-6 rounded-xl border border-line bg-white p-6"
          data-testid="admin-login-form"
        >
          <label className="block text-sm font-bold">
            Admin email
            <input
              type="email"
              required
              autoComplete="email"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
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
            {busy ? 'Verifying…' : 'Sign in as admin'}
          </button>
        </form>
      )}

      <p className="mt-4 text-center text-xs text-mute">
        Not an admin? <Link to="/login" className="underline underline-offset-2">Regular sign-in</Link>
      </p>
    </div>
  )
}
