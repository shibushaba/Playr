import { AppError, logDevError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'
import type { PublicProfile } from '@/types/domain'
import { toPublicProfile } from '@/types/domain'

export async function getMyProfile(): Promise<Tables<'profiles'> | null> {
  const { data, error } = await supabase.rpc('get_my_profile')
  if (error) {
    logDevError('getMyProfile', error)
    throw new AppError("Couldn't load your profile. Try again.")
  }
  return data
}

export async function getPublicProfile(userId: string): Promise<PublicProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, username, avatar_url, bio')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    logDevError('getPublicProfile', error)
    throw new AppError("Couldn't load profile. Try again.")
  }
  if (!data) return null
  return toPublicProfile(data)
}

export async function updateMyProfile(input: {
  displayName?: string
  username?: string
  phone?: string
  bio?: string
}): Promise<Tables<'profiles'>> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new AppError('Please sign in.')

  const { data, error } = await supabase
    .from('profiles')
    .update({
      display_name: input.displayName,
      username: input.username,
      phone: input.phone,
      bio: input.bio,
    })
    .eq('id', user.id)
    .select('id, display_name, username, avatar_url, bio, home_latitude, home_longitude, is_active, created_at, updated_at')
    .single()

  if (error) {
    logDevError('updateMyProfile', error)
    throw new AppError("Couldn't update profile. Try again.")
  }

  // phone won't return due to column grants — refetch via RPC
  const full = await getMyProfile()
  return full ?? {
    ...data,
    phone: input.phone ?? null,
  }
}

export async function ensureProfileAfterSignup(input: {
  displayName: string
  username?: string
}): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const { error } = await supabase.from('profiles').upsert({
    id: user.id,
    display_name: input.displayName,
    username: input.username || null,
  })

  if (error) {
    logDevError('ensureProfileAfterSignup', error)
  }
}
