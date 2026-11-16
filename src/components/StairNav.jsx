import { EDU_PRESETS, eduLabel } from '../data/ladder.js'

// The signature element: four rising steps, one per education level.
// Clicking a step filters the board to that rung and jumps to the listings.
// Each step expands onto the full 10-level ladder (see EDU_PRESETS.rungs).
export default function StairNav({ counts, active, onPick }) {
  return (
    <div className="rounded-2xl border border-line bg-white/80 p-4 shadow-sm backdrop-blur-sm sm:p-5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-mute">Choose your education level</p>
      <div className="flex items-end gap-2" role="group" aria-label="Filter by education level">
        {EDU_PRESETS.map((level, i) => {
          const isActive = active === level.id
          return (
            <button
              key={level.id}
              type="button"
              onClick={() => onPick(level.id)}
              aria-pressed={isActive}
              style={{ height: `${112 + i * 34}px` }}
              className={`flex flex-1 flex-col justify-end rounded-xl border p-3 text-left transition-all hover:-translate-y-1 ${
                isActive
                  ? 'border-accent bg-accent text-white shadow-sm'
                  : 'border-line bg-[#fdfbf7] text-ink hover:border-accent/60 hover:bg-signal'
              }`}
            >
              <span className="display-tight text-2xl leading-none">{counts[level.id] ?? 0}</span>
              <span
                className={`mt-1 text-[11px] font-semibold leading-tight ${
                  isActive ? 'text-white/80' : 'text-mute'
                }`}
              >
                {level.stair}
              </span>
            </button>
          )
        })}
      </div>
      <p className="mt-3 text-sm text-mute">
        {active
          ? `Showing jobs that match: ${
              EDU_PRESETS.find((e) => e.id === active)?.label ?? eduLabel(active) ?? active
            }. Click again to clear.`
          : 'Every listing says up front what education it needs.'}
      </p>
    </div>
  )
}
