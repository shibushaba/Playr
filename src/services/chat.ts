import { AppError, logDevError, parsePlayrRpcError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'
import type { PublicProfile } from '@/types/domain'
import { toPublicProfile } from '@/types/domain'

export interface GameMessage {
  id: string
  gameId: string
  senderId: string
  message: string
  createdAt: string
  sender: PublicProfile
}

type MessageJoin = Tables<'game_messages'> & {
  profiles: Pick<
    Tables<'profiles'>,
    'id' | 'display_name' | 'username' | 'avatar_url' | 'bio'
  > | null
}

function mapMessage(row: MessageJoin): GameMessage {
  return {
    id: row.id,
    gameId: row.game_id,
    senderId: row.sender_id,
    message: row.message,
    createdAt: row.created_at,
    sender: toPublicProfile(row.profiles, 'Player'),
  }
}

export async function listGameMessages(
  gameId: string,
  limit = 80,
): Promise<GameMessage[]> {
  const { data, error } = await supabase
    .from('game_messages')
    .select(
      'id, game_id, sender_id, message, created_at, profiles!sender_id ( id, display_name, username, avatar_url, bio )',
    )
    .eq('game_id', gameId)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) {
    logDevError('listGameMessages', error)
    throw new AppError("Couldn't load chat. Try again.")
  }

  return ((data ?? []) as unknown as MessageJoin[]).map(mapMessage)
}

export async function sendGameMessage(
  gameId: string,
  text: string,
): Promise<GameMessage> {
  const trimmed = text.trim()
  if (!trimmed) throw new AppError('Message cannot be empty.')
  if (trimmed.length > 2000) throw new AppError('Message is too long.')

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new AppError('Please sign in to chat.')

  const { data, error } = await supabase
    .from('game_messages')
    .insert({
      game_id: gameId,
      sender_id: user.id,
      message: trimmed,
    })
    .select(
      'id, game_id, sender_id, message, created_at, profiles!sender_id ( id, display_name, username, avatar_url, bio )',
    )
    .single()

  if (error || !data) {
    logDevError('sendGameMessage', error)
    throw parsePlayrRpcError(error, "Couldn't send message. Try again.")
  }

  return mapMessage(data as unknown as MessageJoin)
}

export function subscribeGameMessages(
  gameId: string,
  onInsert: (message: GameMessage) => void,
): () => void {
  const channel = supabase
    .channel(`game-chat:${gameId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'game_messages',
        filter: `game_id=eq.${gameId}`,
      },
      (payload) => {
        const row = payload.new as Tables<'game_messages'>
        onInsert({
          id: row.id,
          gameId: row.game_id,
          senderId: row.sender_id,
          message: row.message,
          createdAt: row.created_at,
          sender: {
            id: row.sender_id,
            displayName: 'Player',
            username: null,
            avatarUrl: null,
            bio: null,
          },
        })
        // Refresh profile name in background
        void listGameMessages(gameId, 1).then(() => {
          /* noop — caller may reload */
        })
      },
    )
    .subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}
