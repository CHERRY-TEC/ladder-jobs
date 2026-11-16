import { createClient } from '@supabase/supabase-js'

/**
 * Supabase client — Phase 2 wiring.
 *
 * Configuration comes from .env.local (never commit it):
 *   VITE_SUPABASE_URL       public project URL
 *   VITE_SUPABASE_ANON_KEY  public anon key (safe in the browser; RLS protects data)
 *
 * The service-role key must NEVER appear here — it is server-side only and
 * is read exclusively by scripts/ingest-jobs.mjs via process.env.
 *
 * If the env vars are missing the app still runs: the client is null and
 * callers must go through requireSupabase() to surface a clear configuration
 * error instead of pretending a backend exists.
 */

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

export function requireSupabase() {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local.',
    )
  }
  return supabase
}

/**
 * One-time schema probe, cached per session.
 *
 * 'ready'        a ladder_ table answered — migrations are applied
 * 'missing'      env configured but schema absent (PGRST205)
 * 'error'        reachable but failing (bad key, offline, …)
 * 'unconfigured' env vars absent
 *
 * Uses GET, never HEAD: supabase-js cannot parse HEAD error bodies and would
 * falsely report success while the server 404s.
 */
let probePromise = null
export function probeBackend() {
  if (!supabase) return Promise.resolve('unconfigured')
  if (!probePromise) {
    probePromise = supabase
      .from('ladder_job_categories')
      .select('slug')
      .limit(1)
      .then(({ error }) => {
        if (!error) return 'ready'
        if (error.code === 'PGRST205' || /schema cache|does not exist/i.test(error.message))
          return 'missing'
        return 'error'
      })
      .catch(() => 'error')
  }
  return probePromise
}
