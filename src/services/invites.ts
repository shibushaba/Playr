import { logDevError, parsePlayrRpcError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import type { Json, Tables } from '@/types/database'

export interface GameInviteCreated {
  id: string
  token: string
  shortCode: string | null
  expiresAt: string | null
  gameId: string
}

export interface GroupInviteCreated {
  id: string
  token: string
  shortCode: string | null
  expiresAt: string | null
  groupId: string
}

export interface InviteAcceptResult {
  accepted: boolean
  inviteId: string
  gameId?: string
  groupId?: string
  memberId?: string
}

function mapGameInvite(row: Tables<'game_invites'>): GameInviteCreated {
  return {
    id: row.id,
    token: row.invite_token,
    shortCode: row.short_code,
    expiresAt: row.expires_at,
    gameId: row.game_id,
  }
}

function mapGroupInvite(row: Tables<'group_invites'>): GroupInviteCreated {
  return {
    id: row.id,
    token: row.invite_token,
    shortCode: row.short_code,
    expiresAt: row.expires_at,
    groupId: row.group_id,
  }
}

export async function createGameInvite(input: {
  gameId: string
  invitedUserId?: string | null
  expiresInHours?: number
}): Promise<GameInviteCreated> {
  const { data, error } = await supabase.rpc('create_game_invite', {
    p_game_id: input.gameId,
    p_invited_user_id: input.invitedUserId ?? null,
    p_expires_in_hours: input.expiresInHours ?? 168,
  })
  if (error || !data) {
    logDevError('createGameInvite', error)
    throw parsePlayrRpcError(error, "Couldn't create invite. Try again.")
  }
  return mapGameInvite(data)
}

export async function createGroupInvite(input: {
  groupId: string
  invitedUserId?: string | null
  expiresInHours?: number
}): Promise<GroupInviteCreated> {
  const { data, error } = await supabase.rpc('create_group_invite', {
    p_group_id: input.groupId,
    p_invited_user_id: input.invitedUserId ?? null,
    p_expires_in_hours: input.expiresInHours ?? 168,
  })
  if (error || !data) {
    logDevError('createGroupInvite', error)
    throw parsePlayrRpcError(error, "Couldn't create invite. Try again.")
  }
  return mapGroupInvite(data)
}

export async function revokeGameInvite(
  inviteId: string,
): Promise<GameInviteCreated> {
  const { data, error } = await supabase.rpc('revoke_game_invite', {
    p_invite_id: inviteId,
  })
  if (error || !data) {
    logDevError('revokeGameInvite', error)
    throw parsePlayrRpcError(error, "Couldn't revoke invite. Try again.")
  }
  return mapGameInvite(data)
}

export async function revokeGroupInvite(
  inviteId: string,
): Promise<GroupInviteCreated> {
  const { data, error } = await supabase.rpc('revoke_group_invite', {
    p_invite_id: inviteId,
  })
  if (error || !data) {
    logDevError('revokeGroupInvite', error)
    throw parsePlayrRpcError(error, "Couldn't revoke invite. Try again.")
  }
  return mapGroupInvite(data)
}

export async function validateGameInvite(token: string): Promise<Json> {
  const { data, error } = await supabase.rpc('validate_game_invite', {
    p_token: token,
  })
  if (error) {
    logDevError('validateGameInvite', error)
    throw parsePlayrRpcError(error, 'That invite is not valid.')
  }
  return data
}

export async function validateGroupInvite(token: string): Promise<Json> {
  const { data, error } = await supabase.rpc('validate_group_invite', {
    p_token: token,
  })
  if (error) {
    logDevError('validateGroupInvite', error)
    throw parsePlayrRpcError(error, 'That invite is not valid.')
  }
  return data
}

function parseAcceptResult(data: Json): InviteAcceptResult {
  const raw = (data ?? {}) as Record<string, unknown>
  return {
    accepted: Boolean(raw.accepted),
    inviteId: typeof raw.invite_id === 'string' ? raw.invite_id : '',
    gameId: typeof raw.game_id === 'string' ? raw.game_id : undefined,
    groupId: typeof raw.group_id === 'string' ? raw.group_id : undefined,
    memberId: typeof raw.member_id === 'string' ? raw.member_id : undefined,
  }
}

export async function acceptGameInvite(
  token: string,
): Promise<InviteAcceptResult> {
  const { data, error } = await supabase.rpc('accept_game_invite', {
    p_token: token,
  })
  if (error) {
    logDevError('acceptGameInvite', error)
    throw parsePlayrRpcError(error, "Couldn't accept invite. Try again.")
  }
  return parseAcceptResult(data)
}

export async function acceptGroupInvite(
  token: string,
): Promise<InviteAcceptResult> {
  const { data, error } = await supabase.rpc('accept_group_invite', {
    p_token: token,
  })
  if (error) {
    logDevError('acceptGroupInvite', error)
    throw parsePlayrRpcError(error, "Couldn't accept invite. Try again.")
  }
  return parseAcceptResult(data)
}
