export function relTime(daysAgo) {
  if (daysAgo <= 0) return 'Posted today'
  if (daysAgo === 1) return 'Posted yesterday'
  if (daysAgo < 7) return `Posted ${daysAgo} days ago`
  if (daysAgo < 14) return 'Posted 1 week ago'
  return `Posted ${Math.floor(daysAgo / 7)} weeks ago`
}

export function isFresh(daysAgo) {
  return daysAgo <= 2
}

export function matchesQuery(job, query) {
  if (!query) return true
  const haystack = [job.title, job.org, job.location, job.summary, ...(job.duties ?? [])]
    .join(' ')
    .toLowerCase()
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word))
}

export function matchesLocation(job, location) {
  if (!location) return true
  return job.location.toLowerCase().includes(location.trim().toLowerCase())
}

import { EDU_PRESETS } from '../data/ladder.js'

/** preset id → the 10-rung (plus legacy) education values it covers. */
const PRESET_RUNGS = Object.fromEntries(EDU_PRESETS.map((p) => [p.id, p.rungs]))

/**
 * Education filter. `education` is either one of the four stair presets
 * (`none`/`diploma`/`graduate`/`any` → expanded via EDU_PRESETS) or a single
 * rung of the 10-level ladder. In every case a job that accepts ANY education
 * matches — it imposes no rung at all.
 */
export function matchesEducation(job, education) {
  if (!education) return true
  // The offline demo data writes 'none'; the database vocabulary is 'no_formal'.
  const rung = job.education === 'none' ? 'no_formal' : job.education
  if (rung === 'any') return true
  const rungs = PRESET_RUNGS[education]
  return rungs ? rungs.includes(rung) : rung === education
}

/** Experience filter — exact rung. Listings that don't state an experience
 *  requirement (imported feed rows) never match: unknown is not "any". */
export function matchesExperience(job, experience) {
  if (!experience) return true
  return job.experience === experience
}

/** Salary filter — monthly-equivalent minimum (see PAY_THRESHOLDS). Jobs with
 *  no disclosed pay never match: unknown is not "any amount". */
export function matchesPay(job, min) {
  if (!min) return true
  return (job.salaryMin ?? 0) >= Number(min)
}

/** Work-mode filter — exact mode; rows without one don't match. */
export function matchesMode(job, mode) {
  if (!mode) return true
  return job.workMode === mode
}

/** Posted-within filter — `days` is a day count as a string. */
export function matchesWhen(job, days) {
  if (!days) return true
  return (job.daysAgo ?? Number.POSITIVE_INFINITY) <= Number(days)
}

export function contactHref(contact) {
  if (!contact) return null
  if (contact.kind === 'phone') return `tel:${contact.value.replace(/\s/g, '')}`
  if (contact.kind === 'email') return `mailto:${contact.value}`
  return contact.value
}

export function makeId() {
  return `u${Date.now().toString(36)}`
}
