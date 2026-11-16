import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import DashboardShell from '../components/DashboardShell.jsx'
import SeekerNav from '../components/SeekerNav.jsx'
import { useAuth } from '../lib/auth.jsx'
import { useStore } from '../lib/store.jsx'
import { supabase } from '../lib/supabase.js'
import { EDUCATION_LADDER } from '../data/ladder.js'
import { relTime } from '../lib/format.js'

const MAX_RECS = 6

/** rung id → its position on the 10-level ladder (legacy 'none' → 'no_formal'). */
const EDU_ORDER = Object.fromEntries(EDUCATION_LADDER.map((e, i) => [e.id, i]))
const asRung = (id) => (id === 'none' ? 'no_formal' : id)

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Score the board against this seeker's real signals and explain every match.
 * A listing earns a reason chip per signal it actually satisfies:
 *   - one of the seeker's skill names appears in the listing, word-boundary
 *   - the listing's education rung sits at or below the seeker's highest rung
 *   - the listing is in the seeker's city
 * Listings with no satisfied signal are not recommendations — they are just
 * the board, so they are dropped. 'any' education is never a reason (it fits
 * everyone equally); unknown education is never a match (unknown ≠ any).
 */
function recommend(jobs, { skills, eduLevels, city }) {
  const maxEdu = eduLevels.length
    ? Math.max(...eduLevels.map((l) => EDU_ORDER[asRung(l)] ?? -1))
    : -1

  const scored = []
  for (const job of jobs) {
    const hay = [job.title, job.summary, job.org, ...(job.duties ?? []), ...(job.requirements ?? [])]
      .join(' ')
      .toLowerCase()
    const reasons = []

    for (const skill of skills) {
      if (new RegExp(`\\b${escapeRe(skill.toLowerCase())}\\b`).test(hay)) {
        reasons.push(`Matches your skill: ${skill}`)
        if (reasons.length >= 3) break
      }
    }

    const jobRung = job.education ? asRung(job.education) : null
    if (jobRung && jobRung !== 'any' && EDU_ORDER[jobRung] != null && maxEdu >= EDU_ORDER[jobRung]) {
      reasons.push('Within your education')
    }

    if (city && job.location?.toLowerCase().includes(city.toLowerCase())) {
      reasons.push(`In ${city}`)
    }

    if (reasons.length) scored.push({ job, reasons })
  }

  return scored
    .sort((a, b) => b.reasons.length - a.reasons.length || a.job.daysAgo - b.job.daysAgo)
    .slice(0, MAX_RECS)
}

