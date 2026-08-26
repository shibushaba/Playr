import { AppError, logDevError, parsePlayrRpcError } from '@/lib/errors'
import { normalizePhoneE164 } from '@/lib/phone'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'
import type { PublicProfile } from '@/types/domain'
import { toPublicProfile } from '@/types/domain'

const AVATAR_MAX_PX = 512
const AVATAR_JPEG_QUALITY = 0.86
const AVATAR_INPUT_MAX_BYTES = 8 * 1024 * 1024

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
  username?: string | null
  phone?: string | null
  bio?: string | null
  avatarUrl?: string | null
}): Promise<Tables<'profiles'>> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new AppError('Please sign in.')

  let phone: string | null | undefined = input.phone
  if (typeof phone === 'string' && phone.trim()) {
    const e164 = normalizePhoneE164(phone)
    if (!e164) throw new AppError('Enter a valid phone number.', 'INVALID_PHONE')
    phone = e164
  } else if (phone === '' || phone === null) {
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
  if (input.displayName !== undefined) args.p_display_name = input.displayName
  if (input.username !== undefined) args.p_username = input.username
  if (input.bio !== undefined) args.p_bio = input.bio
  if (phone) args.p_phone = phone
  if (phone === null) args.p_clear_phone = true
  if (input.avatarUrl) args.p_avatar_url = input.avatarUrl
  if (input.avatarUrl === null) args.p_clear_avatar = true

  const { data, error } = await supabase.rpc('update_my_profile', args)

  if (!error && data) return data

  if (error) {
    const parsed = parsePlayrRpcError(error, "Couldn't update profile. Try again.")
    if (parsed.code !== 'app_error') throw parsed
    logDevError('updateMyProfile rpc', error)
  }

  return updateMyProfileDirect(user.id, {
    displayName: input.displayName,
    username: input.username,
    phone,
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
  if (input.phone !== undefined) patch.phone = input.phone
  if (input.bio !== undefined) patch.bio = input.bio?.trim() ? input.bio.trim() : null
  if (input.avatarUrl !== undefined) patch.avatar_url = input.avatarUrl

  const { error } = await supabase.from('profiles').update(patch).eq('id', userId)

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

  const full = await getMyProfile()
  if (!full) throw new AppError("Couldn't load your profile. Try again.")
  return full
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
