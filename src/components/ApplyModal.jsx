import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../lib/auth.jsx'
import { useStore } from '../lib/store.jsx'
import { checkRateLimit, formatRetryAfter } from '../lib/rateLimit.js'

/**
 * Apply to a live listing — Phase 7.
 *
 * Writes a real `ladder_applications` row (status 'applied'). Duplicate
 * prevention: the DB unique (job_id, profile_id) plus an explicit read here;
 * a withdrawn row is replaced (re-apply), anything else is refused honestly.
 * The apply insert can only succeed on an `active` job (RLS), so this modal
 * only ever shows on listings the seeker could actually see.
 */
export default function ApplyModal({ job, onClose }) {
  const { user, role } = useAuth()
  const { notify } = useStore()
  const [cover, setCover] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const submit = async () => {
    if (!user) {
      setError('Sign in to apply — your application lands with the employer.')
      return
    }
    if (role !== 'seeker') {
      setError('Only seeker accounts apply to listings.')
      return
    }
    const rl = checkRateLimit('apply:submit', { limit: 8, windowMs: 60_000, blockMs: 60_000 })
    if (!rl.allowed) {
      setError(`You're applying too quickly. Try again in ${formatRetryAfter(rl.retryAfterMs)}.`)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const { data: mine } = await supabase
        .from('ladder_applications')
        .select('id, status')
        .eq('job_id', job.id)
        .eq('profile_id', user.id)
      const existing = (mine ?? []).find((r) => r.status !== 'withdrawn')
      if (existing) {
        setBusy(false)
        setError('You already applied to this listing — check My Applications.')
        return
      }
      if ((mine ?? []).some((r) => r.status === 'withdrawn')) {
        // Withdrawn rows free the slot: replace with a fresh application.
        const { error: delErr } = await supabase
          .from('ladder_applications')
          .delete()
          .eq('job_id', job.id)
          .eq('profile_id', user.id)
        if (delErr) throw new Error(delErr.message)
      }
      const { error: insErr } = await supabase.from('ladder_applications').insert({
        job_id: job.id,
        profile_id: user.id,
        status: 'applied',
        cover_note: cover.trim() || null,
      })
      if (insErr) throw new Error(insErr.message)
      notify('Application sent — the employer can now move you through the stages.')
      onClose()
    } catch (e) {
      setBusy(false)
      setError(e.message)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Apply to job"
      data-testid="apply-modal"
    >
      <div className="w-full max-w-lg rounded-xl border border-line bg-white p-6">
        <h2 className="display text-xl">Apply — {job.title}</h2>
        <p className="mt-1 text-sm text-mute">
          Your application starts as <strong>Applied</strong>. The employer moves you through the stages:
          Viewed → Shortlisted → Interview → Selected / Rejected.
        </p>
        <label className="mt-4 block text-sm font-bold text-ink-soft">
          Cover note <span className="font-normal text-mute">(optional)</span>
          <textarea
            className="mt-1.5 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-base placeholder:text-mute"
            rows={3}
            value={cover}
            onChange={(e) => setCover(e.target.value)}
            placeholder="A line or two about why this role fits you…"
            data-testid="apply-cover"
          />
        </label>
        {error && (
          <p className="mt-3 rounded-lg bg-[#fbf0ee] px-3 py-2 text-sm font-semibold text-alert" data-testid="apply-error">
            {error}
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
            data-testid="apply-submit"
          >
            {busy ? 'Sending…' : 'Submit application'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink-soft hover:border-mute"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
