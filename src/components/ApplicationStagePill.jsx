import { STAGE_LABELS, STAGE_ORDER } from '../data/ladder.js'

/**
 * Application stage pill — Phase 7. Wording comes from the shared
 * APPLICATION_STAGES ladder; the tone mirrors it. Display-only here; moves are
 * enforced by the database lock (`ladder_applications_lock_status`).
 */
const TONES = {
  applied: 'bg-signal text-accent border-transparent',
  viewed: 'bg-signal text-accent border-transparent',
  shortlisted: 'bg-signal text-accent border-transparent',
  interview: 'bg-signal text-accent border-transparent',
  selected: 'bg-signal text-accent border-transparent',
  rejected: 'bg-[#fbf0ee] text-alert border-transparent',
  withdrawn: 'bg-paper text-mute border-line',
}

export default function ApplicationStagePill({ status }) {
  const stage = STAGE_ORDER[status] != null ? status : 'applied'
  const label = STAGE_LABELS[status] ?? STAGE_LABELS.applied
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
        TONES[stage] ?? TONES.applied
      }`}
      data-testid="application-status-pill"
      data-status={status}
    >
      {label}
    </span>
  )
}
