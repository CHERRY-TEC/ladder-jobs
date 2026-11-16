import { Link } from 'react-router-dom'
import DashboardShell from '../components/DashboardShell.jsx'
import EmployerNav from '../components/EmployerNav.jsx'
import StatusPill, { StatusExplain } from '../components/StatusPill.jsx'
import { useEmployer } from '../lib/useEmployer.js'

/**
 * Employer overview. Counts and status come from `useEmployer` — there are no
 * numbers on this page that the database did not produce, and vacancy/applicant
 * panels stay absent until Phases 6–7 ship them.
 */
export default function EmployerDashboard() {
  const { backend, company, loading } = useEmployer()
  const dbReady = backend === 'ready'

  const hasCompany = Boolean(company)
  const status = company?.status ?? 'unverified'
  const needsCompany = dbReady && !loading && !hasCompany
  const needsDocs = dbReady && hasCompany && (status === 'unverified' || status === 'rejected')

  return (
    <DashboardShell
      title="Employer dashboard"
      subtitle="Your company, verification and vacancies."
    >
      <EmployerNav />

      {!dbReady && backend !== 'checking' && (
        <div className="mt-6 rounded-xl border border-line bg-signal px-4 py-3 text-sm text-ink-soft" data-testid="employer-db-notice">
          {backend === 'unconfigured'
            ? 'Supabase is not configured — company data is unavailable. Nothing is faked.'
            : backend === 'missing'
              ? 'Database not set up yet — run the migrations (see supabase/README.md).'
              : 'Backend connection error — this page is paused until it recovers.'}
        </div>
      )}

      {/* ------------------------------------------------------- next step -- */}
      {(needsCompany || needsDocs) && (
        <div className="mt-6 rounded-xl border border-line bg-signal p-6" data-testid="employer-next-step">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <h2 className="text-sm font-bold text-ink">
                {needsCompany ? 'Step 1 — create your company profile' : 'Step 2 — submit a registration document'}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                {needsCompany
                  ? 'A company name and city is enough to start. Vacancies attach to this profile, so seekers know who is hiring.'
                  : 'A GST certificate, CIN or Udyam registration proves the business is real. An admin reviews it — only approval earns the Verified badge.'}
              </p>
            </div>
            <Link
              to={needsCompany ? '/employer/company' : '/employer/verification'}
              className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover"
              data-testid="employer-cta"
            >
              {needsCompany ? 'Create company profile' : 'Submit document'}
            </Link>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------- status -- */}
      <section className="mt-6 rounded-xl border border-line bg-white p-6" data-testid="employer-status-section">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wide text-mute">Company</p>
            <p className="mt-1 text-lg font-bold text-ink" data-testid="employer-company-name">
              {loading ? 'Loading…' : hasCompany ? company.company_name : 'No company profile yet'}
            </p>
            {hasCompany && (
              <p className="mt-1 text-sm text-mute">
                {[company.city, company.state].filter(Boolean).join(', ') || 'Location not set'}
                {company.industry && <> · {company.industry}</>}
              </p>
            )}
            <StatusExplain status={status} />
          </div>
          <StatusPill status={status} />
        </div>
      </section>

      {/* ----------------------------------------------------------- cells -- */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Cell
          label="Company profile"
          body={hasCompany ? 'Your details are saved. Edit them any time — seekers see them on every vacancy.' : 'Add your company details so seekers know who is hiring.'}
          to="/employer/company"
          cta={hasCompany ? 'Edit profile' : 'Set up profile'}
          testid="cell-company"
        />
        <Cell
          label="Verification"
          body={
            status === 'verified'
              ? 'Approved. Your documents are on file and the badge is live on your vacancies.'
              : status === 'pending'
                ? 'Documents submitted and waiting for an admin decision.'
                : status === 'rejected'
                  ? 'The last document was rejected — read the reason and submit a corrected one.'
                  : 'Upload GST / CIN / Udyam documents; admins review them. Only real approvals earn the badge.'
          }
          to="/employer/verification"
          cta={status === 'verified' ? 'View submissions' : 'Go to verification'}
          testid="cell-verification"
        />
        <Cell
          label="Vacancies"
          body="Post and manage jobs — each one starts as pending for admin moderation."
          phase="Phase 6"
          testid="cell-vacancies"
        />
      </div>

      <div className="mt-6 rounded-xl border border-line bg-white p-6">
        <h2 className="text-sm font-bold text-ink">How trust works here</h2>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-soft">
          <li>· The <strong>Verified</strong> badge appears only after an admin approves your documents — nobody can set it themselves, including from this page.</li>
          <li>· New jobs go live only after moderation, so serious employers stand out from spam.</li>
          <li>· Applicants move through visible stages: Applied → Viewed → Shortlisted → Interview → Selected / Rejected.</li>
          <li>· Ladder never charges a seeker to apply, and never charges you to be verified.</li>
        </ul>
      </div>
    </DashboardShell>
  )
}

function Cell({ label, body, to, cta, phase, testid }) {
  return (
    <div className="rounded-xl border border-line bg-white p-5" data-testid={testid}>
      <p className="text-xs font-semibold uppercase tracking-wide text-mute">{label}</p>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">{body}</p>
      {to ? (
        <Link
          to={to}
          className="mt-3 inline-block rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft hover:border-mute"
        >
          {cta}
        </Link>
      ) : (
        <p className="mt-3 text-xs font-semibold text-accent">{phase}</p>
      )}
    </div>
  )
}
