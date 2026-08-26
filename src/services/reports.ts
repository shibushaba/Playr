import { AppError, logDevError, parsePlayrRpcError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'

export const REPORT_REASONS = [
  'harassment',
  'inappropriate behavior',
  'fake game',
  'fake venue',
  'spam',
  'unsafe behavior',
  'other',
] as const

export type ReportReason = (typeof REPORT_REASONS)[number]

export async function createReport(input: {
  reason: string
  description?: string
  reportedUserId?: string | null
  gameId?: string | null
  venueId?: string | null
  messageId?: string | null
}): Promise<Tables<'reports'>> {
  const { data, error } = await supabase.rpc('create_report', {
    p_reason: input.reason,
    p_description: input.description ?? null,
    p_reported_user_id: input.reportedUserId ?? null,
    p_game_id: input.gameId ?? null,
    p_venue_id: input.venueId ?? null,
    p_message_id: input.messageId ?? null,
  })
  if (error) {
    logDevError('createReport', error)
    throw parsePlayrRpcError(error, "Couldn't submit report.")
  }
  return data
}

export async function blockUser(blockedUserId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new AppError('Please sign in.')

  const { error } = await supabase.from('user_blocks').insert({
    blocker_id: user.id,
    blocked_user_id: blockedUserId,
  })

  if (error) {
    if (error.code === '23505') return
    logDevError('blockUser', error)
    throw new AppError("Couldn't block this user.")
  }
}

export async function unblockUser(blockedUserId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new AppError('Please sign in.')

  const { error } = await supabase
    .from('user_blocks')
    .delete()
    .eq('blocker_id', user.id)
    .eq('blocked_user_id', blockedUserId)

  if (error) {
    logDevError('unblockUser', error)
    throw new AppError("Couldn't unblock this user.")
  }
}

export async function listBlockedUserIds(): Promise<string[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('user_blocks')
    .select('blocked_user_id')
    .eq('blocker_id', user.id)

  if (error) {
    logDevError('listBlockedUserIds', error)
    return []
  }
  return (data ?? []).map((r) => r.blocked_user_id)
}
