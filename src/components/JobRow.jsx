import { Link } from 'react-router-dom'
import CategoryTag from './CategoryTag.jsx'
import SaveButton from './SaveButton.jsx'
import { eduLabel } from '../data/ladder.js'
import { isFresh, relTime } from '../lib/format.js'

export default function JobRow({ job }) {
  return (
    <article className="relative border-b border-line bg-white transition-colors last:border-b-0 hover:bg-[#fbf8f2]">
      <Link to={`/jobs/${job.id}`} className="block p-5 pr-14 sm:p-6 sm:pr-16">
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
            <span className="rounded-full border border-line px-1.5 py-0.5 text-[11px] font-semibold text-mute" title="External listing">
              External · {job.source}
            </span>
          )}
        </div>

        <h3 className="display mt-2 text-lg sm:text-xl">{job.title}</h3>
        <p className="mt-0.5 text-sm text-ink-soft">{job.org}</p>

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-mute">
          <span>{job.location}</span>
          <span aria-hidden="true">·</span>
          <span>{job.type}</span>
          <span aria-hidden="true">·</span>
          <span>{eduLabel(job.education) ?? 'Any education'}</span>
          <span className="sm:hidden" aria-hidden="true">·</span>
          <span className="sm:hidden">{relTime(job.daysAgo)}</span>
        </div>

        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
          <span className="display text-base text-ink sm:text-lg">{job.salary}</span>
          <span className="hidden text-[13px] text-mute sm:inline">{relTime(job.daysAgo)}</span>
        </div>
      </Link>

      <SaveButton jobId={job.id} className="absolute right-4 top-4" />
    </article>
  )
}
