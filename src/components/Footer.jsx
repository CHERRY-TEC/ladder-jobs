import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Logo from './Logo.jsx'
import { CATEGORIES } from '../data/seed.js'
import { isSupabaseConfigured, probeBackend } from '../lib/supabase.js'

/**
 * Honest backend status — never claims a connection we don't have:
 *   "unconfigured"    env vars missing
 *   "ready"           a real GET on a ladder_ table returned OK
 *   "missing"         env present, schema absent (run migrations)
 *   "error"           anything else (offline, bad key, …)
 */
function useBackendStatus() {
  const [status, setStatus] = useState(() =>
    isSupabaseConfigured ? 'checking' : 'unconfigured',
  )

  useEffect(() => {
    let alive = true
    probeBackend().then((s) => {
      if (alive) setStatus(s)
    })
    return () => {
      alive = false
    }
  }, [])

  return status
}

export default function Footer() {
  const backend = useBackendStatus()
  const label = {
    checking: 'Backend: checking…',
    unconfigured: 'Backend: not configured (demo + feed data only)',
    ready: 'Backend: Supabase connected',
    missing: 'Backend: configured — run migrations (see supabase/README.md)',
    error: 'Backend: configured — connection error',
  }[backend]

  return (
    <footer className="mt-20 border-t border-line bg-[#f3efe7]">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Logo className="h-9 w-9" />
            <span className="display text-xl tracking-wide">KAAMVORI</span>
          </div>
          <p className="mt-4 max-w-60 text-sm leading-relaxed text-ink-soft">
            Every Person Deserves an Opportunity.
          </p>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-mute">Trusted opportunities, clearly presented</p>
        </div>

        <div>
          <h2 className="text-sm font-bold text-ink">Browse</h2>
          <ul className="mt-3 space-y-2 text-sm text-ink-soft">
            {Object.entries(CATEGORIES).map(([id, meta]) => (
              <li key={id}>
                <Link className="hover:text-accent" to={`/?cat=${id}#browse`}>
                  {meta.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-bold text-ink">On KAAMVORI</h2>
          <ul className="mt-3 space-y-2 text-sm text-ink-soft">
            <li>
              <Link className="hover:text-accent" to="/saved">
                Saved listings
              </Link>
            </li>
            <li>
              <Link className="hover:text-accent" to="/post">
                Post a job
              </Link>
            </li>
            <li>
              <Link className="hover:text-accent" to="/#browse">
                All open listings
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-bold text-ink">Good to know</h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            Demo listings are labelled as sample data. Feed listings show their original source
            and link to it — KAAMVORI never asks you to pay for a job.
          </p>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-5 text-xs text-mute sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 KAAMVORI · Sample data for demonstration</span>
          <span
            data-testid="backend-status"
            className={backend === 'ready' ? 'text-accent' : undefined}
          >
            {label}
          </span>
        </div>
      </div>
    </footer>
  )
}
