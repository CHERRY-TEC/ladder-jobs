import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import CategoryTag from '../components/CategoryTag.jsx'
import JobRow from '../components/JobRow.jsx'
import ApplyModal from '../components/ApplyModal.jsx'
import { CATEGORIES } from '../data/seed.js'
import { EXP_LABELS, WORK_MODES, eduLabel } from '../data/ladder.js'
import { contactHref, isFresh, relTime } from '../lib/format.js'
import { useAuth } from '../lib/auth.jsx'
import { useStore } from '../lib/store.jsx'

function Points({ title, items }) {
  if (!items?.length) return null
  return (
    <section className="mt-8">
      <h2 className="display text-xl">{title}</h2>
      <ul className="mt-3 space-y-2.5">
        {items.map((item) => (
          <li key={item} className="flex gap-3 text-[15px] leading-relaxed text-ink-soft">
            <span
              aria-hidden="true"
              className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
            />
            {item}
          </li>
        ))}
      </ul>
    </section>
  )
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-4 py-3 text-sm">
      <dt className="text-mute">{label}</dt>
      <dd className="text-right font-semibold text-ink">{value}</dd>
    </div>
  )
}

export default function JobDetail() {
  const { id } = useParams()
  const { jobs, favorites, toggleFavorite } = useStore()
  const { user, role } = useAuth()
  const [applying, setApplying] = useState(false)
  const job = jobs.find((j) => j.id === id)

  if (!job) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-20 text-center">
        <h1 className="display-tight text-4xl">That listing is gone.</h1>
        <p className="mt-3 text-mute">It may have been removed, or the link is wrong.</p>
        <Link
          to="/"
          className="mt-6 inline-block rounded-lg bg-accent px-5 py-3 font-semibold text-white hover:bg-accent-hover"
        >
          Back to all jobs
        </Link>
      </div>
    )
  }

  const saved = favorites.includes(job.id)
  const href = contactHref(job.contact)
  const similar = jobs.filter((j) => j.category === job.category && j.id !== job.id).slice(0, 3)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link to="/#browse" className="text-sm font-semibold text-mute hover:text-ink">
        ← Back to all jobs
      </Link>

      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_320px]">
        <article className="rounded-xl border border-line bg-white p-6 shadow-sm sm:p-8">
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
          </div>

          <h1 className="display-tight mt-3 text-3xl sm:text-4xl">{job.title}</h1>
          <p className="mt-2 text-lg text-ink-soft">{job.org}</p>
          <p className="mt-1 text-sm text-mute">
            {job.location} · {job.type} · {eduLabel(job.education) ?? 'Any education'} · {relTime(job.daysAgo)}
          </p>
          {job.source && (
            <p className="mt-1 text-sm text-mute">
              Listing source:{' '}
              <a
                href={job.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-accent underline underline-offset-2 hover:text-accent-hover"
              >
                {job.source}
              </a>{' '}
              · original external listing
            </p>
          )}

          <p className="mt-6 text-base leading-relaxed text-ink-soft">{job.summary}</p>

          <Points title="What you'll do" items={job.duties} />
          <Points title="Who can apply" items={job.requirements} />

          <section className="mt-8 border-t border-line pt-6">
            <h2 className="display text-xl">How to apply</h2>
            <p className="mt-2 text-[15px] text-ink-soft">
              {job.contact?.kind === 'phone'
                ? 'Call the number below during working hours.'
                : job.contact?.kind === 'email'
                  ? 'Send your details by email.'
                  : job.contact?.kind === 'link'
                    ? 'Apply through the link below.'
                    : 'Reach out using the contact below.'}
            </p>
            {href ? (
              <a
                href={href}
                className="mt-4 inline-block rounded-lg bg-accent px-5 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-accent-hover"
              >
                {job.contact.label}
              </a>
            ) : job.contact?.value ? (
              <p className="mt-4 font-semibold">{job.contact.value}</p>
            ) : (
              <p className="mt-4 text-sm text-mute">
                The poster left no contact details on KAAMVORI — nothing to call or click here.
              </p>
            )}
            <p className="mt-4 max-w-md text-sm text-mute">
              KAAMVORI never asks for money. If a recruiter asks you to pay, walk away.
            </p>
          </section>
        </article>

        <aside className="h-fit overflow-hidden rounded-xl border border-line bg-white shadow-sm lg:sticky lg:top-24">
          <div className="border-b border-line bg-signal/70 px-5 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-soft">Pay</p>
            <p className="display-tight mt-1 text-2xl">{job.salary}</p>
          </div>

          <dl className="divide-y divide-line">
            <DetailRow label="Location" value={job.location} />
            <DetailRow label="Job type" value={job.type} />
            <DetailRow label="Education" value={eduLabel(job.education) ?? 'Any education'} />
            {job.experience && EXP_LABELS[job.experience] && (
              <DetailRow label="Experience" value={EXP_LABELS[job.experience]} />
            )}
            {job.workMode && (
              <DetailRow
                label="Work mode"
                value={WORK_MODES.find((m) => m.id === job.workMode)?.label ?? job.workMode}
              />
            )}
            <DetailRow label="Category" value={CATEGORIES[job.category]?.label ?? '—'} />
            <DetailRow label="Posted" value={relTime(job.daysAgo).replace('Posted ', '')} />
          </dl>

          <div className="space-y-2 border-t border-line p-4">
            {user && role === 'seeker' && !job.mine && (
              <button
                type="button"
                onClick={() => setApplying(true)}
                className="w-full rounded-lg bg-accent px-4 py-3 font-semibold text-white transition-colors hover:bg-accent-hover"
                data-testid="apply-open"
              >
                Apply now
              </button>
            )}
            <button
              type="button"
              onClick={() => toggleFavorite(job.id)}
              aria-pressed={saved}
              className={`w-full rounded-lg border px-4 py-3 font-semibold transition-colors ${
                saved
                  ? 'border-accent bg-signal text-ink'
                  : 'border-line bg-white text-ink hover:border-accent hover:bg-signal'
              }`}
            >
              {saved ? 'Saved — remove' : 'Save listing'}
            </button>
            {href && (
              <a
                href={href}
                className="block w-full rounded-lg bg-accent px-4 py-3 text-center font-semibold text-white transition-colors hover:bg-accent-hover"
              >
                {job.contact.label}
              </a>
            )}
          </div>
        </aside>
      </div>

      {applying && <ApplyModal job={job} onClose={() => setApplying(false)} />}

      {similar.length > 0 && (
        <section className="mt-12">
          <h2 className="display-tight text-2xl">
            More {CATEGORIES[job.category]?.label.toLowerCase()}
          </h2>
          <div className="mt-4 overflow-hidden rounded-xl border border-line bg-white">
            {similar.map((item) => (
              <JobRow key={item.id} job={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
