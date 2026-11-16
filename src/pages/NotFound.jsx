import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-24 text-center">
      <h1 className="display-tight text-5xl">That page could not be found.</h1>
      <p className="mt-3 text-mute">The address does not exist on this site.</p>
      <Link
        to="/"
        className="mt-6 inline-block rounded-lg bg-accent px-5 py-3 font-semibold text-white hover:bg-accent-hover"
      >
        Back to all jobs
      </Link>
    </div>
  )
}
