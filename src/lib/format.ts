import type { UiGameStatus } from '@/types/domain'

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export function formatInr(amount: number | null | undefined): string {
  if (amount == null) return 'Free'
  return `₹${amount}`
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toFixed(1)} km`
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatDay(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const tomorrow = new Date()
  tomorrow.setDate(today.getDate() + 1)

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()

  if (sameDay(d, today)) return 'Today'
  if (sameDay(d, tomorrow)) return 'Tomorrow'
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

/** Prefer server confirmation_deadline when available */
export function formatRelativeDeadline(
  confirmationDeadlineOrStartsAt: string,
  isDeadline = false,
): string {
  const deadline = isDeadline
    ? new Date(confirmationDeadlineOrStartsAt)
    : new Date(
        new Date(confirmationDeadlineOrStartsAt).getTime() - 3 * 60 * 60 * 1000,
      )
  const ms = deadline.getTime() - Date.now()
  if (ms <= 0) return 'Deadline passed'
  const hours = Math.floor(ms / (1000 * 60 * 60))
  const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    return `${days}d ${hours % 24}h left to confirm`
  }
  if (hours > 0) return `${hours}h ${mins}m left to confirm`
  return `${mins}m left to confirm`
}

export function statusLabel(status: UiGameStatus): string {
  switch (status) {
    case 'open':
      return 'Open'
    case 'filling':
      return 'Filling fast'
    case 'full':
      return 'Full'
    case 'confirmed':
      return 'Confirmed'
    case 'cancelled':
      return 'Cancelled'
    case 'completed':
      return 'Completed'
    case 'in_progress':
      return 'In progress'
    case 'draft':
      return 'Draft'
    default:
      return status
  }
}

export function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function spotsLeft(confirmed: number, max: number): number {
  return Math.max(0, max - confirmed)
}

export function mapJoinError(message: string): string {
  const msg = message.toLowerCase()
  if (msg.includes('sign in')) return 'Please sign in to join this game.'
  if (msg.includes('full')) return 'That game is already full.'
  if (msg.includes('expired')) return 'Your reservation expired.'
  if (msg.includes('already')) return 'You already have a spot in this game.'
  if (msg.includes('no longer') || msg.includes('deadline')) {
    return 'That game is no longer accepting players.'
  }
  return "Couldn't join this game. Try again."
}
