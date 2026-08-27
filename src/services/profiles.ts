import { AppError, logDevError, parsePlayrRpcError } from '@/lib/errors'
import { normalizePhoneE164 } from '@/lib/phone'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'
import type { PublicProfile } from '@/types/domain'
import { toPublicProfile } from '@/types/domain'
import type { User } from '@supabase/supabase-js'

const AVATAR_MAX_PX = 512
const AVATAR_JPEG_QUALITY = 0.86
const AVATAR_INPUT_MAX_BYTES = 8 * 1024 * 1024

/** Columns readable without the get_my_profile RPC (phone + home_* excluded by grants). */
const PROFILE_FALLBACK_SELECT =
  'id, display_name, username, avatar_url, bio, is_active, created_at, updated_at'

function buildProfileRow(
  base: Partial<Tables<'profiles'>> & { id: string },
  user: User,
): Tables<'profiles'> {
  const now = new Date().toISOString()
  return {
    id: base.id,
    display_name: base.display_name ?? null,
    username: base.username ?? null,
    avatar_url: base.avatar_url ?? null,
    bio: base.bio ?? null,
    phone: base.phone ?? null,
    phone_verified_at: base.phone_verified_at ?? null,
    email_verified_at: base.email_verified_at ?? user.email_confirmed_at ?? null,
    home_latitude: base.home_latitude ?? null,
    home_longitude: base.home_longitude ?? null,
    is_active: base.is_active ?? true,
    created_at: base.created_at ?? now,
    updated_at: base.updated_at ?? now,
  }
}

async function fetchMyProfileFallback(user: User): Promise<Tables<'profiles'> | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_FALLBACK_SELECT)
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    logDevError('getMyProfile fallback', error)
    return null
  }
  if (!data) return null
  return buildProfileRow(data, user)
}

export async function getMyProfile(): Promise<Tables<'profiles'> | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase.rpc('get_my_profile')
  if (!error && data) return data
  if (error) logDevError('getMyProfile', error)

  const fallback = await fetchMyProfileFallback(user)
  if (!fallback) return null

  const metaPhone =
    typeof user.user_metadata?.phone === 'string'
      ? normalizePhoneE164(user.user_metadata.phone)
      : null
  if (metaPhone && !fallback.phone) {
    return { ...fallback, phone: metaPhone }
  }
  return fallback
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

/** Create the profile row when missing (e.g. auth trigger failed). */
export async function ensureMyProfile(): Promise<Tables<'profiles'>> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new AppError('Please sign in.')

  const existing = await getMyProfile()
  if (existing) return existing

  const { data: rpcProfile, error: rpcError } = await supabase.rpc('ensure_my_profile')
  if (!rpcError && rpcProfile) return rpcProfile
  if (rpcError) logDevError('ensureMyProfile rpc', rpcError)

  const meta = user.user_metadata ?? {}
  const displayName =
    (typeof meta.display_name === 'string' && meta.display_name.trim()) ||
    (typeof meta.full_name === 'string' && meta.full_name.trim()) ||
    null

  const { error: insertError } = await supabase.from('profiles').insert({
    id: user.id,
    display_name: displayName,
    is_active: true,
  })

  if (insertError && insertError.code !== '23505') {
    logDevError('ensureMyProfile insert', insertError)
    throw new AppError("Couldn't set up your profile. Try again.")
  }

  const profile = await getMyProfile()
  if (profile) return profile

  return buildProfileRow({ id: user.id, display_name: displayName }, user)
}

export async function updateMyProfile(input: {
  displayName?: string
  username?: string | null
  /** undefined = leave unchanged, null = clear, string = set */
  phone?: string | null
  /** Pass empty string to clear bio; undefined to leave unchanged. */
  bio?: string | null
  avatarUrl?: string | null
}): Promise<Tables<'profiles'>> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new AppError('Please sign in.')

  await ensureMyProfile()

  let phone: string | null | undefined = input.phone
  if (phone === undefined) {
    // Leave phone unchanged — do not send clear/set flags.
  } else if (typeof phone === 'string' && phone.trim()) {
    const e164 = normalizePhoneE164(phone)
    if (!e164) throw new AppError('Enter a valid phone number.', 'INVALID_PHONE')
    phone = e164
  } else {
    phone = null
  }

  const args: {
    p_display_name?: string | null
    p_username?: string | null
    p_bio?: string | null
    p_phone?: string | null
    p_avatar_url?: string | null
    p_clear_phone?: boolean
    p_clear_avatar?: boolean
  } = {}

  if (input.displayName !== undefined) {
    args.p_display_name = input.displayName
  }
  if (input.username !== undefined) {
    // Empty string clears username; null would be indistinguishable from "omit" in SQL.
    args.p_username = input.username ?? ''
  }
  if (input.bio !== undefined) {
    // Empty string clears bio; null would be indistinguishable from "omit" in SQL.
    args.p_bio = input.bio ?? ''
  }
  if (phone) {
    args.p_phone = phone
  } else if (phone === null) {
    args.p_clear_phone = true
  }
  if (input.avatarUrl) {
    args.p_avatar_url = input.avatarUrl
  } else if (input.avatarUrl === null) {
    args.p_clear_avatar = true
  }

  const { data, error } = await supabase.rpc('update_my_profile', args)

  if (!error && data) return data

  if (error) {
    const parsed = parsePlayrRpcError(error, "Couldn't update profile. Try again.")
    if (parsed.code !== 'app_error' && parsed.code !== 'NOT_FOUND') throw parsed
    logDevError('updateMyProfile rpc', error)
  }

  return updateMyProfileDirect(user.id, {
    displayName: input.displayName,
    username: input.username,
    phone: input.phone,
    bio: input.bio,
    avatarUrl: input.avatarUrl,
  })
}

