import type { AuthError } from '@supabase/supabase-js'

/** Map Supabase auth errors to clear user-facing messages. */
export function authErrorMessage(
  error: AuthError | Error,
  fallback: string,
): string {
  const msg = (error.message || '').toLowerCase()
  const code = ('code' in error ? error.code : undefined)?.toLowerCase() ?? ''

  if (
    msg.includes('invalid login') ||
    msg.includes('invalid credentials') ||
    code === 'invalid_credentials'
  ) {
    return 'Invalid email or password.'
  }

  if (
    msg.includes('email not confirmed') ||
    msg.includes('not confirmed') ||
    code === 'email_not_confirmed'
  ) {
    return 'Confirm your email before signing in — check your inbox for the link from PLAYR.'
  }

  if (
    msg.includes('already registered') ||
    msg.includes('already been registered') ||
    code.includes('user_already_exists')
  ) {
    return 'An account with that email already exists. Sign in instead.'
  }

  if (
    msg.includes('rate limit') ||
    msg.includes('too many') ||
    code.includes('over_email_send_rate_limit') ||
    code.includes('over_request_rate_limit')
  ) {
    return 'Too many attempts. Wait a minute and try again.'
  }

  if (
    msg.includes('invalid api key') ||
    msg.includes('apikey') ||
    code === '401'
  ) {
    return 'App configuration error (invalid Supabase key). Contact the host or try again later.'
  }

  if (
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('fetch')
  ) {
    return "Couldn't reach the server. Check your connection and try again."
  }

  if (
    msg.includes('password') &&
    (msg.includes('least') || msg.includes('weak') || msg.includes('short'))
  ) {
    return 'Use a stronger password (at least 6 characters).'
  }

  if (
    msg.includes('unable to validate email') ||
    msg.includes('invalid email') ||
    code.includes('email_address_invalid')
  ) {
    return 'Enter a valid email address.'
  }

  if (msg.includes('signup is disabled') || msg.includes('signups not allowed')) {
    return 'New sign-ups are disabled on this server.'
  }

  // Surface short, safe Supabase messages in production for debugging pilot issues
  if (error.message && error.message.length < 120 && !msg.includes('internal')) {
    return error.message
  }

  return fallback
}
