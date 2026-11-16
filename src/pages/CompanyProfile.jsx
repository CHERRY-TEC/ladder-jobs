import { useEffect, useState } from 'react'
import DashboardShell from '../components/DashboardShell.jsx'
import EmployerNav from '../components/EmployerNav.jsx'
import StatusPill from '../components/StatusPill.jsx'
import { useAuth } from '../lib/auth.jsx'
import { supabase } from '../lib/supabase.js'
import { useEmployer } from '../lib/useEmployer.js'
import { COMPANY_SIZES, INDUSTRIES, LOGO_RULES } from '../data/ladder.js'

const inputClass =
  'mt-1.5 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-base placeholder:text-mute'

const blank = {
  company_name: '',
  about: '',
  website: '',
  industry: '',
  company_size: '',
  state: 'Telangana',
  district: '',
  city: '',
}

function validateLogo(file) {
  const lower = file.name.toLowerCase()
  if (!LOGO_RULES.extensions.some((ext) => lower.endsWith(ext)))
    return `Only ${LOGO_RULES.extensions.join(', ')} files are allowed.`
  if (file.type && !LOGO_RULES.mimeTypes.includes(file.type))
    return `Unsupported file type (${file.type}). ${LOGO_RULES.label}.`
  if (file.size > LOGO_RULES.maxBytes)
    return `That image is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is 2 MB.`
  if (file.size === 0) return 'That file is empty.'
  return null
}

/**
 * Company profile — the employer's one row in `ladder_employers`.
 * Status/verified_at are DISPLAY ONLY: the row's status is owned by the DB lock
 * trigger and by admin review, so this form never sends it.
 */
