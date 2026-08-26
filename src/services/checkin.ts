import { AppError, logDevError, parsePlayrRpcError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import type { CheckInMethod, Tables } from '@/types/database'

export interface CheckInWindow {
  kickoffAt: string | null
  opensAt: string | null
  closesAt: string | null
  hostClosesAt: string | null
  now: string | null
  playerWindowOpen: boolean
  hostWindowOpen: boolean
  tooEarly: boolean
  tooLate: boolean
}

export interface GameCheckIn {
  userId: string
  checkedInAt: string
  method: CheckInMethod
  checkedInBy: string | null
}

function mapWindow(raw: Record<string, unknown> | null): CheckInWindow {
  return {
    kickoffAt: (raw?.kickoff_at as string) ?? null,
    opensAt: (raw?.opens_at as string) ?? null,
    closesAt: (raw?.closes_at as string) ?? null,
    hostClosesAt: (raw?.host_closes_at as string) ?? null,
    now: (raw?.now as string) ?? null,
    playerWindowOpen: Boolean(raw?.player_window_open),
    hostWindowOpen: Boolean(raw?.host_window_open),
    tooEarly: Boolean(raw?.too_early),
    tooLate: Boolean(raw?.too_late),
  }
}

export async function getCheckInWindow(gameId: string): Promise<CheckInWindow> {
  const { data, error } = await supabase.rpc('get_check_in_window', {
    p_game_id: gameId,
  })
  if (error) {
    logDevError('getCheckInWindow', error)
    throw new AppError("Couldn't load check-in window.")
  }
  return mapWindow((data ?? null) as Record<string, unknown> | null)
}

export async function listGameCheckIns(gameId: string): Promise<GameCheckIn[]> {
  const { data, error } = await supabase.rpc('list_game_check_ins', {
    p_game_id: gameId,
  })
  if (error) {
    logDevError('listGameCheckIns', error)
    throw new AppError("Couldn't load check-ins.")
  }
  return ((data ?? []) as Array<{
    user_id: string
    checked_in_at: string
    method: CheckInMethod
    checked_in_by: string | null
  }>).map((r) => ({
    userId: r.user_id,
    checkedInAt: r.checked_in_at,
    method: r.method,
    checkedInBy: r.checked_in_by,
  }))
}

export async function checkInWithLocation(
  gameId: string,
  latitude: number,
  longitude: number,
): Promise<Tables<'check_ins'>> {
  const { data, error } = await supabase.rpc('check_in_with_location', {
    p_game_id: gameId,
    p_latitude: latitude,
    p_longitude: longitude,
    p_radius_meters: 250,
  })
  if (error) {
    logDevError('checkInWithLocation', error)
    throw parsePlayrRpcError(error, "Couldn't check in. Try again.")
  }
  return data
}

export async function hostManualCheckIn(
  gameId: string,
  userId: string,
): Promise<Tables<'check_ins'>> {
  const { data, error } = await supabase.rpc('host_manual_check_in', {
    p_game_id: gameId,
    p_user_id: userId,
  })
  if (error) {
    logDevError('hostManualCheckIn', error)
    throw parsePlayrRpcError(error, "Couldn't check in this player.")
  }
  return data
}

export function requestBrowserPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new AppError('Location unavailable.'))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, () => {
      reject(new AppError("Couldn't verify your location."))
    }, {
      enableHighAccuracy: false,
      timeout: 12_000,
      maximumAge: 60_000,
    })
  })
}
