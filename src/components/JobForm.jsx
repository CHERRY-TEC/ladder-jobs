import { useState } from 'react'
import { CATEGORIES, TYPES } from '../data/seed.js'
import {
  EDUCATION_LADDER,
  EXPERIENCE_LEVELS,
  WORK_MODES,
} from '../data/ladder.js'

const inputClass =
  'mt-1.5 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-base placeholder:text-mute'

export const EMPTY_JOB = {
  title: '',
  category: 'household',
  type: 'Full-time',
  education: 'any',
  experience: 'no_experience',
  workMode: 'onsite',
  city: '',
  state: 'Telangana',
  district: '',
  locality: '',
  payMin: '',
  payMax: '',
  payNote: '',
  summary: '',
  duties: '',
  requirements: '',
  contact: '',
}

function Field({ label, hint, className = '', children }) {
  return (
    <label className={`block text-sm font-bold ${className}`}>
      {label}
      {hint && <span className="mb-1 block text-xs font-normal text-mute">{hint}</span>}
      {children}
    </label>
  )
}

const splitLines = (text) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

/** Free-text contact → the same phone/email/link shape the board renders. */
export function deriveContact(raw) {
  const value = raw.trim()
  if (value.startsWith('http')) return { kind: 'link', value, label: 'Open the application link' }
  if (value.includes('@')) return { kind: 'email', value, label: `Email ${value}` }
  const digits = value.replace(/\D/g, '')
  if (digits.length >= 10) {
    const normalized = value.startsWith('+')
      ? value.replace(/\s/g, '')
      : `+91${digits.slice(-10)}`
    return { kind: 'phone', value: normalized, label: `Call ${value}` }
  }
  // No recognisable channel — stored as plain text, rendered honestly.
  return { kind: null, value, label: value }
}

