import { AppError, logDevError, parsePlayrRpcError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'

export interface PhoneVerificationStart {
  challengeId: string
  phone: string
  expiresAt: string
  devCode?: string | null
}

export async function requestPhoneVerification(
  phone: string,
): Promise<PhoneVerificationStart> {
  const { data, error } = await supabase.rpc('request_phone_verification', {
    p_phone: phone,
  })

  if (error) {
    throw parsePlayrRpcError(error, "Couldn't send verification code.")
  }

  const row = data as {
    challenge_id?: string
    phone?: string
    expires_at?: string
    dev_code?: string | null
  } | null

  if (!row?.challenge_id || !row.phone) {
    throw new AppError("Couldn't start phone verification.")
  }

  return {
    challengeId: row.challenge_id,
    phone: row.phone,
    expiresAt: row.expires_at ?? '',
    devCode: row.dev_code ?? null,
  }
}

export async function confirmPhoneVerification(
  code: string,
  challengeId?: string,
): Promise<Tables<'profiles'>> {
  const { data, error } = await supabase.rpc('confirm_phone_verification', {
    p_code: code,
    p_challenge_id: challengeId ?? undefined,
  })

  if (error) {
    throw parsePlayrRpcError(error, "Couldn't verify that code.")
  }

  if (!data) {
    throw new AppError("Couldn't verify that code.")
  }

  return data as Tables<'profiles'>
}

export async function getVenueContactPhone(venueId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_venue_contact_phone', {
    p_venue_id: venueId,
  })

  if (error) {
    logDevError('getVenueContactPhone', error)
    return null
  }

  return typeof data === 'string' ? data : null
}

export async function confirmGameVenueBooking(
  gameId: string,
): Promise<Tables<'games'>> {
  const { data, error } = await supabase.rpc('confirm_game_venue_booking', {
    p_game_id: gameId,
  })

  if (error) {
    throw parsePlayrRpcError(error, "Couldn't confirm venue booking.")
  }

  if (!data) throw new AppError("Couldn't confirm venue booking.")
  return data as Tables<'games'>
}

export async function publishGame(gameId: string): Promise<Tables<'games'>> {
  const { data, error } = await supabase.rpc('publish_game', { p_game_id: gameId })

  if (error) {
    throw parsePlayrRpcError(error, "Couldn't publish game.")
  }

  if (!data) throw new AppError("Couldn't publish game.")
  return data as Tables<'games'>
}

export async function resendEmailVerification(): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) throw new AppError('No email on your account.')

  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: user.email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth`,
    },
  })

  if (error) {
    throw new AppError("Couldn't resend confirmation email. Try again.")
  }
}
