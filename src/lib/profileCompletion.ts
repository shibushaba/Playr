import type { Tables } from '@/types/database'
import type { User } from '@supabase/supabase-js'
import { isValidE164 } from '@/lib/phone'

export type ProfileCompletionStatus =
  | 'complete'
  | 'incomplete'
  | 'phone_required'
  | 'email_required'

export interface ProfileCompletionResult {
  status: ProfileCompletionStatus
  missing: string[]
  message: string
  actionLabel: string
}

function hasDisplayName(profile: Tables<'profiles'> | null): boolean {
  return Boolean(profile?.display_name?.trim())
}

function hasPhone(profile: Tables<'profiles'> | null): boolean {
  return isValidE164(profile?.phone)
}

export function hasVerifiedEmail(
  profile: Tables<'profiles'> | null,
  user: User | null,
): boolean {
  if (profile?.email_verified_at) return true
  if (user?.email_confirmed_at) return true
  return false
}

export function getProfileCompletion(
  profile: Tables<'profiles'> | null,
  user: User | null,
): ProfileCompletionResult {
  const missing: string[] = []

  if (!hasDisplayName(profile)) missing.push('display_name')
  if (!hasPhone(profile)) missing.push('phone')
  if (!hasVerifiedEmail(profile, user)) missing.push('email_verified')

  if (missing.length === 0) {
    return {
      status: 'complete',
      missing: [],
      message: 'Your profile is ready.',
      actionLabel: 'Continue',
    }
  }

  if (!hasDisplayName(profile)) {
    return {
      status: 'incomplete',
      missing,
      message: 'Add your display name in your profile to continue.',
      actionLabel: 'Edit profile',
    }
  }

  if (!hasPhone(profile)) {
    return {
      status: 'phone_required',
      missing,
      message: 'Add your phone number so hosts and players can reach you.',
      actionLabel: 'Edit profile',
    }
  }

  if (!hasVerifiedEmail(profile, user)) {
    return {
      status: 'email_required',
      missing,
      message: 'Confirm your email before hosting a game.',
      actionLabel: 'Verify email',
    }
  }

  return {
    status: 'incomplete',
    missing,
    message: 'Complete your profile to continue.',
    actionLabel: 'Edit profile',
  }
}

export function canJoinGame(
  profile: Tables<'profiles'> | null,
  _user: User | null,
): boolean {
  return hasDisplayName(profile) && hasPhone(profile)
}

export function canHostGame(
  profile: Tables<'profiles'> | null,
  user: User | null,
): boolean {
  return hasDisplayName(profile) && hasPhone(profile) && hasVerifiedEmail(profile, user)
}

export function canCreateGroup(
  profile: Tables<'profiles'> | null,
  _user: User | null,
): boolean {
  return hasDisplayName(profile) && hasPhone(profile)
}