export default function CompanyProfile() {
  const { user } = useAuth()
  const { backend, company, loading, upsert } = useEmployer()
  const dbReady = backend === 'ready'

  const [form, setForm] = useState(blank)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [logoBusy, setLogoBusy] = useState(false)

  // Seed the form from the row whenever it arrives or changes.
  useEffect(() => {
    if (!company) return
    setForm({
      company_name: company.company_name ?? '',
      about: company.about ?? '',
      website: company.website ?? '',
      industry: company.industry ?? '',
      company_size: company.company_size ?? '',
      state: company.state ?? '',
      district: company.district ?? '',
      city: company.city ?? '',
    })
  }, [company])

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setSaved(false)
  }

  const save = async (e) => {
    e.preventDefault()
    setError(null)
    setSaved(false)
    const name = form.company_name.trim()
    if (name.length < 2 || name.length > 150) {
      setError('Company name must be between 2 and 150 characters.')
      return
    }
    if (form.website && !/^https?:\/\/\S+\.\S+/.test(form.website.trim())) {
      setError('Website must start with http:// or https:// — e.g. https://example.in')
      return
    }
    setSaving(true)
    const { error: err } = await upsert({
      company_name: name,
      about: form.about.trim() || null,
      website: form.website.trim() || null,
      industry: form.industry || null,
      company_size: form.company_size || null,
      state: form.state.trim() || null,
      district: form.district.trim() || null,
      city: form.city.trim() || null,
    })
    setSaving(false)
    if (err) setError(err.message)
    else setSaved(true)
  }

  const uploadLogo = async (file) => {
    if (!file || logoBusy) return
    setError(null)
    const problem = validateLogo(file)
    if (problem) return setError(problem)
    setLogoBusy(true)
    try {
      const safe = file.name.replace(/[^\w.\-]+/g, '_').slice(-60)
      // Public bucket, but still scoped to the uploader's own folder.
      const path = `${user.id}/${Date.now()}-${safe}`
      const { error: upErr } = await supabase.storage
        .from('ladder-logos')
        .upload(path, file, { upsert: false, contentType: file.type || undefined })
      if (upErr) throw new Error(upErr.message)

      const { data: pub } = supabase.storage.from('ladder-logos').getPublicUrl(path)
      const { error: saveErr } = await upsert({ logo_url: pub.publicUrl })
      if (saveErr) {
        await supabase.storage.from('ladder-logos').remove([path])
        throw new Error(saveErr.message)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLogoBusy(false)
    }
  }

  const removeLogo = async () => {
    if (!company?.logo_url) return
    setError(null)
    const { error: err } = await upsert({ logo_url: null })
    if (err) return setError(err.message)
    // Best effort: drop the stored object once the row no longer points at it.
    const marker = '/ladder-logos/'
    const idx = company.logo_url.indexOf(marker)
    if (idx !== -1) {
      const path = decodeURIComponent(company.logo_url.slice(idx + marker.length))
      await supabase.storage.from('ladder-logos').remove([path])
    }
  }

  return (
    <DashboardShell title="Company profile" subtitle="What seekers see above every vacancy you post.">
      <EmployerNav />

      {!dbReady && backend !== 'checking' && (
        <div className="mt-6 rounded-xl border border-line bg-signal px-4 py-3 text-sm text-ink-soft" data-testid="company-db-notice">
          {backend === 'unconfigured'
            ? 'Supabase is not configured — company details cannot be saved. Nothing is faked or stored locally.'
            : backend === 'missing'
              ? 'Database not set up yet — run the migrations (see supabase/README.md) and this form goes live.'
              : 'Backend connection error — saving is paused until it recovers.'}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-[#fbf0ee] px-3 py-2 text-sm font-semibold text-alert" data-testid="company-error">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="mt-4 rounded-lg bg-signal px-3 py-2 text-sm font-semibold text-accent" data-testid="company-saved">
          Company profile saved.
        </p>
      )}

      {/* ------------------------------------------------------------ status -- */}
      <section className="mt-6 rounded-xl border border-line bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-ink">Verification status</h2>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-ink-soft">
              {company
                ? 'Read straight from the database — this page cannot change it.'
                : 'Save a company name below first, then submit a registration document on the Verification tab.'}
            </p>
          </div>
          <StatusPill status={company?.status ?? 'unverified'} />
        </div>
      </section>

      {/* --------------------------------------------------------------- form -- */}
      <form onSubmit={save} className="mt-6 rounded-xl border border-line bg-white p-6" data-testid="company-form">
        <h2 className="text-sm font-bold text-ink">Company details</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-bold sm:col-span-2">
            Company name <span className="text-alert">*</span>
            <input
              required
              minLength={2}
              maxLength={150}
              className={inputClass}
              value={form.company_name}
              onChange={set('company_name')}
              placeholder="Sri Venkateswara Logistics Pvt Ltd"
              disabled={!dbReady}
              data-testid="company-name"
            />
          </label>

          <label className="block text-sm font-bold">
            Industry
            <select
              className={inputClass}
              value={form.industry}
              onChange={set('industry')}
              disabled={!dbReady}
              data-testid="company-industry"
            >
              <option value="">Select an industry</option>
              {INDUSTRIES.map((i) => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-bold">
            Company size
            <select
              className={inputClass}
              value={form.company_size}
              onChange={set('company_size')}
              disabled={!dbReady}
              data-testid="company-size"
            >
              <option value="">Select size</option>
              {COMPANY_SIZES.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-bold sm:col-span-2">
            About the company
            <span className="mb-1 block text-xs font-normal text-mute">
              Two or three honest lines — what you do, where you operate, what shifts look like.
            </span>
            <textarea
              rows={4}
              maxLength={2000}
              className={inputClass}
              value={form.about}
              onChange={set('about')}
              placeholder="We run a 40,000 sq ft warehouse in Medchal with two shifts and staff transport from Uppal."
              disabled={!dbReady}
              data-testid="company-about"
            />
          </label>

          <label className="block text-sm font-bold sm:col-span-2">
            Website
            <span className="mb-1 block text-xs font-normal text-mute">
              Optional — must start with http:// or https://
            </span>
            <input
              type="url"
              className={inputClass}
              value={form.website}
              onChange={set('website')}
              placeholder="https://yourcompany.in"
              disabled={!dbReady}
              data-testid="company-website"
            />
          </label>

          <label className="block text-sm font-bold">
            State
            <input
              className={inputClass}
              value={form.state}
              onChange={set('state')}
              placeholder="Telangana"
              disabled={!dbReady}
              data-testid="company-state"
            />
          </label>

          <label className="block text-sm font-bold">
            District
            <input
              className={inputClass}
              value={form.district}
              onChange={set('district')}
              placeholder="Medchal–Malkajgiri"
              disabled={!dbReady}
              data-testid="company-district"
            />
          </label>

          <label className="block text-sm font-bold">
            City / main location
            <input
              className={inputClass}
              value={form.city}
              onChange={set('city')}
              placeholder="Hyderabad"
              disabled={!dbReady}
              data-testid="company-city"
            />
          </label>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={!dbReady || saving}
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="company-save"
          >
            {saving ? 'Saving…' : company ? 'Save changes' : 'Create company profile'}
          </button>
          {company && (
            <span className="text-xs text-mute">
              Created {new Date(company.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          )}
        </div>
      </form>

      {/* --------------------------------------------------------------- logo -- */}
      <section className="mt-6 rounded-xl border border-line bg-white p-6">
        <h2 className="text-sm font-bold text-ink">Company logo</h2>
        <p className="mt-1 text-xs text-mute">{LOGO_RULES.label} — shown on your vacancies once you have any.</p>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          {company?.logo_url ? (
            <img
              src={company.logo_url}
              alt=""
              className="h-16 w-16 rounded-xl border border-line object-cover"
              data-testid="logo-preview"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          ) : (
            <div
              className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-line text-xs text-mute"
              data-testid="logo-empty"
            >
              No logo
            </div>
          )}

          <label className={`cursor-pointer rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-ink-soft hover:border-mute ${!dbReady || logoBusy ? 'cursor-not-allowed opacity-60' : ''}`}>
            <input
              type="file"
              accept={LOGO_RULES.extensions.join(',')}
              className="sr-only"
              disabled={!dbReady || logoBusy}
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                uploadLogo(f)
              }}
              data-testid="logo-input"
            />
            {logoBusy ? 'Uploading…' : company?.logo_url ? 'Replace logo' : 'Upload logo'}
          </label>

          {company?.logo_url && (
            <button
              type="button"
              onClick={removeLogo}
              disabled={!dbReady || logoBusy}
              className="rounded-lg px-3 py-2.5 text-sm font-semibold text-alert hover:underline disabled:opacity-50"
              data-testid="logo-remove"
            >
              Remove
            </button>
          )}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-mute">
          Stored publicly in your own folder so vacancies can render it — no other employer can write there.
        </p>
      </section>

      <p className="mt-6 text-xs leading-relaxed text-mute">
        The <strong>Verified</strong> badge is never set from this page. It appears only after an admin
        approves a registration document on the Verification tab.
      </p>
    </DashboardShell>
  )
}
