import { Link } from 'react-router-dom'
import JobRow from '../components/JobRow.jsx'
import { useStore } from '../lib/store.jsx'

export default function Saved() {
  const { jobs, favorites } = useStore()
  const savedJobs = favorites.map((id) => jobs.find((j) => j.id === id)).filter(Boolean)

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="display-tight text-4xl sm:text-5xl">Saved listings</h1>
      <p className="mt-2 text-mute">
        {savedJobs.length === 0
          ? 'Jobs you bookmark are kept here on this device.'
          : `${savedJobs.length} ${savedJobs.length === 1 ? 'listing' : 'listings'} kept for later.`}
      </p>

      {savedJobs.length > 0 ? (
        <div className="mt-6 overflow-hidden rounded-xl border border-line bg-white">
          {savedJobs.map((job) => (
            <JobRow key={job.id} job={job} />
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-line bg-white p-8 text-center sm:p-12">
          <p className="display text-xl">Nothing saved yet.</p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-mute">
            Tap the bookmark on any listing and it will wait for you here.
          </p>
          <Link
            to="/#browse"
            className="mt-5 inline-block rounded-lg bg-accent px-5 py-2.5 font-semibold text-white hover:bg-accent-hover"
          >
            Browse jobs
          </Link>
        </div>
      )}
    </div>
  )
}
