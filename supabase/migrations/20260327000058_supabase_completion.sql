-- Security + observability: lock playr_settings, extend game_events audit types

-- ---------------------------------------------------------------------------
-- 1. playr_settings — no client access (RPC-only pilot config)
-- ---------------------------------------------------------------------------

alter table public.playr_settings enable row level security;

revoke all on table public.playr_settings from anon, authenticated;

-- No SELECT/INSERT/UPDATE policies: PostgREST clients cannot read pilot flags.

-- ---------------------------------------------------------------------------
-- 2. game_events — allow recurring + waitlist audit types
-- ---------------------------------------------------------------------------

alter table public.game_events drop constraint if exists game_events_type_check;

alter table public.game_events add constraint game_events_type_check check (
  event_type in (
    'game_created', 'player_reserved', 'player_confirmed', 'player_cancelled',
    'player_waitlisted', 'player_promoted', 'waitlist_promoted',
    'reservation_expired', 'game_confirmed', 'game_cancelled',
    'game_started', 'game_completed', 'player_checked_in',
    'attendance_marked', 'attendance_disputed',
    'venue_booking_confirmed', 'venue_booking_invalidated',
    'profile_verified', 'recurring_occurrence_created'
  )
);
