import { useStore } from '../lib/store.jsx'

export default function SaveButton({ jobId, className = '' }) {
  const { favorites, toggleFavorite } = useStore()
  const saved = favorites.includes(jobId)

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggleFavorite(jobId)
      }}
      aria-pressed={saved}
      aria-label={saved ? 'Remove from saved listings' : 'Save this listing'}
      title={saved ? 'Remove from saved' : 'Save listing'}
      className={`grid h-9 w-9 place-items-center rounded-lg border transition-colors ${
        saved ? 'border-accent bg-signal' : 'border-line bg-white hover:border-accent'
      } ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path
          d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1z"
          fill={saved ? '#4f7a61' : 'none'}
          stroke={saved ? '#4f7a61' : '#87878f'}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}
