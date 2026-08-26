# PLAYR Game Engine

Server-side lifecycle for open → confirmed/cancelled, reservations, waitlist, and recurring generation.

## Scheduled job

Migration `20260327000010_game_engine.sql` defines:

```sql
select public.run_playr_engine_tick();
```

Scheduled via `pg_cron` as job `playr-engine-tick` every minute when available.

### If pg_cron is unavailable

In Supabase Dashboard → Database → Extensions: enable **pg_cron**.

Or schedule an Edge Function / external cron that runs as **service role**:

```sql
select public.run_playr_engine_tick();
```

## Processors inside the tick

1. `cleanup_expired_reservations` — reserved → cancelled when expired  
2. `process_open_game_confirmations` — open games past deadline → confirmed or cancelled  
3. `process_game_lifecycle` — confirmed → live → completed  
4. `generate_recurring_games(14)` — create upcoming occurrences (idempotent)

## Key RPCs (client)

| RPC | Purpose |
| --- | --- |
| `join_game` | Atomic reserve (errors: `GAME_FULL`, `GAME_CLOSED`, …) |
| `join_waitlist` | Waitlist when full |
| `confirm_game_reservation` | reserved → confirmed |
| `cancel_game_participation` | Cancel + waitlist promotion |
| `set_recurring_group_active` | Pause/resume group |

## Manual validation

See `VALIDATION_GAME_ENGINE.sql`.