function toNumber(value) {
  if (value === '' || value == null) return null
  const n = Number(String(value).replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

/** The label the form generates from the numbers — used to decide whether an
 *  existing listing's label was hand-written (shown in the pay-note field). */
export function autoPayLabel(min, max) {
  if (min === null || min === undefined || min === '') return null
  const n = Number(min)
  if (!Number.isFinite(n)) return null
  return max !== null && max !== undefined && max !== ''
    ? `₹${n.toLocaleString('en-IN')} – ₹${Number(max).toLocaleString('en-IN')} / month`
    : `₹${n.toLocaleString('en-IN')} / month`
}

/**
 * The one job form — used by /post (create) and /employer/jobs/:id (edit).
 *
 * It never sends `status`, `origin`, `source_*`, `published_at` or `views`:
 * those belong to moderation and to the database (migration 0008 pins them),
 * so a client write simply cannot carry them.
 *
 * `onSubmit(payload)` receives ready-to-insert DB columns (minus employer_id,
 * which the caller adds) and returns an error message or null.
 */
export default function JobForm({
  initial,
  categoryIds = {},
  onSubmit,
  submitLabel = 'Publish listing',
}) {
  const [form, setForm] = useState(() => ({ ...EMPTY_JOB, ...initial }))
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const update = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    const title = form.title.trim()
    const summary = form.summary.trim()
    const city = form.city.trim()
    const contact = form.contact.trim()

    if (title.length < 3 || title.length > 200) {
      setError('Job title must be between 3 and 200 characters.')
      return
    }
    if (summary.length < 10 || summary.length > 4000) {
      setError('The short description must be between 10 and 4000 characters.')
      return
    }
    if (!city) {
      setError('Enter the city or main location — seekers filter by it.')
      return
    }
    if (!contact) {
      setError('Add a phone number, email or application link so people can apply.')
      return
    }

    const payMin = toNumber(form.payMin)
    const payMax = toNumber(form.payMax)
    if (form.payMin && payMin === null) {
      setError('Pay minimum must be a number (monthly, in ₹).')
      return
    }
    if (payMin !== null && payMin < 0) {
      setError('Pay cannot be negative.')
      return
    }
    if (payMax !== null && payMin !== null && payMax < payMin) {
      setError('Pay maximum cannot be lower than the minimum.')
      return
    }

    const categoryId = categoryIds[form.category]
    if (!categoryId) {
      setError('Job categories are not loaded yet — check the connection and try again.')
      return
    }

    const autoLabel = autoPayLabel(payMin, payMax)

    const payload = {
      title,
      category_id: categoryId,
      job_type: form.type,
      education_required: form.education,
      experience_required: form.experience,
      work_mode: form.workMode,
      is_remote: form.workMode === 'remote',
      salary_min: payMin,
      salary_max: payMax,
      salary_period: payMin !== null ? 'month' : null,
      salary_label: form.payNote.trim() || autoLabel,
      state: form.state.trim() || null,
      district: form.district.trim() || null,
      city,
      locality: form.locality.trim() || null,
      location_label: null, // the board renders city/state from the columns
      summary,
      duties: splitLines(form.duties),
      requirements: splitLines(form.requirements),
      ...(() => {
        const c = deriveContact(form.contact)
        return { contact_kind: c.kind, contact_value: c.value, contact_label: c.label }
      })(),
    }

    setBusy(true)
    try {
      const err = await onSubmit(payload)
      if (err) setError(err)
    } catch (err) {
      setError(err?.message || 'Something went wrong saving the listing.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2" data-testid="job-form">
      <Field label="Job title" className="sm:col-span-2">
        <input
          required
          className={inputClass}
          value={form.title}
          onChange={update('title')}
          placeholder="e.g. Warehouse Packer — Night Shift"
          data-testid="job-title"
        />
      </Field>

      <Field label="Category">
        <select
          className={inputClass}
          value={form.category}
          onChange={update('category')}
          data-testid="job-category"
        >
          {Object.entries(CATEGORIES).map(([id, meta]) => (
            <option key={id} value={id}>
              {meta.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Job type">
        <select
          className={inputClass}
          value={form.type}
          onChange={update('type')}
          data-testid="job-type"
        >
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Education needed" hint="The 10-rung ladder — pick the rung this job actually needs">
        <select
          className={inputClass}
          value={form.education}
          onChange={update('education')}
          data-testid="job-education"
        >
          {EDUCATION_LADDER.map((level) => (
            <option key={level.id} value={level.id}>
              {level.label}
            </option>
          ))}
          <option value="any">Any education</option>
        </select>
      </Field>

      <Field label="Experience needed">
        <select
          className={inputClass}
          value={form.experience}
          onChange={update('experience')}
          data-testid="job-experience"
        >
          {EXPERIENCE_LEVELS.map((level) => (
            <option key={level.id} value={level.id}>
              {level.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Work mode">
        <select
          className={inputClass}
          value={form.workMode}
          onChange={update('workMode')}
          data-testid="job-workmode"
        >
          {WORK_MODES.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="City / main location">
        <input
          required
          className={inputClass}
          value={form.city}
          onChange={update('city')}
          placeholder="e.g. Medchal"
          data-testid="job-city"
        />
      </Field>

      <Field label="State">
        <input
          className={inputClass}
          value={form.state}
          onChange={update('state')}
          placeholder="Telangana"
          data-testid="job-state"
        />
      </Field>

      <Field label="District">
        <input
          className={inputClass}
          value={form.district}
          onChange={update('district')}
          placeholder="Medchal–Malkajgiri"
          data-testid="job-district"
        />
      </Field>

      <Field label="Locality" hint="Optional — area, colony or landmark">
        <input
          className={inputClass}
          value={form.locality}
          onChange={update('locality')}
          placeholder="Uppal"
          data-testid="job-locality"
        />
      </Field>

      <Field label="Pay minimum (₹ / month)" hint="Monthly equivalent — daily wages × 26. Blank = not disclosed.">
        <input
          type="number"
          min="0"
          step="500"
          className={inputClass}
          value={form.payMin}
          onChange={update('payMin')}
          placeholder="e.g. 15600"
          data-testid="job-paymin"
        />
      </Field>

      <Field label="Pay maximum (₹ / month)" hint="Optional">
        <input
          type="number"
          min="0"
          step="500"
          className={inputClass}
          value={form.payMax}
          onChange={update('payMax')}
          placeholder="e.g. 22000"
          data-testid="job-paymax"
        />
      </Field>

      <Field
        label="Pay description"
        className="sm:col-span-2"
        hint="Optional — overrides the auto label, e.g. “₹600 per day + food”"
      >
        <input
          className={inputClass}
          value={form.payNote}
          onChange={update('payNote')}
          placeholder="₹15,000 – ₹20,000 / month + night allowance"
          data-testid="job-paynote"
        />
      </Field>

      <Field label="Short description" className="sm:col-span-2">
        <textarea
          required
          rows={3}
          className={inputClass}
          value={form.summary}
          onChange={update('summary')}
          placeholder="One or two sentences about the work"
          data-testid="job-summary"
        />
      </Field>

      <Field label="What they will do" hint="One point per line">
        <textarea
          rows={4}
          className={inputClass}
          value={form.duties}
          onChange={update('duties')}
          placeholder={'Pick and pack orders in the cold-storage bay\nScan and label each carton'}
          data-testid="job-duties"
        />
      </Field>

      <Field label="Who can apply" hint="One point per line">
        <textarea
          rows={4}
          className={inputClass}
          value={form.requirements}
          onChange={update('requirements')}
          placeholder={'No degree needed\nAvailable for 8 pm to 5 am shifts'}
          data-testid="job-requirements"
        />
      </Field>

      <Field
        label="How to apply"
        className="sm:col-span-2"
        hint="Phone number, email address or application link"
      >
        <input
          required
          className={inputClass}
          value={form.contact}
          onChange={update('contact')}
          placeholder="e.g. 98765 43210 or jobs@company.com"
          data-testid="job-contact"
        />
      </Field>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-alert bg-white px-4 py-3 text-sm font-semibold text-alert sm:col-span-2"
          data-testid="job-form-error"
        >
          {error}
        </p>
      )}

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-accent px-6 py-3 font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="job-submit"
        >
          {busy ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
