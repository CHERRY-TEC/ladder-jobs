import { CATEGORIES } from '../data/seed.js'

export default function CategoryTag({ category }) {
  const meta = CATEGORIES[category]
  if (!meta) return null
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-[#f6f1e6] px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-ink-soft">
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: meta.dot }}
      />
      {meta.label}
    </span>
  )
}
