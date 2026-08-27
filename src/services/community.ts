import { AppError, logDevError, parsePlayrRpcError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import type { Json } from '@/types/database'

export interface VenueEditChanges {
  name?: string
  address?: string
  city?: string
  state?: string
  phone?: string
  map_url?: string
  description?: string
  sports?: string[]
  latitude?: number
  longitude?: number
  opening_hours?: Record<string, unknown>
}

export interface GameFeedbackState {
  eligible: boolean
  submitted?: boolean
  reason?: string
  rating?: number
  comment?: string | null
  tags?: string[]
}

export interface VenueRatingSummary {
  review_count: number
  average_rating: number | null
  display: 'none' | 'insufficient' | 'rated'
}

export async function submitVenueEditRequest(input: {
  venueId: string
  proposedChanges: VenueEditChanges
  reason?: string
}): Promise<void> {
  const { error } = await supabase.rpc('submit_venue_edit_request', {
    p_venue_id: input.venueId,
    p_proposed_changes: input.proposedChanges as Json,
    p_reason: input.reason ?? null,
  })

  if (error) {
    logDevError('submitVenueEditRequest', error)
    throw parsePlayrRpcError(error, "Couldn't submit your edit.")
  }
}

export async function getGameFeedbackState(gameId: string): Promise<GameFeedbackState> {
  const { data, error } = await supabase.rpc('get_game_feedback_state', {
    p_game_id: gameId,
  })

  if (error) {
    logDevError('getGameFeedbackState', error)
    return { eligible: false, reason: 'error' }
  }

  return (data ?? { eligible: false }) as unknown as GameFeedbackState
}

export async function submitGameExperienceFeedback(input: {
  gameId: string
  rating: number
  comment?: string
  tags?: string[]
}): Promise<void> {
  if (input.rating < 1 || input.rating > 5) {
    throw new AppError('Choose a rating from 1 to 5 stars.')
  }

  const { error } = await supabase.rpc('submit_game_experience_feedback', {
    p_game_id: input.gameId,
    p_overall_rating: input.rating,
    p_comment: input.comment?.trim() || null,
    p_tags: input.tags ?? [],
  })

  if (error) {
    logDevError('submitGameExperienceFeedback', error)
    throw parsePlayrRpcError(error, "Couldn't submit feedback.")
  }
}

export async function getVenueRatingSummary(
  venueId: string,
): Promise<VenueRatingSummary> {
  const { data, error } = await supabase.rpc('get_venue_rating_summary', {
    p_venue_id: venueId,
  })

  if (error) {
    logDevError('getVenueRatingSummary', error)
    return { review_count: 0, average_rating: null, display: 'none' }
  }

  return (data ?? {
    review_count: 0,
    average_rating: null,
    display: 'none',
  }) as unknown as VenueRatingSummary
}
