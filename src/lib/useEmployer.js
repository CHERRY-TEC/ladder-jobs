import { useCallback, useEffect, useState } from 'react'
import { supabase, probeBackend } from './supabase.js'
import { useAuth } from './auth.jsx'

/**
 * The signed-in employer's company row (`ladder_employers`, keyed by owner_id).
 *
 * Every employer has exactly one row — `owner_id` is UNIQUE and the insert is
 * created by the Company page, not by a signup trigger, so a brand-new employer
 * simply has `company = null` until they fill the form in. Nothing is invented
 * here: no placeholder company, no optimistic status.
 *
 * Returns:
 *   backend  'checking' | 'ready' | 'unconfigured' | 'missing' | 'error'
 *   company  the row, or null when none exists yet
 *   reload() re-reads the row
 *   upsert(fields) insert-or-update, returns { error } — callers surface it
 */
export function useEmployer() {
  const { user } = useAuth()
  const [backend, setBackend] = useState('checking')
  const [company, setCompany] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    probeBackend().then((s) => alive && setBackend(s))
    return () => {
      alive = false
    }
  }, [])

  const read = useCallback(async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('ladder_employers')
      .select(
        'id, owner_id, company_name, logo_url, about, website, industry, ' +
          'company_size, country, state, district, city, status, verified_at, created_at',
      )
      .eq('owner_id', user.id)
      .maybeSingle()
    if (error) {
      setCompany(null)
      return { error }
    }
    setCompany(data ?? null)
    return { error: null }
  }, [user])

  useEffect(() => {
    if (backend !== 'ready' || !user) {
      if (backend !== 'ready') setLoading(false)
      return
    }
    let alive = true
    setLoading(true)
    read().finally(() => {
      if (alive) setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [backend, user, read])

  /** Insert (owner_id = me) or update the existing row. Status is never sent:
   *  the DB lock trigger owns it, so a client write can't touch the badge. */
  const upsert = useCallback(
    async (fields) => {
      if (!user) return { error: new Error('Not signed in.') }
      if (company?.id) {
        const { error } = await supabase
          .from('ladder_employers')
          .update(fields)
          .eq('id', company.id)
        if (!error) await read()
        return { error }
      }
      const { error } = await supabase
        .from('ladder_employers')
        .insert({ ...fields, owner_id: user.id })
      if (!error) await read()
      return { error }
    },
    [user, company, read],
  )

  return { backend, company, loading, reload: read, upsert }
}
