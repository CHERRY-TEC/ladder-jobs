import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { isSupabaseConfigured, supabase } from './supabase.js'

/**
 * Auth context — Phase 3.
 *
 * Roles come ONLY from the database (`ladder_user_roles`, written by the
 * signup trigger / ladder_grant_admin). The client can request `seeker` or
 * `employer` at signup via user metadata; `admin` is rejected server-side.
 *
 * When Supabase is not configured, `mode` is 'unconfigured' and every action
 * returns a clear configuration error — we never fake a session.
 */

const AuthContext = createContext(null)

const ROLE_HOME = {
  seeker: '/me',
  employer: '/employer',
  admin: '/admin',
}

export function homeForRole(role) {
  return ROLE_HOME[role] ?? '/me'
}

export function AuthProvider({ children }) {
  const [mode, setMode] = useState(() => (isSupabaseConfigured ? 'loading' : 'unconfigured'))
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [role, setRole] = useState(null)
  const [roleStatus, setRoleStatus] = useState('idle') // idle | loading | ready | missing | error
  const [profile, setProfile] = useState(null)

  const loadRoleAndProfile = useCallback(async (uid) => {
    setRoleStatus('loading')
    const [roles, profs] = await Promise.all([
      supabase.from('ladder_user_roles').select('role').eq('user_id', uid).maybeSingle(),
      supabase
        .from('ladder_profiles')
        .select(
          'full_name, email, phone, headline, bio, city, state, avatar_url, date_of_birth, experience_level, privacy_show_phone',
        )
        .eq('id', uid)
        .maybeSingle(),
    ])

    if (roles.error) {
      if (roles.error.code === 'PGRST205') setRoleStatus('missing')
      else setRoleStatus('error')
      setRole(null)
    } else {
      setRole(roles.data?.role ?? null)
      setRoleStatus('ready')
    }

    if (!profs.error) setProfile(profs.data ?? null)
    else setProfile(null)
  }, [])

  useEffect(() => {
    if (!supabase) return
    let alive = true

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return
      const s = data.session ?? null
      setSession(s)
      setUser(s?.user ?? null)
      setMode(s ? 'authenticated' : 'signed-out')
      if (s) loadRoleAndProfile(s.user.id)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!alive) return
      setSession(next)
      setUser(next?.user ?? null)
      setMode(next ? 'authenticated' : 'signed-out')
      if (next) loadRoleAndProfile(next.user.id)
      else {
        setRole(null)
        setProfile(null)
        setRoleStatus('idle')
      }
    })

    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [loadRoleAndProfile])

  const signUp = useCallback(async ({ email, password, fullName, requestedRole }) => {
    if (!supabase) {
      return {
        error: 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local.',
      }
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          requested_role: requestedRole, // 'seeker' | 'employer' — never 'admin'
        },
      },
    })
    if (error) return { error: error.message }
    if (!data.session) return { needsConfirm: true }
    return {}
  }, [])

  const signIn = useCallback(async ({ email, password }) => {
    if (!supabase) {
      return {
        error: 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local.',
      }
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    return {}
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    setRole(null)
    setProfile(null)
    setRoleStatus('idle')
    setMode('signed-out')
  }, [])

  const value = useMemo(
    () => ({
      mode,
      user,
      session,
      role,
      roleStatus,
      profile,
      isAuthenticated: Boolean(user),
      signUp,
      signIn,
      signOut,
      reloadRole: () => user && loadRoleAndProfile(user.id),
    }),
    [mode, user, session, role, roleStatus, profile, signUp, signIn, signOut, loadRoleAndProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
