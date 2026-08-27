import { AppError, logDevError, parsePlayrRpcError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

export interface AdminOverview {
  games_today: number
  games_this_week: number
  completed_games: number
  cancelled_games: number
  players: number
  new_users_7d?: number
  active_users_7d?: number
  venues_total: number
  venues_verified: number
  venues_community: number
  pending_venue_reviews: number
  pending_edit_requests: number
  open_reports: number
  feedback_count: number
  avg_fill_rate_7d?: number | null
}

export interface VenueReviewItem {
  id: string
  name: string
  address: string | null
  city: string | null
  state: string | null
  latitude: number | null
  longitude: number | null
  map_url: string | null
  phone: string | null
  sports: unknown
  status: string
  created_at: string
  created_by: string | null
  submitter_name: string | null
  submitter_username: string | null
  nearby_venues: Array<{
    id: string
    name: string
    status: string
    distance_meters: number
  }>
}

export interface VenueEditRequestItem {
  id: string
  venue_id: string
  submitted_by: string
  proposed_changes: Record<string, unknown>
  reason: string | null
  status: string
  created_at: string
  venue_name: string
  venue_address: string | null
  venue_phone: string | null
  venue_sports: unknown
  venue_map_url: string | null
  venue_description: string | null
  venue_latitude: number | null
  venue_longitude: number | null
  submitter_name: string | null
}

export interface AdminReportItem {
  id: string
  reason: string
  description: string | null
  status: string
  created_at: string
  game_id: string | null
  venue_id: string | null
  reported_user_id: string | null
  reporter_name: string | null
  reported_user_name: string | null
}

export interface ModerationActionItem {
  id: string
  action: string
  entity_type: string
  entity_id: string
  metadata: Record<string, unknown>
  created_at: string
  admin_name: string | null
}

export interface AdminFeedbackItem {
  id: string
  game_id: string
  overall_rating: number
  comment: string | null
  tags: unknown
  is_hidden: boolean
  created_at: string
  venue_id: string | null
  author_name: string | null
  game_title: string | null
}

export interface AdminUserSearchItem {
  id: string
  display_name: string | null
  username: string | null
  created_at: string
  suspended_at: string | null
  games_joined: number
  games_hosted: number
}

async function adminRpc<T>(
  fn: keyof import('@/types/database').Database['public']['Functions'],
  args: Record<string, unknown>,
  fallback: string,
): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) {
    logDevError(fn, error)
    throw parsePlayrRpcError(error, fallback)
  }
  return data as T
}

export async function checkIsPlayrAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_is_playr_admin')
  if (error) {
    logDevError('checkIsPlayrAdmin', error)
    return false
  }
  return Boolean(data)
}

export async function getAdminOverview(): Promise<AdminOverview> {
  return adminRpc('admin_get_overview', {}, "Couldn't load admin overview.")
}

export async function listVenueReviewQueue(options?: {
  limit?: number
  offset?: number
}): Promise<VenueReviewItem[]> {
  const data = await adminRpc<VenueReviewItem[]>(
    'admin_list_venue_review_queue',
    {
      p_limit: options?.limit ?? 50,
      p_offset: options?.offset ?? 0,
    },
    "Couldn't load venue review queue.",
  )
  return data ?? []
}

export async function verifyVenue(venueId: string, notes?: string): Promise<void> {
  await adminRpc('admin_verify_venue', { p_venue_id: venueId, p_notes: notes ?? null }, "Couldn't verify venue.")
}

export async function rejectVenue(venueId: string, notes?: string): Promise<void> {
  await adminRpc('admin_reject_venue', { p_venue_id: venueId, p_notes: notes ?? null }, "Couldn't reject venue.")
}

export async function archiveVenue(venueId: string, notes?: string): Promise<void> {
  await adminRpc('admin_archive_venue', { p_venue_id: venueId, p_notes: notes ?? null }, "Couldn't archive venue.")
}

