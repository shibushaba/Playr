import { AppError, logDevError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import type { SportRecord } from '@/types/domain'

export async function listSports(): Promise<SportRecord[]> {
  const { data, error } = await supabase
    .from('sports')
    .select('id, name, slug, icon')
    .eq('is_active', true)
    .order('name')

  if (error) {
    logDevError('listSports', error)
    throw new AppError("Couldn't load sports. Try again.")
  }

  return (data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    icon: s.icon,
  }))
}
