import { useEffect, useState } from 'react'
import DashboardShell from '../components/DashboardShell.jsx'
import SeekerNav from '../components/SeekerNav.jsx'
import { useAuth } from '../lib/auth.jsx'
import { supabase, probeBackend } from '../lib/supabase.js'

const inputClass =
  'mt-1.5 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-base placeholder:text-mute'

/**
 * Seeker settings: privacy visibility + contact details.
 * Everything here writes real rows — no local-only pretend settings.
 */
export default function Settings() {
  const { user, profile, reloadRole, signOut, role } = useAuth()
  const [backend, setBackend] = useState('checking')
  const [showPhone, setShowPhone] = useState(false)
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const dbReady = backend === 'ready'

  useEffect(() => {
    let alive = true
    probeBackend().then((s) => alive && setBackend(s))
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!profile) return
    setShowPhone(Boolean(profile.privacy_show_phone))
    setPhone(profile.phone ?? '')
    setCity(profile.city ?? '')
  }, [profile])

  const save = async () => {
    setSaving(true)
    setError(null)
    const { error: err } = await supabase
      .from('ladder_profiles')
      .update({
        privacy_show_phone: showPhone,
        phone: phone.trim() || null,
        city: city.trim() || null,
      })
      .eq('id', user.id)
    setSaving(false)
    if (err) setError(err.message)
    else reloadRole()
  }

  return (
    <DashboardShell title="Settings" subtitle="Privacy and contact details for your account.">
      <SeekerNav />

      {!dbReady && backend !== 'checking' && (
        <div className="mt-6 rounded-xl border border-line bg-signal px-4 py-3 text-sm text-ink-soft" data-testid="settings-db-notice">
          {backend === 'unconfigured'
            ? 'Supabase is not configured — settings are read-only. Nothing is faked or stored locally.'
            : backend === 'missing'
              ? 'Database not set up yet — run the migrations (see supabase/README.md) and these settings go live.'
              : 'Backend connection error — saving is paused until it recovers.'}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-[#fbf0ee] px-3 py-2 text-sm font-semibold text-alert">
          {error}
        </p>
      )}

      {/* ------------------------------------------------------------ privacy */}
      <section className="mt-6 rounded-xl border border-line bg-white p-6" data-testid="section-privacy">
        <h2 className="text-sm font-bold text-ink">Privacy</h2>
        <p className="mt-1 text-xs text-mute">You decide what employers can see.</p>

        <label className="mt-4 flex items-start gap-3 rounded-lg border border-line p-4">
          <input
            type="checkbox"
            className="mt-1"
            checked={showPhone}
            onChange={(e) => setShowPhone(e.target.checked)}
            disabled={!dbReady}
            data-testid="toggle-show-phone"
          />
          <span>
            <span className="block text-sm font-bold text-ink">Show my phone number to employers</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-mute">
              When off, employers see your name and city only — they can still reach you through
              applications you accept. Your number is never listed publicly.
            </span>
          </span>
        </label>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-bold">
            Phone
            <input
              className={inputClass}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98xxxxxx21"
              disabled={!dbReady}
            />
          </label>
          <label className="block text-sm font-bold">
            City
            <input
              className={inputClass}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Hyderabad"
              disabled={!dbReady}
            />
          </label>
        </div>

        <button
          onClick={save}
          disabled={!dbReady || saving}
          className="mt-5 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="save-settings"
        >
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </section>

      {/* ------------------------------------------------------------ account */}
      <section className="mt-6 rounded-xl border border-line bg-white p-6" data-testid="section-account">
        <h2 className="text-sm font-bold text-ink">Account</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-mute">Email</dt>
            <dd className="font-semibold text-ink">{user?.email ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-mute">Role</dt>
            <dd className="font-semibold text-ink">{role ?? '—'}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs leading-relaxed text-mute">
          Email changes and account deletion are handled by an administrator so no one can quietly
          take over an account — use the contact link in the footer.
        </p>

        <button
          onClick={() => signOut()}
          className="mt-4 rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink-soft transition-colors hover:border-mute hover:text-ink"
          data-testid="settings-sign-out"
        >
          Sign out of this device
        </button>
      </section>
    </DashboardShell>
  )
}
