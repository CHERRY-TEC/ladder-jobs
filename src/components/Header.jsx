import { Link, NavLink } from 'react-router-dom'
import Logo from './Logo.jsx'
import { useStore } from '../lib/store.jsx'
import { useAuth, homeForRole } from '../lib/auth.jsx'
import { LANG_OPTIONS, useLanguage } from '../lib/i18n.jsx'

export default function Header() {
  const { favorites } = useStore()
  const { isAuthenticated, role, roleStatus, profile, user, signOut } = useAuth()
  const { lang, setLang } = useLanguage()

  const linkClass = ({ isActive }) =>
    `px-2 py-2 text-sm font-semibold transition-colors hover:text-ink sm:px-3 ${
      isActive ? 'text-ink' : 'text-mute'
    }`

  const accountLabel = profile?.full_name || (user?.email ?? '').split('@')[0] || 'Account'

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:gap-6">
        <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="Ladder home">
          <Logo className="h-8 w-8" />
          <span className="display text-xl">Ladder</span>
        </Link>

        <nav className="ml-auto flex items-center gap-1 sm:gap-2" aria-label="Main">
          <NavLink to="/" className={linkClass} end>
            <span className="hidden sm:inline">Browse jobs</span>
            <span className="sm:hidden">Jobs</span>
          </NavLink>

          <NavLink to="/saved" className={linkClass}>
            <span className="inline-flex items-center gap-1.5">
              Saved
              {favorites.length > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-signal px-1 text-[11px] font-bold text-ink">
                  {favorites.length}
                </span>
              )}
            </span>
          </NavLink>

          {isAuthenticated ? (
            <span className="ml-1 flex items-center gap-1">
              <select
                aria-label="Language"
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                data-testid="language-select"
                className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink-soft"
              >
                {LANG_OPTIONS.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
              <Link
                to={roleStatus === 'ready' && role ? homeForRole(role) : '/login'}
                className="hidden max-w-32 truncate rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink transition-colors hover:border-mute sm:inline-block"
                title={user?.email ?? ''}
              >
                {accountLabel}
              </Link>
              <button
                onClick={() => signOut()}
                className="rounded-lg px-2 py-2 text-sm font-semibold text-mute transition-colors hover:text-ink"
              >
                <span className="hidden sm:inline">Sign out</span>
                <span className="sm:hidden" aria-label="Sign out">
                  ↩
                </span>
              </button>
            </span>
          ) : (
            <>
              <NavLink to="/login" className={linkClass}>
                <span className="hidden sm:inline">Sign in</span>
                <span className="sm:hidden">Sign in</span>
              </NavLink>
              <Link
                to="/post"
                className="ml-1 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover sm:px-4"
              >
                Post a job
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
