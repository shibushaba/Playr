export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type VenueStatus =
  | 'pending'
  | 'community_added'
  | 'verified'
  | 'rejected'
  | 'archived'
export type GroupVisibility = 'public' | 'private' | 'invite_only'
export type RecurrenceType = 'daily' | 'weekly' | 'custom'
export type GameVisibility = 'public' | 'private' | 'invite_only'
export type DbGameStatus =
  | 'draft'
  | 'open'
  | 'confirmed'
  | 'cancelled'
  | 'live'
  | 'completed'
export type VenueConfirmation = 'pending' | 'confirmed'
export type GamePlayerRole = 'player' | 'host' | 'co_host'
export type GamePlayerStatus =
  | 'reserved'
  | 'confirmed'
  | 'waitlisted'
  | 'cancelled'
  | 'no_show'
  | 'attended'
export type CheckInMethod = 'qr' | 'location' | 'manual'
export type SubmissionStatus = 'pending' | 'approved' | 'rejected'
export type ReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed'
export type AttendanceFeedbackStatus = 'attended' | 'no_show' | 'late'
export type GroupMemberRole = 'host' | 'co_host' | 'member'
export type GroupMemberStatus = 'active' | 'left' | 'invited'
export type InviteStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'revoked'
export type GameRsvpResponse = 'in' | 'maybe' | 'out'
export type NotificationType =
  | 'game_confirmed'
  | 'game_cancelled'
  | 'reservation_expiring'
  | 'waitlist_spot'
  | 'game_starting'
  | 'game_reminder_24h'
  | 'game_reminder_3h'
  | 'group_invite'
  | 'game_invite'
  | 'group_game_created'
  | 'host_message'
  | 'attendance_issue'
  | 'venue_submitted'
  | 'venue_verified'
  | 'venue_rejected'
  | 'venue_edit_approved'
  | 'venue_edit_rejected'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string | null
          username: string | null
          phone: string | null
          phone_verified_at: string | null
          email_verified_at: string | null
          avatar_url: string | null
          bio: string | null
          home_latitude: number | null
          home_longitude: number | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          display_name?: string | null
          username?: string | null
          phone?: string | null
          phone_verified_at?: string | null
          email_verified_at?: string | null
          avatar_url?: string | null
          bio?: string | null
          home_latitude?: number | null
          home_longitude?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          display_name?: string | null
          username?: string | null
          phone?: string | null
          phone_verified_at?: string | null
          email_verified_at?: string | null
          avatar_url?: string | null
          bio?: string | null
          home_latitude?: number | null
          home_longitude?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      sports: {
        Row: {
          id: string
          name: string
          slug: string
          icon: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          icon?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          icon?: string | null
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      venues: {
        Row: {
          id: string
          name: string
          description: string | null
          address: string | null
          city: string | null
          state: string | null
          country: string | null
          latitude: number | null
          longitude: number | null
          map_url: string | null
          phone: string | null
          website: string | null
          image_url: string | null
          facilities: Json
          sports: Json
          opening_hours: Json
          status: VenueStatus
          created_by: string | null
          claimed_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          address?: string | null
          city?: string | null
          state?: string | null
          country?: string | null
          latitude?: number | null
          longitude?: number | null
          map_url?: string | null
          phone?: string | null
          website?: string | null
          image_url?: string | null
          facilities?: Json
          sports?: Json
          opening_hours?: Json
          status?: VenueStatus
          created_by?: string | null
          claimed_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          address?: string | null
          city?: string | null
          state?: string | null
          country?: string | null
          latitude?: number | null
          longitude?: number | null
          map_url?: string | null
          phone?: string | null
          website?: string | null
          image_url?: string | null
          facilities?: Json
          sports?: Json
          opening_hours?: Json
          status?: VenueStatus
          created_by?: string | null
          claimed_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      recurring_groups: {
        Row: {
          id: string
          name: string
          description: string | null
          host_id: string
          sport_id: string
          venue_id: string | null
          visibility: GroupVisibility
          recurrence_type: RecurrenceType
          recurrence_config: Json
          start_time: string
          duration_minutes: number
          minimum_players: number
          maximum_players: number
          player_share: number | null
          auto_open_missing_spots: boolean
          regular_member_priority_hours: number
          ends_on: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          host_id: string
          sport_id: string
          venue_id?: string | null
          visibility?: GroupVisibility
          recurrence_type?: RecurrenceType
          recurrence_config?: Json
          start_time: string
          duration_minutes?: number
          minimum_players: number
          maximum_players: number
          player_share?: number | null
          auto_open_missing_spots?: boolean
          regular_member_priority_hours?: number
          ends_on?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          host_id?: string
          sport_id?: string
          venue_id?: string | null
          visibility?: GroupVisibility
          recurrence_type?: RecurrenceType
          recurrence_config?: Json
          start_time?: string
          duration_minutes?: number
          minimum_players?: number
          maximum_players?: number
          player_share?: number | null
          auto_open_missing_spots?: boolean
          regular_member_priority_hours?: number
          ends_on?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'recurring_groups_sport_id_fkey'
            columns: ['sport_id']
            isOneToOne: false
            referencedRelation: 'sports'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'recurring_groups_venue_id_fkey'
            columns: ['venue_id']
            isOneToOne: false
            referencedRelation: 'venues'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'recurring_groups_host_id_fkey'
            columns: ['host_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      games: {
        Row: {
          id: string
          host_id: string
          group_id: string | null
          sport_id: string
          venue_id: string | null
          title: string
          description: string | null
          game_date: string
          start_time: string
          end_time: string
          minimum_players: number
          maximum_players: number
          player_share: number | null
          visibility: GameVisibility
          status: DbGameStatus
          venue_confirmation: VenueConfirmation
          venue_booking_confirmed_at: string | null
          venue_booking_confirmed_by: string | null
          confirmation_deadline: string
          member_priority_until: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          host_id: string
          group_id?: string | null
          sport_id: string
          venue_id?: string | null
          title: string
          description?: string | null
          game_date: string
          start_time: string
          end_time: string
          minimum_players: number
          maximum_players: number
          player_share?: number | null
          visibility?: GameVisibility
          status?: DbGameStatus
          venue_confirmation?: VenueConfirmation
          venue_booking_confirmed_at?: string | null
          venue_booking_confirmed_by?: string | null
          confirmation_deadline?: string
          member_priority_until?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          host_id?: string
          group_id?: string | null
          sport_id?: string
          venue_id?: string | null
          title?: string
          description?: string | null
          game_date?: string
          start_time?: string
          end_time?: string
          minimum_players?: number
          maximum_players?: number
          player_share?: number | null
          visibility?: GameVisibility
          status?: DbGameStatus
          venue_confirmation?: VenueConfirmation
          venue_booking_confirmed_at?: string | null
          venue_booking_confirmed_by?: string | null
          confirmation_deadline?: string
          member_priority_until?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'games_host_id_fkey'
            columns: ['host_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'games_sport_id_fkey'
            columns: ['sport_id']
            isOneToOne: false
            referencedRelation: 'sports'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'games_venue_id_fkey'
            columns: ['venue_id']
            isOneToOne: false
            referencedRelation: 'venues'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'games_group_id_fkey'
            columns: ['group_id']
            isOneToOne: false
            referencedRelation: 'recurring_groups'
            referencedColumns: ['id']
          },
        ]
      }
      game_players: {
        Row: {
          id: string
          game_id: string
          user_id: string
          role: GamePlayerRole
          status: GamePlayerStatus
          joined_at: string
          reservation_expires_at: string | null
          checked_in_at: string | null
          cancelled_at: string | null
          contact_consent_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          game_id: string
          user_id: string
          role?: GamePlayerRole
          status?: GamePlayerStatus
          joined_at?: string
          reservation_expires_at?: string | null
          checked_in_at?: string | null
          cancelled_at?: string | null
          contact_consent_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          game_id?: string
          user_id?: string
          role?: GamePlayerRole
          status?: GamePlayerStatus
          joined_at?: string
          reservation_expires_at?: string | null
          checked_in_at?: string | null
          cancelled_at?: string | null
          contact_consent_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'game_players_game_id_fkey'
            columns: ['game_id']
            isOneToOne: false
            referencedRelation: 'games'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'game_players_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      check_ins: {
        Row: {
          id: string
          game_id: string
          user_id: string
          checked_in_at: string
          method: CheckInMethod
          latitude: number | null
          longitude: number | null
          checked_in_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          game_id: string
          user_id: string
          checked_in_at?: string
          method?: CheckInMethod
          latitude?: number | null
          longitude?: number | null
          checked_in_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          game_id?: string
          user_id?: string
          checked_in_at?: string
          method?: CheckInMethod
          latitude?: number | null
          longitude?: number | null
          checked_in_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      game_messages: {
        Row: {
          id: string
          game_id: string
          sender_id: string
          message: string
          created_at: string
        }
        Insert: {
          id?: string
          game_id: string
          sender_id: string
          message: string
          created_at?: string
        }
        Update: {
          id?: string
          game_id?: string
          sender_id?: string
          message?: string
          created_at?: string
        }
        Relationships: []
      }
      venue_submissions: {
        Row: {
          id: string
          submitted_by: string
          venue_id: string | null
          name: string
          address: string | null
          phone: string | null
          latitude: number | null
          longitude: number | null
          notes: string | null
          status: SubmissionStatus
          reviewed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          submitted_by: string
          venue_id?: string | null
          name: string
          address?: string | null
          phone?: string | null
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          status?: SubmissionStatus
          reviewed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          submitted_by?: string
          venue_id?: string | null
          name?: string
          address?: string | null
          phone?: string | null
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          status?: SubmissionStatus
          reviewed_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          id: string
          reporter_id: string
          reported_user_id: string | null
          game_id: string | null
          venue_id: string | null
          message_id: string | null
          reason: string
          description: string | null
          status: ReportStatus
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          reporter_id: string
          reported_user_id?: string | null
          game_id?: string | null
          venue_id?: string | null
          message_id?: string | null
          reason: string
          description?: string | null
          status?: ReportStatus
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          reporter_id?: string
          reported_user_id?: string | null
          game_id?: string | null
          venue_id?: string | null
          message_id?: string | null
          reason?: string
          description?: string | null
          status?: ReportStatus
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_feedback: {
        Row: {
          id: string
          user_id: string
          kind: string
          message: string
          page_path: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          kind: string
          message: string
          page_path?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          kind?: string
          message?: string
          page_path?: string | null
          created_at?: string
        }
        Relationships: []
      }
      user_blocks: {
        Row: {
          id: string
          blocker_id: string
          blocked_user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          blocker_id: string
          blocked_user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          blocker_id?: string
          blocked_user_id?: string
          created_at?: string
        }
        Relationships: []
      }
      discovery_areas: {
        Row: {
          id: string
          name: string
          state: string | null
          country: string
          latitude: number
          longitude: number
          is_active: boolean
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          state?: string | null
          country?: string
          latitude: number
          longitude: number
          is_active?: boolean
          sort_order?: number
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['discovery_areas']['Insert']>
        Relationships: []
      }
      game_attendance_feedback: {
        Row: {
          id: string
          game_id: string
          subject_user_id: string
          submitted_by: string
          attendance_status: AttendanceFeedbackStatus
          payment_acknowledged: boolean | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          game_id: string
          subject_user_id: string
          submitted_by: string
          attendance_status: AttendanceFeedbackStatus
          payment_acknowledged?: boolean | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          game_id?: string
          subject_user_id?: string
          submitted_by?: string
          attendance_status?: AttendanceFeedbackStatus
          payment_acknowledged?: boolean | null
          notes?: string | null
          created_at?: string
        }
        Relationships: []
      }
      recurring_group_members: {
        Row: {
          id: string
          group_id: string
          user_id: string
          role: GroupMemberRole
          status: GroupMemberStatus
          joined_at: string
          created_at: string
        }
        Insert: {
          id?: string
          group_id: string
          user_id: string
          role?: GroupMemberRole
          status?: GroupMemberStatus
          joined_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          group_id?: string
          user_id?: string
          role?: GroupMemberRole
          status?: GroupMemberStatus
          joined_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'recurring_group_members_group_id_fkey'
            columns: ['group_id']
            isOneToOne: false
            referencedRelation: 'recurring_groups'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'recurring_group_members_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      game_rsvps: {
        Row: {
          id: string
          game_id: string
          user_id: string
          response: GameRsvpResponse
          updated_at: string
          created_at: string
        }
        Insert: {
          id?: string
          game_id: string
          user_id: string
          response: GameRsvpResponse
          updated_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          game_id?: string
          user_id?: string
          response?: GameRsvpResponse
          updated_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'game_rsvps_game_id_fkey'
            columns: ['game_id']
            isOneToOne: false
            referencedRelation: 'games'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'game_rsvps_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      game_invites: {
        Row: {
          id: string
          game_id: string
          invited_by: string
          invited_user_id: string | null
          invite_token: string
          short_code: string | null
          status: InviteStatus
          expires_at: string | null
          created_at: string
          accepted_at: string | null
        }
        Insert: {
          id?: string
          game_id: string
          invited_by: string
          invited_user_id?: string | null
          invite_token: string
          short_code?: string | null
          status?: InviteStatus
          expires_at?: string | null
          created_at?: string
          accepted_at?: string | null
        }
        Update: {
          id?: string
          game_id?: string
          invited_by?: string
          invited_user_id?: string | null
          invite_token?: string
          short_code?: string | null
          status?: InviteStatus
          expires_at?: string | null
          created_at?: string
          accepted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'game_invites_game_id_fkey'
            columns: ['game_id']
            isOneToOne: false
            referencedRelation: 'games'
            referencedColumns: ['id']
          },
        ]
      }
      group_invites: {
        Row: {
          id: string
          group_id: string
          invited_by: string
          invited_user_id: string | null
          invite_token: string
          short_code: string | null
          status: InviteStatus
          expires_at: string | null
          created_at: string
          accepted_at: string | null
        }
        Insert: {
          id?: string
          group_id: string
          invited_by: string
          invited_user_id?: string | null
          invite_token: string
          short_code?: string | null
          status?: InviteStatus
          expires_at?: string | null
          created_at?: string
          accepted_at?: string | null
        }
        Update: {
          id?: string
          group_id?: string
          invited_by?: string
          invited_user_id?: string | null
          invite_token?: string
          short_code?: string | null
          status?: InviteStatus
          expires_at?: string | null
          created_at?: string
          accepted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'group_invites_group_id_fkey'
            columns: ['group_id']
            isOneToOne: false
            referencedRelation: 'recurring_groups'
            referencedColumns: ['id']
          },
        ]
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: NotificationType
          title: string
          body: string | null
          game_id: string | null
          group_id: string | null
          actor_id: string | null
          dedupe_key: string | null
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: NotificationType
          title: string
          body?: string | null
          game_id?: string | null
          group_id?: string | null
          actor_id?: string | null
          dedupe_key?: string | null
          read_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: NotificationType
          title?: string
          body?: string | null
          game_id?: string | null
          group_id?: string | null
          actor_id?: string | null
          dedupe_key?: string | null
          read_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      calculate_game_confirmation_deadline: {
        Args: { game_start: string }
        Returns: string
      }
      get_game_player_count: {
        Args: { p_game_id: string }
        Returns: number
      }
      is_game_full: {
        Args: { p_game_id: string }
        Returns: boolean
      }
      can_user_join_game: {
        Args: { p_game_id: string; p_user_id: string }
        Returns: boolean
      }
      join_game: {
        Args: { p_game_id: string; p_contact_consent?: boolean }
        Returns: Database['public']['Tables']['game_players']['Row']
      }
      join_waitlist: {
        Args: { p_game_id: string; p_contact_consent?: boolean }
        Returns: Database['public']['Tables']['game_players']['Row']
      }
      confirm_game_reservation: {
        Args: { p_game_id: string }
        Returns: Database['public']['Tables']['game_players']['Row']
      }
      cancel_game_participation: {
        Args: { p_game_id: string }
        Returns: Database['public']['Tables']['game_players']['Row']
      }
      publish_game: {
        Args: { p_game_id: string }
        Returns: Database['public']['Tables']['games']['Row']
      }
      host_delete_game: {
        Args: { p_game_id: string }
        Returns: Database['public']['Tables']['games']['Row']
      }
      confirm_game_venue_booking: {
        Args: { p_game_id: string }
        Returns: Database['public']['Tables']['games']['Row']
      }
      get_venue_contact_phone: {
        Args: { p_venue_id: string }
        Returns: string | null
      }
      request_phone_verification: {
        Args: { p_phone: string }
        Returns: Json
      }
      confirm_phone_verification: {
        Args: { p_code: string; p_challenge_id?: string }
        Returns: Database['public']['Tables']['profiles']['Row']
      }
      update_my_profile: {
        Args: {
          p_display_name?: string | null
          p_username?: string | null
          p_bio?: string | null
          p_phone?: string | null
          p_avatar_url?: string | null
          p_clear_phone?: boolean
          p_clear_avatar?: boolean
        }
        Returns: Json
      }
      get_game_contact_phone: {
        Args: { p_game_id: string; p_target_user_id: string }
        Returns: string | null
      }
      list_game_roster_contact_phones: {
        Args: { p_game_id: string }
        Returns: { user_id: string; phone: string }[]
      }
      check_in_with_location: {
        Args: {
          p_game_id: string
          p_latitude: number
          p_longitude: number
          p_radius_meters?: number
        }
        Returns: Database['public']['Tables']['check_ins']['Row']
      }
      host_manual_check_in: {
        Args: { p_game_id: string; p_user_id: string }
        Returns: Database['public']['Tables']['check_ins']['Row']
      }
      get_check_in_window: {
        Args: { p_game_id: string }
        Returns: Json
      }
      list_game_check_ins: {
        Args: { p_game_id: string }
        Returns: {
          user_id: string
          checked_in_at: string
          method: CheckInMethod
          checked_in_by: string | null
        }[]
      }
      host_mark_attendance: {
        Args: {
          p_game_id: string
          p_user_id: string
          p_status: AttendanceFeedbackStatus
          p_notes?: string | null
        }
        Returns: Database['public']['Tables']['game_attendance_feedback']['Row']
      }
      dispute_attendance: {
        Args: {
          p_game_id: string
          p_reason: string
          p_description?: string | null
        }
        Returns: Database['public']['Tables']['reports']['Row']
      }
      create_report: {
        Args: {
          p_reason: string
          p_description?: string | null
          p_reported_user_id?: string | null
          p_game_id?: string | null
          p_venue_id?: string | null
          p_message_id?: string | null
        }
        Returns: Database['public']['Tables']['reports']['Row']
      }
      submit_app_feedback: {
        Args: {
          p_kind: string
          p_message: string
          p_page_path?: string | null
        }
        Returns: Database['public']['Tables']['app_feedback']['Row']
      }
      get_player_reliability: {
        Args: { p_user_id: string }
        Returns: Json
      }
      get_my_profile: {
        Args: Record<string, never>
        Returns: Json
      }
      ensure_my_profile: {
        Args: Record<string, never>
        Returns: Json
      }
      ensure_host_player: {
        Args: { p_game_id: string }
        Returns: Database['public']['Tables']['game_players']['Row']
      }
      get_confirmed_player_count: {
        Args: { p_game_id: string }
        Returns: number
      }
      set_recurring_group_active: {
        Args: { p_group_id: string; p_is_active: boolean }
        Returns: Database['public']['Tables']['recurring_groups']['Row']
      }
      join_public_group: {
        Args: { p_group_id: string }
        Returns: Database['public']['Tables']['recurring_group_members']['Row']
      }
      leave_group: {
        Args: { p_group_id: string }
        Returns: Database['public']['Tables']['recurring_group_members']['Row']
      }
      set_group_member_role: {
        Args: {
          p_group_id: string
          p_user_id: string
          p_role: GroupMemberRole
        }
        Returns: Database['public']['Tables']['recurring_group_members']['Row']
      }
      remove_group_member: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: Database['public']['Tables']['recurring_group_members']['Row']
      }
      update_recurring_group: {
        Args: {
          p_group_id: string
          p_name?: string | null
          p_description?: string | null
          p_venue_id?: string | null
          p_visibility?: GroupVisibility | null
          p_recurrence_type?: RecurrenceType | null
          p_recurrence_config?: Json | null
          p_start_time?: string | null
          p_duration_minutes?: number | null
          p_minimum_players?: number | null
          p_maximum_players?: number | null
          p_player_share?: number | null
          p_auto_open_missing_spots?: boolean | null
          p_regular_member_priority_hours?: number | null
          p_ends_on?: string | null
          p_clear_ends_on?: boolean
          p_clear_venue?: boolean
        }
        Returns: Database['public']['Tables']['recurring_groups']['Row']
      }
      get_group_health: {
        Args: { p_group_id: string }
        Returns: Json
      }
      create_game_invite: {
        Args: {
          p_game_id: string
          p_invited_user_id?: string | null
          p_expires_in_hours?: number
        }
        Returns: Database['public']['Tables']['game_invites']['Row']
      }
      create_group_invite: {
        Args: {
          p_group_id: string
          p_invited_user_id?: string | null
          p_expires_in_hours?: number
        }
        Returns: Database['public']['Tables']['group_invites']['Row']
      }
      revoke_game_invite: {
        Args: { p_invite_id: string }
        Returns: Database['public']['Tables']['game_invites']['Row']
      }
      revoke_group_invite: {
        Args: { p_invite_id: string }
        Returns: Database['public']['Tables']['group_invites']['Row']
      }
      validate_game_invite: {
        Args: { p_token: string }
        Returns: Json
      }
      validate_group_invite: {
        Args: { p_token: string }
        Returns: Json
      }
      accept_game_invite: {
        Args: { p_token: string }
        Returns: Json
      }
      accept_group_invite: {
        Args: { p_token: string }
        Returns: Json
      }
      set_game_rsvp: {
        Args: {
          p_game_id: string
          p_response: GameRsvpResponse
          p_contact_consent?: boolean
        }
        Returns: Json
      }
      mark_notifications_read: {
        Args: { p_ids?: string[] | null }
        Returns: number
      }
      run_playr_engine_tick: {
        Args: Record<string, never>
        Returns: Json
      }
      get_nearby_games: {
        Args: {
          p_latitude: number
          p_longitude: number
          p_radius_meters?: number
          p_sport_id?: string
          p_game_date?: string
          p_date_from?: string
          p_date_to?: string
          p_time_bucket?: string
          p_search?: string
          p_limit?: number
          p_offset?: number
        }
        Returns: Record<string, unknown>[]
      }
      get_nearby_venues: {
        Args: {
          p_latitude: number
          p_longitude: number
          p_radius_meters?: number
          p_limit?: number
          p_offset?: number
          p_search?: string
        }
        Returns: Record<string, unknown>[]
      }
      create_venue: {
        Args: {
          p_name: string
          p_latitude: number
          p_longitude: number
          p_map_url: string
          p_address?: string
          p_city?: string
          p_state?: string
          p_country?: string
          p_sports?: Json
          p_description?: string
          p_force_create?: boolean
        }
        Returns: Database['public']['Tables']['venues']['Row']
      }
      find_similar_venues: {
        Args: {
          p_latitude: number
          p_longitude: number
          p_name?: string
          p_radius_meters?: number
        }
        Returns: {
          id: string
          name: string
          address: string | null
          city: string | null
          distance_meters: number
          map_url: string | null
        }[]
      }
      get_available_discovery_areas: {
        Args: Record<string, never>
        Returns: {
          id: string
          name: string
          state: string | null
          country: string
          latitude: number
          longitude: number
          game_count: number
          venue_count: number
        }[]
      }
      game_start_at: {
        Args: { p_date: string; p_time: string; p_tz?: string }
        Returns: string
      }
      check_is_playr_admin: {
        Args: Record<string, never>
        Returns: boolean
      }
      submit_venue_edit_request: {
        Args: {
          p_venue_id: string
          p_proposed_changes: Json
          p_reason?: string | null
        }
        Returns: Json
      }
      get_game_feedback_state: {
        Args: { p_game_id: string }
        Returns: Json
      }
      submit_game_experience_feedback: {
        Args: {
          p_game_id: string
          p_overall_rating: number
          p_comment?: string | null
          p_tags?: Json
        }
        Returns: Json
      }
      get_venue_rating_summary: {
        Args: { p_venue_id: string }
        Returns: Json
      }
      admin_get_overview: {
        Args: Record<string, never>
        Returns: Json
      }
      admin_list_venue_review_queue: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: Json
      }
      admin_verify_venue: {
        Args: { p_venue_id: string; p_notes?: string | null }
        Returns: Json
      }
      admin_reject_venue: {
        Args: { p_venue_id: string; p_notes?: string | null }
        Returns: Json
      }
      admin_archive_venue: {
        Args: { p_venue_id: string; p_notes?: string | null }
        Returns: Json
      }
      admin_list_venue_edit_requests: {
        Args: {
          p_status?: string | null
          p_limit?: number
          p_offset?: number
        }
        Returns: Json
      }
      admin_approve_venue_edit: {
        Args: { p_request_id: string; p_notes?: string | null }
        Returns: Json
      }
      admin_reject_venue_edit: {
        Args: { p_request_id: string; p_notes?: string | null }
        Returns: Json
      }
      admin_list_reports: {
        Args: {
          p_status?: string | null
          p_limit?: number
          p_offset?: number
        }
        Returns: Json
      }
      admin_update_report: {
        Args: {
          p_report_id: string
          p_status: ReportStatus
          p_notes?: string | null
        }
        Returns: Json
      }
      admin_suspend_user: {
        Args: { p_user_id: string; p_notes?: string | null }
        Returns: Json
      }
      admin_unsuspend_user: {
        Args: { p_user_id: string; p_notes?: string | null }
        Returns: Json
      }
      admin_list_moderation_actions: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: Json
      }
      admin_list_game_feedback: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: Json
      }
      admin_hide_game_feedback: {
        Args: { p_feedback_id: string; p_notes?: string | null }
        Returns: Json
      }
      admin_search_users: {
        Args: { p_query: string; p_limit?: number }
        Returns: Json
      }
      admin_request_venue_edit_info: {
        Args: { p_request_id: string; p_notes?: string | null }
        Returns: Json
      }
      admin_game_insights: {
        Args: { p_days?: number }
        Returns: Json
      }
      admin_venue_insights: {
        Args: Record<string, never>
        Returns: Json
      }
    }
    Enums: {
      venue_status: VenueStatus
      group_visibility: GroupVisibility
      recurrence_type: RecurrenceType
      game_visibility: GameVisibility
      game_status: DbGameStatus
      venue_confirmation: VenueConfirmation
      game_player_role: GamePlayerRole
      game_player_status: GamePlayerStatus
      check_in_method: CheckInMethod
      submission_status: SubmissionStatus
      report_status: ReportStatus
      attendance_feedback_status: AttendanceFeedbackStatus
      group_member_role: GroupMemberRole
      group_member_status: GroupMemberStatus
      invite_status: InviteStatus
      game_rsvp_response: GameRsvpResponse
      notification_type: NotificationType
    }
    CompositeTypes: Record<string, never>
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
