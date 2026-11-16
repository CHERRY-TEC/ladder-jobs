import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'

/**
 * Shared dashboard chrome for the three role areas: identity card, role badge,
 * sign-out. Subclasses fill `children` per role.
 */
export default function DashboardShell({ title, subtitle, children }) {
  const { profile, role, roleStatus, user, signOut } = useAuth()

  const name = profile?.full_name || user?.email || 'Your account'
  const email = profile?.email || user?.email || ''

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="display-tight text-4xl sm:text-5xl">{title}</h1>
          {subtitle && <p className="mt-2 text-mute">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-line bg-white px-4 py-2.5 text-right">
            <p className="text-sm font-bold text-ink" data-testid="account-name">
              {name}
            </p>
            <p className="text-xs text-mute">{email}</p>
            {roleStatus === 'ready' && role && (
              <span className="mt-1 inline-block rounded-full bg-signal px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
                {role}
              </span>
            )}
          </div>
          <button
            onClick={() => signOut()}
            data-testid="sign-out"
            className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink-soft transition-colors hover:border-mute hover:text-ink"
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="mt-8">{children}</div>

      <p className="mt-10 text-sm text-mute">
        Need something else?{' '}
        <Link to="/#browse" className="font-semibold text-accent underline underline-offset-2">
          Back to all listings
        </Link>
      </p>
    </div>
  )
}
