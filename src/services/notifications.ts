import { AppError, logDevError, parsePlayrRpcError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'
import type { NotificationItem } from '@/types/domain'

function mapNotification(row: Tables<'notifications'>): NotificationItem {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    gameId: row.game_id,
    groupId: row.group_id,
    actorId: row.actor_id,
    readAt: row.read_at,
    createdAt: row.created_at,
  }
}

export async function listNotifications(
  limit = 30,
): Promise<NotificationItem[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new AppError('Please sign in to view notifications.')

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    logDevError('listNotifications', error)
    throw new AppError("Couldn't load notifications. Try again.")
  }

  return (data ?? []).map(mapNotification)
}

export async function countUnread(): Promise<number> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return 0

  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('read_at', null)

  if (error) {
    logDevError('countUnread', error)
    return 0
  }
  return count ?? 0
}

export async function markRead(ids?: string[]): Promise<number> {
  const { data, error } = await supabase.rpc('mark_notifications_read', {
    p_ids: ids ?? null,
  })
  if (error) {
    logDevError('markRead', error)
    throw parsePlayrRpcError(error, "Couldn't mark notifications read.")
  }
  return data ?? 0
}

export async function markAllRead(): Promise<number> {
  return markRead()
}
