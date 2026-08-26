import { AppError, logDevError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

export interface PlayerReliability {
  userId: string
  label: string
  gamesJoined: number
  attended: number
  noShows: number
  lateCancellations: number
  attendanceRate: number | null
  gamesHosted: number
  hostedCompleted: number
  hostedCancelled: number
  completionRate: number | null
}

export async function getPlayerReliability(
  userId: string,
): Promise<PlayerReliability | null> {
  const { data, error } = await supabase.rpc('get_player_reliability', {
    p_user_id: userId,
  })
  if (error) {
    logDevError('getPlayerReliability', error)
    throw new AppError("Couldn't load reliability stats.")
  }
  if (!data || typeof data !== 'object') return null

  const raw = data as Record<string, unknown>
  return {
    userId: String(raw.user_id ?? userId),
    label: String(raw.label ?? 'New player'),
    gamesJoined: Number(raw.games_joined ?? 0),
    attended: Number(raw.attended ?? 0),
    noShows: Number(raw.no_shows ?? 0),
    lateCancellations: Number(raw.late_cancellations ?? 0),
    attendanceRate:
      raw.attendance_rate == null ? null : Number(raw.attendance_rate),
    gamesHosted: Number(raw.games_hosted ?? 0),
    hostedCompleted: Number(raw.hosted_completed ?? 0),
    hostedCancelled: Number(raw.hosted_cancelled ?? 0),
    completionRate:
      raw.completion_rate == null ? null : Number(raw.completion_rate),
  }
}
