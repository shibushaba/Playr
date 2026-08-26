import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/** Strip trailing slashes and accidental `/rest/v1` (common Vercel misconfiguration). */
function normalizeSupabaseUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  let u = raw.trim().replace(/\/+$/, '')
  if (/\/rest\/v1$/i.test(u)) {
    u = u.replace(/\/rest\/v1$/i, '')
    if (import.meta.env.DEV) {
      console.warn(
        '[PLAYR] VITE_SUPABASE_URL should be the project root (https://xxx.supabase.co), not /rest/v1 — auto-corrected.',
      )
    }
  }
  return u
}

const url = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL as string | undefined)
const publishableKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY
)?.trim() as string | undefined

const PLACEHOLDER_URLS = ['example.supabase.co', 'YOUR_PROJECT']
const PLACEHOLDER_KEYS = ['public-anon-key', 'your_publishable', 'your_anon']

function looksLikePlaceholder(value: string | undefined, markers: string[]): boolean {
  if (!value) return true
  const lower = value.toLowerCase()
  return markers.some((m) => lower.includes(m.toLowerCase()))
}

export const isSupabaseConfigured = Boolean(
  url &&
    publishableKey &&
    !looksLikePlaceholder(url, PLACEHOLDER_URLS) &&
    !looksLikePlaceholder(publishableKey, PLACEHOLDER_KEYS),
)

if (!isSupabaseConfigured) {
  const msg =
    '[PLAYR] Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Set them in .env.local (dev) or Vercel Environment Variables (production).'
  if (import.meta.env.DEV) {
    console.error(msg)
  } else {
    console.warn(msg)
  }
}

/**
 * Browser client using the publishable (anon) key only.
 * Never put the service-role / secret key in the frontend.
 */
export const supabase: SupabaseClient<Database> = createClient<Database>(
  url || 'https://example.supabase.co',
  publishableKey || 'public-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)

export function assertSupabaseConfigured(): void {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env.local.',
    )
  }
}
