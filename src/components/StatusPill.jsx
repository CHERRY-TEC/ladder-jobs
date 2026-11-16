import { EMPLOYER_STATUS, JOB_STATUS } from '../data/ladder.js'

/**
 * The one place employer verification state is rendered.
 *
 * `verified` — and only `verified` — gets the badge styling. That value can
 * only be produced by an admin approval (migration 0005 lock + sync trigger),
 * so this component can never show a badge the database didn't earn.
 */
const TONES = {
  verified: 'bg-signal text-accent border-transparent',
  pending: 'bg-[#fdf6e6] text-[#8a6d1a] border-transparent',
  rejected: 'bg-[#fbf0ee] text-alert border-transparent',
  muted: 'bg-paper text-mute border-line',
}

export default function StatusPill({ status }) {
  const meta = EMPLOYER_STATUS[status] ?? EMPLOYER_STATUS.unverified
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${TONES[meta.tone] ?? TONES.muted}`}
      data-testid="employer-status-pill"
      data-status={status}
    >
      {meta.tone === 'verified' && <span aria-hidden="true">✓</span>}
      {meta.label}
    </span>
  )
}

/** Long-form explanation shown under the pill — same source of truth. */
export function StatusExplain({ status }) {
  const meta = EMPLOYER_STATUS[status] ?? EMPLOYER_STATUS.unverified
  return (
    <p className="mt-2 text-sm leading-relaxed text-ink-soft" data-testid="employer-status-explain">
      {meta.explain}
    </p>
  )
}

/**
 * Vacancy status pill — wording from JOB_STATUS, states owned by the database
 * (`ladder_jobs_lock_status`) and by admin moderation. `active` — and only
 * `active` — means seekers can see the listing.
 */
export function JobStatusPill({ status }) {
  const meta = JOB_STATUS[status] ?? { label: status, tone: 'muted' }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
        TONES[meta.tone] ?? TONES.muted
      }`}
      data-testid="job-status-pill"
      data-status={status}
    >
      {meta.label}
    </span>
  )
}

/** Long-form job status explanation — same source of truth as the pill. */
export function JobStatusExplain({ status }) {
  const meta = JOB_STATUS[status] ?? { label: status, explain: '' }
  return (
    <p className="text-xs leading-relaxed text-mute" data-testid="job-status-explain">
      {meta.explain}
    </p>
  )
}
