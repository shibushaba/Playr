import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
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
