import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as
  | string
  | undefined

export const isSupabaseConfigured = Boolean(url && publishableKey)

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
