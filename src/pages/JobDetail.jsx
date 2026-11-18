import { useEffect, useState } from 'react'
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

  useEffect(() => {
    if (!job) return
    const isExternal = job.origin === 'feed' || Boolean(job.source)
    const sourceUrl = job.sourceUrl || (job.contact?.kind === 'link' ? job.contact.value : null)
    const title = `${job.title} at ${job.org} — ${job.location} | KAAMVORI`
    document.title = title
    const descBase = isExternal
      ? `${job.title} at ${job.org} in ${job.location}. External listing${job.source ? ` from ${job.source}` : ''}. View and apply on the original site.`
      : `${job.title} at ${job.org} in ${job.location}. ${job.type || 'Job'} vacancy${job.education ? `, education: ${eduLabel(job.education) || job.education}` : ''}. Apply on KAAMVORI.`
    let meta = document.querySelector('meta[name="description"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.setAttribute('name', 'description')
      document.head.appendChild(meta)
    }
    meta.setAttribute('content', descBase.slice(0, 160))

    const summaryText = (job.summary || '').replace(/\s+/g, ' ').trim()
    const ldDesc = isExternal ? summaryText.slice(0, 200) : [summaryText, ...(job.duties || []), ...(job.requirements || [])].filter(Boolean).join(' ')
    const ld = {
      '@context': 'https://schema.org',
      '@type': 'JobPosting',
      title: job.title,
      description: ldDesc,
      datePosted: job.postedAt || undefined,
      employmentType: job.type || undefined,
      hiringOrganization: { '@type': 'Organization', name: job.org || 'Employer' },
      jobLocation: { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: job.location || 'India', addressCountry: 'IN' } },
      applicantLocationRequirements: job.workMode === 'remote' ? { '@type': 'Country', name: 'India' } : undefined,
      ...(isExternal && sourceUrl ? { url: sourceUrl, directApply: false } : { directApply: true }),
    }
    const id = 'jobposting-jsonld'
    let script = document.getElementById(id)
    if (!script) {
      script = document.createElement('script')
      script.id = id
      script.type = 'application/ld+json'
      document.head.appendChild(script)
    }
    script.textContent = JSON.stringify(ld)
    return () => {
      const s = document.getElementById(id)
      if (s) s.remove()
    }
  }, [job])

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
  const isExternal = job.origin === 'feed' || Boolean(job.source)
  const externalUrl = job.sourceUrl || (job.contact?.kind === 'link' ? job.contact.value : null)
  const href = contactHref(job.contact) || externalUrl
  const similar = jobs.filter((j) => j.category === job.category && j.id !== job.id).slice(0, 3)
  const displaySummary = isExternal
    ? `${(job.summary || '').replace(/\s+/g, ' ').trim().slice(0, 280)}${(job.summary || '').length > 280 ? '…' : ''}`
    : job.summary

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
            {isExternal && (
              <span className="rounded-full border border-line px-1.5 py-0.5 text-[11px] font-semibold text-mute">
                External listing{job.source ? ` · ${job.source}` : ''}
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
          {isExternal && (
            <div className="mt-4 rounded-lg border border-line bg-[#fdfbf7] p-4 text-sm text-ink-soft">
              <p className="font-semibold text-ink">External listing from {job.source || 'another site'}</p>
              <p className="mt-1">
                This job is shown with source attribution. For full, up-to-date details and to apply, use the original listing.
              </p>
              {externalUrl && (
                <a
                  href={externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block font-semibold text-accent underline underline-offset-2 hover:text-accent-hover"
                >
                  View original listing on {job.source || 'source'}
                </a>
              )}
            </div>
          )}

          <p className="mt-6 text-base leading-relaxed text-ink-soft">{displaySummary}</p>

          <Points title="What you'll do" items={job.duties} />
          <Points title="Who can apply" items={job.requirements} />

          <section className="mt-8 border-t border-line pt-6">
            <h2 className="display text-xl">How to apply</h2>
            <p className="mt-2 text-[15px] text-ink-soft">
              {isExternal
                ? `This is an external listing${job.source ? ` from ${job.source}` : ''}. Apply on the original site for the latest details and application process.`
                : job.contact?.kind === 'phone'
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
                target={isExternal || job.contact?.kind === 'link' ? '_blank' : undefined}
                rel={isExternal || job.contact?.kind === 'link' ? 'noopener noreferrer' : undefined}
                className="mt-4 inline-block rounded-lg bg-accent px-5 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-accent-hover"
              >
                {isExternal ? `View & apply on ${job.source || 'original site'}` : job.contact?.label || 'Apply'}
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
            {!isExternal && user && role === 'seeker' && !job.mine && (
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
                target={isExternal || job.contact?.kind === 'link' ? '_blank' : undefined}
                rel={isExternal || job.contact?.kind === 'link' ? 'noopener noreferrer' : undefined}
                className="block w-full rounded-lg bg-accent px-4 py-3 text-center font-semibold text-white transition-colors hover:bg-accent-hover"
              >
                {isExternal ? `View & apply on ${job.source || 'original site'}` : job.contact?.label || 'Apply'}
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
