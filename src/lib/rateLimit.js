/**
 * Lightweight client-side rate limiting for sensitive actions.
 *
 * This is a best-effort UI guard (not a substitute for server-side enforcement).
 * It throttles repeated attempts per action key in localStorage so the same
 * browser session/device can't spam auth/apply flows. Real enforcement for auth
 * is also provided by Supabase Auth rate limits when configured; this keeps the
 * app honest and responsive on the client.
 */
const PREFIX = 'ladder:rl:'

function now() {
  return Date.now()
}

function read(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function write(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // ignore storage failures (private mode/quota)
  }
}

/**
 * Returns { allowed, retryAfterMs, reason }.
 * - limit: max attempts in windowMs
 * - blockMs: cooldown after exceeding limit
 */
export function checkRateLimit(key, { limit = 5, windowMs = 60_000, blockMs = 60_000 } = {}) {
  const t = now()
  const state = read(key) || { attempts: [], blockedUntil: 0 }

  if (state.blockedUntil && t < state.blockedUntil) {
    return { allowed: false, retryAfterMs: state.blockedUntil - t }
  }

  const attempts = (state.attempts || []).filter((x) => t - x < windowMs)
  if (attempts.length >= limit) {
    const blockedUntil = t + blockMs
    write(key, { attempts, blockedUntil })
    return { allowed: false, retryAfterMs: blockMs }
  }

  attempts.push(t)
  write(key, { attempts, blockedUntil: 0 })
  return { allowed: true, retryAfterMs: 0 }
}

export function formatRetryAfter(ms) {
  const s = Math.max(1, Math.ceil(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.ceil(s / 60)
  return `${m}m`
}