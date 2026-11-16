import { CATEGORIES, TYPES } from '../data/seed.js'
import {
  EDUCATION_LADDER,
  EXPERIENCE_LEVELS,
  PAY_THRESHOLDS,
  POSTED_WITHIN,
  WORK_MODES,
} from '../data/ladder.js'
import {
  matchesEducation,
  matchesExperience,
  matchesMode,
  matchesPay,
  matchesWhen,
} from '../lib/format.js'

function FilterGroup({ title, children, hint }) {
  return (
    <fieldset className="border-t border-line px-4 py-4 first:border-t-0">
      <legend className="sr-only">{title}</legend>
      <h3 className="mb-3 text-[13px] font-semibold text-mute">{title}</h3>
      {hint && <p className="-mt-2 mb-3 text-xs text-mute">{hint}</p>}
      <div className="space-y-2">{children}</div>
    </fieldset>
  )
}

function Check({ checked, label, count, onChange }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-soft hover:text-ink">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 shrink-0 accent-accent"
      />
      <span className="flex-1">{label}</span>
      {count !== undefined && <span className="text-xs text-mute">{count}</span>}
    </label>
  )
}

/**
 * Facets for the board. Every option shows how many listings it would return
 * (computed with the exact matcher the board uses — no optimistic numbers),
 * and each group is single-select: click again to clear.
 *
 * Education is the full 10-level ladder; the four hero stair presets expand
 * through EDU_PRESETS, so both controls drive the same `edu` param.
 */
export default function FilterPanel({ jobs, params, onToggle, onClear, onSort, sort }) {
  const countBy = (fn) => jobs.filter(fn).length
  const activeCats = params.get('cat')?.split(',').filter(Boolean) ?? []
  const activeType = params.get('type') ?? ''
  const activeEdu = params.get('edu') ?? ''
  const activeExp = params.get('exp') ?? ''
  const activePay = params.get('pay') ?? ''
  const activeMode = params.get('mode') ?? ''
  const activeWhen = params.get('when') ?? ''
  const hasFilters =
    activeCats.length > 0 ||
    activeType ||
    activeEdu ||
    activeExp ||
    activePay ||
    activeMode ||
    activeWhen ||
    params.get('q') ||
    params.get('loc')

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-line bg-[#fdfbf7] px-4 py-3.5">
        <h2 className="display text-lg">Filters</h2>
        {hasFilters && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs font-semibold text-accent underline underline-offset-2 hover:text-accent-hover"
          >
            Clear all
          </button>
        )}
      </div>

      <FilterGroup title="Sort by">
        <select
          value={sort}
          onChange={(e) => onSort(e.target.value)}
          className="w-full rounded-lg border border-line bg-white px-2.5 py-2 text-sm text-ink hover:border-mute"
          aria-label="Sort listings"
        >
          <option value="newest">Newest first</option>
          <option value="pay">Pay: high to low</option>
          <option value="title">Title A–Z</option>
        </select>
      </FilterGroup>

      <FilterGroup title="Education needed" hint="The full 10-rung ladder — every listing states its rung.">
        {EDUCATION_LADDER.map((e) => (
          <Check
            key={e.id}
            label={e.label}
            count={countBy((j) => matchesEducation(j, e.id))}
            checked={activeEdu === e.id}
            onChange={() => onToggle('edu', activeEdu === e.id ? '' : e.id)}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="Experience" hint="Listings that don't state a requirement are not counted here.">
        {EXPERIENCE_LEVELS.map((x) => (
          <Check
            key={x.id}
            label={x.label}
            count={countBy((j) => matchesExperience(j, x.id))}
            checked={activeExp === x.id}
            onChange={() => onToggle('exp', activeExp === x.id ? '' : x.id)}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="Pay" hint="Monthly equivalent — daily wages are converted at 26 days.">
        {PAY_THRESHOLDS.map((p) => (
          <Check
            key={p.id}
            label={p.label}
            count={countBy((j) => matchesPay(j, p.min))}
            checked={activePay === p.id}
            onChange={() => onToggle('pay', activePay === p.id ? '' : p.id)}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="Work mode">
        {WORK_MODES.map((m) => (
          <Check
            key={m.id}
            label={m.label}
            count={countBy((j) => matchesMode(j, m.id))}
            checked={activeMode === m.id}
            onChange={() => onToggle('mode', activeMode === m.id ? '' : m.id)}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="Posted">
        {POSTED_WITHIN.map((d) => (
          <Check
            key={d.id}
            label={d.label}
            count={countBy((j) => matchesWhen(j, d.id))}
            checked={activeWhen === d.id}
            onChange={() => onToggle('when', activeWhen === d.id ? '' : d.id)}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="Category">
        {Object.entries(CATEGORIES).map(([id, meta]) => (
          <Check
            key={id}
            label={meta.label}
            count={countBy((j) => j.category === id)}
            checked={activeCats.includes(id)}
            onChange={() => onToggle('cat', id)}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="Job type">
        {TYPES.map((t) => (
          <Check
            key={t}
            label={t}
            count={countBy((j) => j.type === t)}
            checked={activeType === t}
            onChange={() => onToggle('type', activeType === t ? '' : t)}
          />
        ))}
      </FilterGroup>
    </div>
  )
}
