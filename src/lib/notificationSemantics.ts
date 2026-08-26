import type { NotificationType } from '@/types/database'

export type NotificationSemantic = 'success' | 'warning' | 'danger' | 'neutral'

export function notificationSemantic(type: NotificationType): NotificationSemantic {
  switch (type) {
    case 'game_confirmed':
    case 'waitlist_spot':
      return 'success'
    case 'game_cancelled':
    case 'attendance_issue':
      return 'danger'
    case 'reservation_expiring':
    case 'game_reminder_3h':
      return 'warning'
    case 'game_starting':
      return 'warning'
    default:
      return 'neutral'
  }
}

export function notificationDotClass(semantic: NotificationSemantic): string {
  switch (semantic) {
    case 'success':
      return 'bg-status-success'
    case 'warning':
      return 'bg-status-warning'
    case 'danger':
      return 'bg-status-danger'
    default:
      return 'bg-white/50'
  }
}