export default function SeekerDashboard() {
  const { profile, user } = useAuth()
  const { favorites, jobs, board } = useStore()

  // Profile-side matching signals, read from the database once the backend is
  // known to be up. `null` = still loading, `false` = backend not available.
  const [signals, setSignals] = useState(null)

  useEffect(() => {
    if (board === 'checking' || !user?.id) return
    if (board !== 'live') {
      setSignals(false)
      return
    }
    let alive = true
    setSignals(null)
    Promise.all([
      supabase
        .from('ladder_candidate_skills')
        .select('skill_id, level, ladder_skills!inner(name)')
        .eq('profile_id', user.id),
      supabase.from('ladder_candidate_education').select('id, level').eq('profile_id', user.id),
    ]).then(([skillsRes, eduRes]) => {
      if (!alive) return
      if (skillsRes.error) console.info('recs: skills unavailable —', skillsRes.error.message)
      if (eduRes.error) console.info('recs: education unavailable —', eduRes.error.message)
      setSignals({
        skills: (skillsRes.data ?? [])
          .map((r) => r.ladder_skills?.name)
          .filter(Boolean)
          .slice(0, 20),
        eduLevels: (eduRes.data ?? []).map((r) => r.level).filter(Boolean),
      })
    })
    return () => {
      alive = false
    }
  }, [board, user?.id])

  const city = profile?.city || ''
  const recommendations = useMemo(() => {
    if (!signals) return null
    return recommend(jobs, { skills: signals.skills, eduLevels: signals.eduLevels, city })
  }, [signals, jobs, city])

  const savedCount = favorites.filter((id) => jobs.some((j) => j.id === id)).length
  const loc = [profile?.city, profile?.state].filter(Boolean).join(', ')

  return (
    <DashboardShell
      title="My dashboard"
      subtitle="Your job search, in one place."
    >
      <SeekerNav />

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Saved listings" value={savedCount} to="/saved" action="Open saved" />
        <Stat
          label="Profile"
          value={profile?.full_name ? 'Started' : 'Not started'}
          to="/me/profile"
          action="Edit profile"
        />
        <Stat
          label="Applications"
          value="—"
          action="Application tracking arrives in Phase 7"
          muted
        />
      </div>

      <div className="mt-6 rounded-xl border border-line bg-white p-6">
        <h2 className="text-sm font-bold text-ink">Account</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-mute">Name</dt>
            <dd className="font-semibold text-ink">{profile?.full_name || '—'}</dd>
          </div>
          <div>
            <dt className="text-mute">Email</dt>
            <dd className="font-semibold text-ink">{profile?.email || user?.email || '—'}</dd>
          </div>
          <div>
            <dt className="text-mute">Location</dt>
            <dd className="font-semibold text-ink">{loc || 'Not set'}</dd>
          </div>
          <div>
            <dt className="text-mute">Phone</dt>
            <dd className="font-semibold text-ink">
              {profile?.phone || 'Not set'}
              {profile?.phone && !profile?.privacy_show_phone && (
                <span className="ml-2 text-xs font-normal text-mute">(hidden from employers)</span>
              )}
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-xs leading-relaxed text-mute">
          Education, skills and experience live under <Link to="/me/profile" className="font-semibold text-accent underline underline-offset-2">My Profile</Link>;
          your resume file lives under <Link to="/me/resume" className="font-semibold text-accent underline underline-offset-2">My Resume</Link>.
        </p>
      </div>

      <section className="mt-6 rounded-xl border border-line bg-white p-6" data-testid="recs">
        <h2 className="text-sm font-bold text-ink">Recommended for you</h2>
        <p className="mt-1 text-xs leading-relaxed text-mute">
          Matched against your skills, education and city — every card says why it is here. Nothing
          is promoted or sponsored.
        </p>

        {signals === null && (
          <p className="mt-4 text-sm text-mute" data-testid="recs-loading">
            Loading matches against your profile…
          </p>
        )}

        {signals === false && (
          <div className="mt-4 rounded-lg border border-line bg-signal px-4 py-3 text-sm text-ink-soft" data-testid="recs-db-notice">
            The backend is not available, so matches cannot be computed right now. Nothing is
            invented in the meantime — the full board is still browsable under{' '}
            <Link to="/#browse" className="font-semibold text-accent underline underline-offset-2">
              Find work
            </Link>
            .
          </div>
        )}

        {Array.isArray(recommendations) &&
          (signals.skills.length === 0 && signals.eduLevels.length === 0 && !city ? (
            <div className="mt-4 rounded-lg border border-line bg-signal px-4 py-3 text-sm text-ink-soft" data-testid="recs-setup">
              Add your skills, education and city to your profile and matches appear here with the
              reason spelled out.{' '}
              <Link to="/me/profile" className="font-semibold text-accent underline underline-offset-2">
                Open My Profile
              </Link>
            </div>
          ) : recommendations.length === 0 ? (
            <p className="mt-4 text-sm text-ink-soft" data-testid="recs-empty">
              No listing matches your profile signals yet. Widen the search on the{' '}
              <Link to="/#browse" className="font-semibold text-accent underline underline-offset-2">
                job board
              </Link>{' '}
              — new vacancies are added daily.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {recommendations.map(({ job, reasons }) => (
                <li key={job.id} className="py-3 first:pt-0 last:pb-0" data-testid="rec-item">
                  <Link to={`/jobs/${job.id}`} className="block">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="display text-base text-ink sm:text-lg">{job.title}</h3>
                      <span className="text-[13px] text-mute">{relTime(job.daysAgo)}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-ink-soft">
                      {job.org} · {job.location}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {reasons.map((reason) => (
                        <span
                          key={reason}
                          className="rounded-full bg-signal px-2 py-0.5 text-[11px] font-semibold text-accent"
                          data-testid="rec-reason"
                        >
                          {reason}
                        </span>
                      ))}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ))}
      </section>

      <div className="mt-6">
        <Link
          to="/#browse"
          className="inline-block rounded-lg bg-accent px-5 py-2.5 font-semibold text-white hover:bg-accent-hover"
        >
          Find work
        </Link>
      </div>
    </DashboardShell>
  )
}

function Stat({ label, value, to, action, muted }) {
  const inner = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-mute">{label}</p>
      <p className="display mt-1 text-3xl text-ink">{value}</p>
      <p className={`mt-2 text-xs ${muted ? 'text-mute' : 'font-semibold text-accent'}`}>{action}</p>
    </>
  )
  const cls =
    'block rounded-xl border border-line bg-white p-5 transition-colors hover:border-mute'
  return to ? (
    <Link to={to} className={cls}>
      {inner}
    </Link>
  ) : (
    <div className={`${cls} cursor-default`}>{inner}</div>
  )
}
