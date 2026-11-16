import { Link } from 'react-router-dom'
import CategoryTag from './CategoryTag.jsx'
import SaveButton from './SaveButton.jsx'
import { eduLabel } from '../data/ladder.js'
import { isFresh, relTime } from '../lib/format.js'

export default function JobCard({ job }) {
  return (
    <article className="group relative flex h-full flex-col rounded-2xl border border-line bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <Link to={`/jobs/${job.id}`} className="flex h-full flex-col pr-8">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryTag category={job.category} />
          {job.mine && (
            <span className="rounded-full border border-line px-1.5 py-0.5 text-[11px] font-semibold text-ink-soft">
              Posted by you
            </span>
          )}
          {isFresh(job.daysAgo) && (
            <span className="rounded-full bg-signal px-1.5 py-0.5 text-[11px] font-semibold text-accent">
              New
            </span>
          )}
          {job.source && (
            <span className="rounded-full border border-line px-1.5 py-0.5 text-[11px] font-semibold text-mute">
              via {job.source}
            </span>
          )}
        </div>

        <h3 className="display mt-3 text-xl leading-tight text-ink group-hover:text-accent">{job.title}</h3>
        <p className="mt-1 text-sm font-semibold text-ink-soft">{job.org}</p>

        <dl className="mt-4 space-y-1.5 text-sm text-mute">
          <div className="flex items-start justify-between gap-3">
            <dt className="sr-only">Location</dt>
            <dd>{job.location}</dd>
          </div>
          <div className="flex flex-wrap gap-x-2 gap-y-1 text-[13px]">
            <span>{job.type}</span>
            <span aria-hidden="true">·</span>
            <span>{eduLabel(job.education) ?? 'Any education'}</span>
          </div>
        </dl>

        <div className="mt-5 flex items-end justify-between gap-3 border-t border-line pt-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-mute">Pay</p>
            <p className="display mt-1 text-lg text-ink">{job.salary}</p>
          </div>
          <p className="text-xs text-mute">{relTime(job.daysAgo)}</p>
        </div>
      </Link>

      <SaveButton jobId={job.id} className="absolute right-4 top-4" />
    </article>
  )
}