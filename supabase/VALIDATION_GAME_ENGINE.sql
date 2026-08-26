-- PLAYR Game Engine validation checklist (run in SQL editor after migrations)
-- These are manual/procedural checks, not a unit-test runner.

-- 1) Engine tick is callable
-- select public.run_playr_engine_tick();

-- 2) Confirmation deadline helper
-- select public.calculate_game_confirmation_deadline(
--   public.game_start_at(current_date + 1, '21:00')
-- );
-- Expect: start - 3 hours

-- 3) Capacity ignores expired reservations
-- insert reserved with reservation_expires_at < now(), then:
-- select public.get_game_player_count('<game_id>');

-- 4) Last-seat race (run in two sessions against same open game with 1 seat):
-- begin; select public.join_game('<game_id>'); commit;
-- One succeeds, the other raises GAME_FULL.

-- 5) Deadline processing
-- update games set confirmation_deadline = now() - interval '1 minute'
-- where id = '<open_game_id>' and status = 'open';
-- select public.process_open_game_confirmations();
-- Expect: confirmed if min met, else cancelled.

-- 6) Reservation cleanup
-- select public.cleanup_expired_reservations();

-- 7) Lifecycle
-- select public.process_game_lifecycle();

-- 8) Recurring generation idempotency
-- select public.generate_recurring_games(14);
-- select public.generate_recurring_games(14);
-- Expect: second run inserts 0 new rows for same group_id+date+time.

-- 9) Waitlist promotion after cancel
-- Full game + waitlisted user; cancel a confirmed player;
-- Expect: waitlisted → reserved (open) or confirmed (if game already confirmed).

-- 10) Phone privacy
-- As unrelated user: select public.get_game_contact_phone(game_id, other_user);
-- Expect: null