export async function listVenueEditRequests(status = 'pending'): Promise<VenueEditRequestItem[]> {
  const data = await adminRpc<VenueEditRequestItem[]>(
    'admin_list_venue_edit_requests',
    { p_status: status, p_limit: 50, p_offset: 0 },
    "Couldn't load edit requests.",
  )
  return data ?? []
}

export async function approveVenueEdit(requestId: string, notes?: string): Promise<void> {
  await adminRpc(
    'admin_approve_venue_edit',
    { p_request_id: requestId, p_notes: notes ?? null },
    "Couldn't approve edit.",
  )
}

export async function rejectVenueEdit(requestId: string, notes?: string): Promise<void> {
  await adminRpc(
    'admin_reject_venue_edit',
    { p_request_id: requestId, p_notes: notes ?? null },
    "Couldn't reject edit.",
  )
}

export async function requestVenueEditInfo(
  requestId: string,
  notes?: string,
): Promise<void> {
  await adminRpc(
    'admin_request_venue_edit_info',
    { p_request_id: requestId, p_notes: notes ?? null },
    "Couldn't request more information.",
  )
}

export async function getAdminGameInsights(days = 30): Promise<Record<string, unknown>> {
  return adminRpc(
    'admin_game_insights',
    { p_days: days },
    "Couldn't load game insights.",
  )
}

export async function getAdminVenueInsights(): Promise<Record<string, unknown>> {
  return adminRpc('admin_venue_insights', {}, "Couldn't load venue insights.")
}

export async function listAdminReports(status?: string): Promise<AdminReportItem[]> {
  const data = await adminRpc<AdminReportItem[]>(
    'admin_list_reports',
    { p_status: status ?? null, p_limit: 50, p_offset: 0 },
    "Couldn't load reports.",
  )
  return data ?? []
}

export async function updateAdminReport(
  reportId: string,
  status: 'resolved' | 'dismissed' | 'reviewing',
  notes?: string,
): Promise<void> {
  await adminRpc(
    'admin_update_report',
    { p_report_id: reportId, p_status: status, p_notes: notes ?? null },
    "Couldn't update report.",
  )
}

export async function listModerationActions(): Promise<ModerationActionItem[]> {
  const data = await adminRpc<ModerationActionItem[]>(
    'admin_list_moderation_actions',
    { p_limit: 50, p_offset: 0 },
    "Couldn't load activity.",
  )
  return data ?? []
}

export async function listAdminGameFeedback(): Promise<AdminFeedbackItem[]> {
  const data = await adminRpc<AdminFeedbackItem[]>(
    'admin_list_game_feedback',
    { p_limit: 50, p_offset: 0 },
    "Couldn't load feedback.",
  )
  return data ?? []
}

export async function hideGameFeedback(feedbackId: string, notes?: string): Promise<void> {
  await adminRpc(
    'admin_hide_game_feedback',
    { p_feedback_id: feedbackId, p_notes: notes ?? null },
    "Couldn't hide feedback.",
  )
}

export async function searchAdminUsers(query: string): Promise<AdminUserSearchItem[]> {
  const data = await adminRpc<AdminUserSearchItem[]>(
    'admin_search_users',
    { p_query: query, p_limit: 20 },
    "Couldn't search users.",
  )
  return data ?? []
}

export async function suspendUser(userId: string, notes?: string): Promise<void> {
  await adminRpc(
    'admin_suspend_user',
    { p_user_id: userId, p_notes: notes ?? null },
    "Couldn't suspend user.",
  )
}

export async function unsuspendUser(userId: string, notes?: string): Promise<void> {
  await adminRpc(
    'admin_unsuspend_user',
    { p_user_id: userId, p_notes: notes ?? null },
    "Couldn't unsuspend user.",
  )
}

export function assertAdminAccess(isAdmin: boolean): void {
  if (!isAdmin) {
    throw new AppError('Admin access required.')
  }
}
