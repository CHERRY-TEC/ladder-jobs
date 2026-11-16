import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import DashboardShell from '../components/DashboardShell.jsx'
import SeekerNav from '../components/SeekerNav.jsx'
import { useAuth } from '../lib/auth.jsx'
import { useLanguage } from '../lib/i18n.jsx'
import { supabase } from '../lib/supabase.js'

/**
 * Seeker inbox — Phase 9.
 *
 * Lists the seeker's own notifications (e.g. an employer moved their application
 * through the stage ladder). Reads are scoped by the `profile_id = auth.uid()`
 * RLS policy; the writes that create these rows come from the employer-side stage
 * moves in the applicant management screen.
 */

export default function Notifications() {
  const { user } = useAuth()
  const { t, lang, isTranslated, isFallback } = useLanguage()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    if (!user?.id) {
      setLoading(false)
      return
    }
    setLoading(true)
    supabase
      .from('ladder_notifications')
      .select('id, type, title, body, link, is_read, created_at')
      .eq('profile_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (!alive) return
        if (err) setError(err.message)
        else setRows(data ?? [])
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [user?.id])

  const markRead = async (id) => {
    const { error: err } = await supabase
      .from('ladder_notifications')
      .update({ is_read: true })
      .eq('id', id)
    if (!err) setRows((prev) => prev.map((r) => (r.id === id ? { ...r, is_read: true } : r)))
  }

  const unread = rows.filter((r) => !r.is_read).length
  const titleTranslated = isTranslated('notifications.title')
  const titleFallback = isFallback('notifications.title')

  return (
    <DashboardShell title={t('notifications.title')} subtitle="Updates on your applications and activity.">
      <SeekerNav />

      {lang !== 'en' && (
        <p className="mt-3 text-xs text-mute" data-testid="notifications-lang-note">
          {titleTranslated ? t('language.translated') : titleFallback ? t('language.fallback') : t('language.fallback')}
        </p>
      )}

      {error && (
        <p role="alert" className="mt-6 rounded-lg bg-[#fbf0ee] px-3 py-2 text-sm font-semibold text-alert">
          {t('notifications.loadError')}: {error}
        </p>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-mute" data-testid="notifications-loading">{t('notifications.loading')}</p>
      ) : rows.length === 0 ? (
        <div className="mt-6 rounded-xl border border-line bg-white p-6" data-testid="notifications-empty">
          <p className="font-semibold text-ink">{t('notifications.empty')}</p>
          <Link to="/#browse" className="mt-4 inline-block rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover">
            {t('notifications.browseJobs')}
          </Link>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-line rounded-xl border border-line bg-white" data-testid="notifications-list">
          {rows.map((n) => (
            <li key={n.id} className="flex flex-wrap items-start justify-between gap-3 p-5" data-testid="notification-row">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-ink">{n.title}</p>
                {n.body && <p className="mt-1 text-sm text-ink-soft">{n.body}</p>}
                <p className="mt-1 text-xs text-mute">{new Date(n.created_at).toLocaleString('en-IN')}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${n.is_read ? 'bg-paper text-mute border-line' : 'bg-signal text-accent border-transparent'}`}>
                  {n.is_read ? t('notifications.read') : t('notifications.new')}
                </span>
                {!n.is_read && (
                  <button
                    type="button"
                    onClick={() => markRead(n.id)}
                    className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink-soft hover:border-mute"
                    data-testid="notification-mark-read"
                  >
                    {t('notifications.markRead')}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-xs text-mute" data-testid="notifications-count">{t('notifications.unreadCount', { count: unread })}</p>
    </DashboardShell>
  )
}
