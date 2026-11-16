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

function Check({ checked, label, count, onChange }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft hover:text-ink">
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

function Select({ label, value, onChange, options }) {
  return (
    <label className="block text-sm font-semibold text-ink-soft">
      <span className="mb-1 block text-xs uppercase tracking-[0.08em] text-mute">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink hover:border-mute"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  )
}

function FilterBlock({ title, children, hint }) {
  return (
    <section className="min-w-0 rounded-xl border border-line bg-[#fdfbf7] p-4">
      <h3 className="text-sm font-bold text-ink">{title}</h3>
      {hint && <p className="mt-1 text-xs text-mute">{hint}</p>}
      <div className="mt-3 space-y-2">{children}</div>
    </section>
  )
}

export default function FilterPanel({ jobs, params, onToggle, onClear, onSort, sort, view = 'grid', group = 'none', onView, onGroup, variant = 'top' }) {
  const countBy = (fn) => jobs.filter(fn).length
  const activeCats = params.get('cat')?.split(',').filter(Boolean) ?? []
  const activeType = params.get('type') ?? ''
  const activeEdu = params.get('edu') ?? ''
  const activeExp = params.get('exp') ?? ''
  const activePay = params.get('pay') ?? ''
  const activeMode = params.get('mode') ?? ''
  const activeWhen = params.get('when') ?? ''

  const activeFilters = [
    activeEdu && `Education: ${EDUCATION_LADDER.find((e) => e.id === activeEdu)?.label || activeEdu}`,
    activeExp && `Experience: ${EXPERIENCE_LEVELS.find((e) => e.id === activeExp)?.label || activeExp}`,
    activePay && `Pay: ${PAY_THRESHOLDS.find((e) => e.id === activePay)?.label || activePay}`,
    activeMode && `Mode: ${WORK_MODES.find((e) => e.id === activeMode)?.label || activeMode}`,
    activeWhen && `Posted: ${POSTED_WITHIN.find((e) => e.id === activeWhen)?.label || activeWhen}`,
    activeType && `Type: ${activeType}`,
    ...activeCats.map((c) => `Category: ${CATEGORIES[c]?.label || c}`),
    params.get('q') ? `Search: ${params.get('q')}` : '',
    params.get('loc') ? `Location: ${params.get('loc')}` : '',
  ].filter(Boolean)

  const hasFilters = activeFilters.length > 0

  return (
    <div className="rounded-2xl border border-line bg-white shadow-sm">
      <div className="border-b border-line bg-[#fdfbf7] p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="display text-lg">Arrange listings</h2>
            <p className="mt-0.5 text-xs text-mute">Choose how jobs are displayed, then open filters if needed.</p>
          </div>
          {hasFilters && (
            <button
              type="button"
              onClick={onClear}
              className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold text-accent hover:border-accent/40"
            >
              Clear all filters
            </button>
          )}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Select
            label="View"
            value={view}
            onChange={(v) => onView?.(v)}
            options={[
              { value: 'grid', label: 'Grid cards' },
              { value: 'list', label: 'List rows' },
            ]}
          />
          <Select
            label="Group by"
            value={group}
            onChange={(v) => onGroup?.(v)}
            options={[
              { value: 'none', label: 'No grouping' },
              { value: 'category', label: 'Category' },
              { value: 'location', label: 'Location' },
            ]}
          />
          <Select
            label="Sort by"
            value={sort}
            onChange={(v) => onSort(v)}
            options={[
              { value: 'newest', label: 'Newest first' },
              { value: 'oldest', label: 'Oldest first' },
              { value: 'pay', label: 'Pay: high to low' },
              { value: 'pay_low', label: 'Pay: low to high' },
              { value: 'title', label: 'Title A–Z' },
              { value: 'title_desc', label: 'Title Z–A' },
            ]}
          />
        </div>

        {hasFilters && (
          <div className="mt-4 flex flex-wrap gap-2">
            {activeFilters.map((f) => (
              <span key={f} className="rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-ink-soft">
                {f}
              </span>
            ))}
          </div>
        )}
      </div>

      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-ink sm:px-5">
          <span>Filters {hasFilters ? `(${activeFilters.length} active)` : ''}</span>
          <span className="text-xs font-normal text-mute group-open:hidden">Show filters</span>
          <span className="hidden text-xs font-normal text-mute group-open:inline">Hide filters</span>
        </summary>

        <div className="border-t border-line p-4 sm:p-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <FilterBlock title="Education">
              {EDUCATION_LADDER.map((e) => (
                <Check
                  key={e.id}
                  label={e.label}
                  count={countBy((j) => matchesEducation(j, e.id))}
                  checked={activeEdu === e.id}
                  onChange={() => onToggle('edu', activeEdu === e.id ? '' : e.id)}
                />
              ))}
            </FilterBlock>

            <FilterBlock title="Experience">
              {EXPERIENCE_LEVELS.map((x) => (
                <Check
                  key={x.id}
                  label={x.label}
                  count={countBy((j) => matchesExperience(j, x.id))}
                  checked={activeExp === x.id}
                  onChange={() => onToggle('exp', activeExp === x.id ? '' : x.id)}
                />
              ))}
            </FilterBlock>

            <FilterBlock title="Pay" hint="Monthly equivalent">
              {PAY_THRESHOLDS.map((p) => (
                <Check
                  key={p.id}
                  label={p.label}
                  count={countBy((j) => matchesPay(j, p.min))}
                  checked={activePay === p.id}
                  onChange={() => onToggle('pay', activePay === p.id ? '' : p.id)}
                />
              ))}
            </FilterBlock>

            <FilterBlock title="Work mode">
              {WORK_MODES.map((m) => (
                <Check
                  key={m.id}
                  label={m.label}
                  count={countBy((j) => matchesMode(j, m.id))}
                  checked={activeMode === m.id}
                  onChange={() => onToggle('mode', activeMode === m.id ? '' : m.id)}
                />
              ))}
            </FilterBlock>

            <FilterBlock title="Posted">
              {POSTED_WITHIN.map((d) => (
                <Check
                  key={d.id}
                  label={d.label}
                  count={countBy((j) => matchesWhen(j, d.id))}
                  checked={activeWhen === d.id}
                  onChange={() => onToggle('when', activeWhen === d.id ? '' : d.id)}
                />
              ))}
            </FilterBlock>

            <FilterBlock title="Category">
              {Object.entries(CATEGORIES).map(([id, meta]) => (
                <Check
                  key={id}
                  label={meta.label}
                  count={countBy((j) => j.category === id)}
                  checked={activeCats.includes(id)}
                  onChange={() => onToggle('cat', id)}
                />
              ))}
            </FilterBlock>

            <FilterBlock title="Job type">
              {TYPES.map((t) => (
                <Check
                  key={t}
                  label={t}
                  count={countBy((j) => j.type === t)}
                  checked={activeType === t}
                  onChange={() => onToggle('type', activeType === t ? '' : t)}
                />
              ))}
            </FilterBlock>
          </div>
        </div>
      </details>
    </div>
  )
}