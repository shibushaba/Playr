import { AppError } from '@/lib/errors'
import {
  canCreateGroup,
  canHostGame,
  canJoinGame,
  getProfileCompletion,
} from '@/lib/profileCompletion'
import type { Tables } from '@/types/database'
import type { User } from '@supabase/supabase-js'

/** Client-side UX guards — server/RPC is the security boundary. */

export function requireAuth(user: User | null): asserts user is User {
  if (!user) {
    throw new AppError('Please sign in to continue.', 'UNAUTHENTICATED')
  }
}

export function requireJoinProfile(
  profile: Tables<'profiles'> | null,
  user: User | null,
): void {
  requireAuth(user)
  if (!canJoinGame(profile, user)) {
    const c = getProfileCompletion(profile, user)
    throw new AppError(c.message, 'PROFILE_INCOMPLETE')
  }
}

export function requireHostProfile(
  profile: Tables<'profiles'> | null,
  user: User | null,
): void {
  requireAuth(user)
  if (!canHostGame(profile, user)) {
    const c = getProfileCompletion(profile, user)
    if (c.status === 'email_required') {
      throw new AppError(
        'Confirm your email before hosting.',
        'EMAIL_VERIFICATION_REQUIRED',
      )
    }
    throw new AppError(c.message, 'PROFILE_INCOMPLETE')
  }
}

export function requireGroupHostProfile(
  profile: Tables<'profiles'> | null,
  user: User | null,
): void {
  requireAuth(user)
  if (!canCreateGroup(profile, user)) {
    const c = getProfileCompletion(profile, user)
    throw new AppError(c.message, 'PROFILE_INCOMPLETE')
  }
}
