import { Navigate, useLocation } from 'react-router-dom'
import { useAuth, homeForRole } from '../lib/auth.jsx'

/**
 * Role-gated route guard.
 *
 * - not configured  → honest "backend missing" notice (no fake session)
 * - signed out      → /login?next=<destination>
 * - role missing    → notice pointing at migrations (never silent)
 * - wrong role      → redirect to the visitor's own area
 *
 * A signed-in account with NO role row shows a notice instead of redirecting,
 * so a null-role user can never bounce in a redirect loop.
 */
export default function RequireAuth({ role, children }) {
  const { mode, isAuthenticated, role: userRole, roleStatus } = useAuth()
  const location = useLocation()

  if (mode === 'unconfigured') {
    return (
      <Notice
        title="Sign-in needs the backend"
        body="Supabase env vars are missing from .env.local, so there is no session to check. Nothing is simulated here."
      />
    )
  }

  if (mode === 'loading' || (isAuthenticated && roleStatus === 'loading')) {
    return <Notice title="Checking your session…" body="One moment." quiet />
  }

  if (!isAuthenticated) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }

  if (roleStatus === 'missing') {
    return (
      <Notice
        title="Database not set up yet"
        body="You are signed in, but the KAAMVORI database tables don't exist in this project. Run the migrations first — see supabase/README.md."
      />
    )
  }

  if (roleStatus === 'error') {
    return (
      <Notice
        title="Could not read your role"
        body="The database refused the role lookup. Check the Supabase connection and try again."
      />
    )
  }

  if (userRole === null) {
    return (
      <Notice
        title="This account has no role"
        body="Your account exists but no role was assigned (it may have been created before the database was set up). Grant one with ladder_grant_admin('<email>') for admins, or create a fresh account after migrations are applied."
      />
    )
  }

  if (role && userRole !== role) {
    return <Navigate to={homeForRole(userRole)} replace />
  }

  return children
}

function Notice({ title, body, quiet }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <div
        data-testid="auth-notice"
        className={`rounded-xl border bg-white p-8 text-center ${
          quiet ? 'border-line' : 'border-line'
        }`}
      >
        <p className="display text-xl">{title}</p>
        <p className="mt-2 text-sm leading-relaxed text-mute">{body}</p>
      </div>
    </div>
  )
}
