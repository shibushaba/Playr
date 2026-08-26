/** Player occupancy derived from server confirmed count (excludes expired reservations). */

export type OccupancyState = 'available' | 'filling' | 'almost_full' | 'full'

export type SemanticTone = 'success' | 'warning' | 'warning-strong' | 'info' | 'danger' | 'neutral'

export interface OccupancyInfo {
  currentPlayers: number
  maximumPlayers: number
  percentage: number
  state: OccupancyState
  label: string
  spotsLeft: number
  spotsLeftHint: string | null
  tone: SemanticTone
}

export function getOccupancy(
  currentPlayers: number,
  maximumPlayers: number,
): OccupancyInfo {
  const maximum = Math.max(1, maximumPlayers)
  const current = Math.max(0, Math.min(currentPlayers, maximum))
  const percentage = Math.round((current / maximum) * 100)
  const spotsLeft = Math.max(0, maximum - current)

  if (percentage >= 100) {
    return {
      currentPlayers: current,
      maximumPlayers: maximum,
      percentage: 100,
      state: 'full',
      label: 'Full',
      spotsLeft: 0,
      spotsLeftHint: null,
      tone: 'info',
    }
  }

  if (percentage >= 81) {
    return {
      currentPlayers: current,
      maximumPlayers: maximum,
      percentage,
      state: 'almost_full',
      label: 'Almost full',
      spotsLeft,
      spotsLeftHint: spotsLeft === 1 ? 'Only 1 spot left' : null,
      tone: 'warning-strong',
    }
  }

  if (percentage >= 61) {
    return {
      currentPlayers: current,
      maximumPlayers: maximum,
      percentage,
      state: 'filling',
      label: 'Filling',
      spotsLeft,
      spotsLeftHint: null,
      tone: 'warning',
    }
  }

  return {
    currentPlayers: current,
    maximumPlayers: maximum,
    percentage,
    state: 'available',
    label: 'Available',
    spotsLeft,
    spotsLeftHint: null,
    tone: 'success',
  }
}

export function occupancyToneClass(tone: SemanticTone): string {
  switch (tone) {
    case 'success':
      return 'text-status-success'
    case 'warning':
      return 'text-status-warning'
    case 'warning-strong':
      return 'text-status-warning status-emphasis'
    case 'info':
      return 'text-status-info'
    case 'danger':
      return 'text-status-danger'
    default:
      return 'text-status-neutral'
  }
}

export function occupancyProgressClass(tone: SemanticTone): string {
  switch (tone) {
    case 'success':
      return 'bg-status-success'
    case 'warning':
      return 'bg-status-warning'
    case 'warning-strong':
      return 'bg-status-warning'
    case 'info':
      return 'bg-status-info'
    case 'danger':
      return 'bg-status-danger'
    default:
      return 'bg-white/40'
  }
}

export function occupancyGlowStyle(state: OccupancyState): Record<string, string> {
  const opacity = state === 'almost_full' ? 0.08 : state === 'full' ? 0.07 : 0.055
  const topOpacity = opacity * 0.75
  switch (state) {
    case 'available':
      return {
        background: [
          `radial-gradient(ellipse 120% 80% at 50% 0%, rgba(52,211,153,${topOpacity}), transparent 58%)`,
          `radial-gradient(circle at 72% 88%, rgba(52,211,153,${opacity}), transparent 62%)`,
        ].join(', '),
      }
    case 'filling':
    case 'almost_full':
      return {
        background: [
          `radial-gradient(ellipse 120% 80% at 50% 0%, rgba(245,184,61,${topOpacity}), transparent 58%)`,
          `radial-gradient(circle at 72% 88%, rgba(245,184,61,${opacity + 0.01}), transparent 62%)`,
        ].join(', '),
      }
    case 'full':
      return {
        background: [
          `radial-gradient(ellipse 120% 80% at 50% 0%, rgba(91,157,255,${topOpacity}), transparent 58%)`,
          `radial-gradient(circle at 72% 88%, rgba(91,157,255,${opacity}), transparent 62%)`,
        ].join(', '),
      }
    default:
      return { background: 'transparent' }
  }
}

/** @deprecated use occupancyGlowStyle */
export const featuredGlowStyle = occupancyGlowStyle

export function glowStateForGame(
  game: { status: string; dbStatus: string; confirmedCount: number; maxPlayers: number },
  useOccupancy: boolean,
  occupancy: OccupancyInfo,
): OccupancyState | null {
  if (useOccupancy) return occupancy.state
  if (game.status === 'full' || game.confirmedCount >= game.maxPlayers) return 'full'
  if (game.status === 'filling') {
    return occupancy.state === 'almost_full' ? 'almost_full' : 'filling'
  }
  if (game.status === 'open') return 'available'
  return null
}

/** Confirmation deadline urgency (neutral → amber). */
export type DeadlineUrgency = 'neutral' | 'subtle' | 'strong' | 'critical'

export function getDeadlineUrgency(deadlineIso: string): DeadlineUrgency {
  const ms = new Date(deadlineIso).getTime() - Date.now()
  if (ms <= 0) return 'critical'
  const minutes = ms / (1000 * 60)
  if (minutes <= 5) return 'critical'
  if (minutes <= 60) return 'strong'
  if (minutes <= 180) return 'subtle'
  return 'neutral'
}

export function deadlineToneClass(urgency: DeadlineUrgency): string {
  switch (urgency) {
    case 'subtle':
      return 'text-status-warning/90'
    case 'strong':
      return 'text-status-warning status-emphasis'
    case 'critical':
      return 'text-status-warning status-emphasis animate-urgency-pulse'
    default:
      return 'text-white/45'
  }
}
