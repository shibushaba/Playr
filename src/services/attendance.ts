import { AppError, logDevError, parsePlayrRpcError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import type { AttendanceFeedbackStatus, Tables } from '@/types/database'

export async function hostMarkAttendance(
  gameId: string,
  userId: string,
  status: AttendanceFeedbackStatus,
  notes?: string,
): Promise<Tables<'game_attendance_feedback'>> {
  const { data, error } = await supabase.rpc('host_mark_attendance', {
    p_game_id: gameId,
    p_user_id: userId,
    p_status: status,
    p_notes: notes ?? null,
  })
  if (error) {
    logDevError('hostMarkAttendance', error)
    throw parsePlayrRpcError(error, "Couldn't update attendance.")
  }
  return data
}

export async function disputeAttendance(
  gameId: string,
  reason: string,
  description?: string,
): Promise<Tables<'reports'>> {
  const { data, error } = await supabase.rpc('dispute_attendance', {
    p_game_id: gameId,
    p_reason: reason,
    p_description: description ?? null,
  })
  if (error) {
    logDevError('disputeAttendance', error)
    throw parsePlayrRpcError(error, "Couldn't submit dispute.")
  }
  return data
}

export async function listAttendanceFeedback(
  gameId: string,
): Promise<Tables<'game_attendance_feedback'>[]> {
  const { data, error } = await supabase
    .from('game_attendance_feedback')
    .select('*')
    .eq('game_id', gameId)

  if (error) {
    logDevError('listAttendanceFeedback', error)
    throw new AppError("Couldn't load attendance.")
  }
  return data ?? []
}