async function updateMyProfileDirect(
  userId: string,
  input: {
    displayName?: string
    username?: string | null
    phone?: string | null
    bio?: string | null
    avatarUrl?: string | null
  },
): Promise<Tables<'profiles'>> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new AppError('Please sign in.')

  const before = await ensureMyProfile()

  const patch: {
    display_name?: string | null
    username?: string | null
    phone?: string | null
    bio?: string | null
    avatar_url?: string | null
  } = {}

  if (input.displayName !== undefined) {
    patch.display_name = input.displayName.trim() || null
  }
  if (input.username !== undefined) {
    const raw = input.username?.trim().replace(/^@/, '').toLowerCase() || null
    patch.username = raw
  }
  if (input.bio !== undefined) {
    patch.bio = input.bio?.trim() ? input.bio.trim() : null
  }
  if (input.avatarUrl !== undefined) {
    patch.avatar_url = input.avatarUrl
  }

  let phone: string | null | undefined = input.phone
  if (phone === undefined) {
    // unchanged
  } else if (typeof phone === 'string' && phone.trim()) {
    const e164 = normalizePhoneE164(phone)
    if (!e164) throw new AppError('Enter a valid phone number.', 'INVALID_PHONE')
    patch.phone = e164
  } else if (phone === null) {
    patch.phone = null
  }

  if (Object.keys(patch).length === 0) return before

  let { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select('id')
    .maybeSingle()

  if (!error && !data) {
    await ensureMyProfile()
    ;({ data, error } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', userId)
      .select('id')
      .maybeSingle())
  }

  if (error) {
    logDevError('updateMyProfile', error)
    const raw = error.message.toLowerCase()
    if (raw.includes('username') && (raw.includes('unique') || raw.includes('duplicate') || error.code === '23505')) {
      throw new AppError('That username is taken.', 'USERNAME_TAKEN')
    }
    if (raw.includes('username') || raw.includes('profiles_username_format')) {
      throw new AppError(
        'Username must be 3–30 letters, numbers, or underscores.',
        'INVALID_USERNAME',
      )
    }
    throw new AppError("Couldn't update profile. Try again.")
  }

  if (!data) {
    throw new AppError("Couldn't update profile. Try again.")
  }

  const reloaded = await getMyProfile()
  if (reloaded) {
    if (patch.phone && !reloaded.phone) {
      return { ...reloaded, phone: patch.phone }
    }
    return reloaded
  }

  return buildProfileRow(
    {
      ...before,
      ...patch,
      updated_at: new Date().toISOString(),
    },
    user,
  )
}

export async function uploadMyAvatar(file: File): Promise<Tables<'profiles'>> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new AppError('Please sign in.')

  if (!file.type.startsWith('image/')) {
    throw new AppError('Choose a photo (JPEG, PNG, or WebP).')
  }
  if (file.size > AVATAR_INPUT_MAX_BYTES) {
    throw new AppError('That photo is too large. Try one under 8 MB.')
  }

  const blob = await resizeAvatar(file)
  const path = `${user.id}/avatar.jpg`

  const { error: uploadError } = await supabase.storage.from('avatars').upload(path, blob, {
    upsert: true,
    contentType: 'image/jpeg',
    cacheControl: '3600',
  })

  if (uploadError) {
    logDevError('uploadMyAvatar', uploadError)
    throw new AppError("Couldn't upload that photo. Try again.")
  }

  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  const avatarUrl = `${data.publicUrl}?t=${Date.now()}`
  return updateMyProfile({ avatarUrl })
}

export async function removeMyAvatar(): Promise<Tables<'profiles'>> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new AppError('Please sign in.')

  await supabase.storage.from('avatars').remove([`${user.id}/avatar.jpg`])
  return updateMyProfile({ avatarUrl: null })
}

export async function ensureProfileAfterSignup(input: {
  displayName: string
  phone: string
  username?: string
}): Promise<Tables<'profiles'>> {
  const phone = normalizePhoneE164(input.phone)
  if (!phone) throw new AppError('Enter a valid phone number.', 'INVALID_PHONE')

  await ensureMyProfile()
  return updateMyProfile({
    displayName: input.displayName.trim(),
    phone,
    username: input.username,
  })
}

async function resizeAvatar(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(AVATAR_MAX_PX / bitmap.width, AVATAR_MAX_PX / bitmap.height, 1)
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new AppError("Couldn't process that photo.")
  }
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', AVATAR_JPEG_QUALITY)
  })
  if (!blob) throw new AppError("Couldn't process that photo.")
  return blob
}
