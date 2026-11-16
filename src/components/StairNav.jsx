import { EDU_PRESETS, eduLabel } from '../data/ladder.js'

// The signature element: four rising steps, one per education level.
// Clicking a step filters the board to that rung and jumps to the listings.
// Each step expands onto the full 10-level ladder (see EDU_PRESETS.rungs).
export default function StairNav({ counts, active, onPick }) {
  return (
    <div>
      <p className="mb-3 text-[13px] font-semibold text-mute">Pick your rung</p>
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
              className={`flex flex-1 flex-col justify-end rounded-xl border p-3 text-left transition-transform hover:-translate-y-1 ${
                isActive
                  ? 'border-accent bg-accent text-white'
                  : 'border-line bg-white text-ink hover:border-accent hover:bg-signal'
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
