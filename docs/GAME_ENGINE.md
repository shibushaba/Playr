# PLAYR Game Engine

Server-side lifecycle for open → confirmed/cancelled, reservations, waitlist, and recurring generation.

## Scheduled job

Migration `20260327000010_game_engine.sql` defines:

```sql
select public.run_playr_engine_tick();
```

Scheduled via `pg_cron` as job `playr-engine-tick` every minute when available.

### Deployment verification

After applying migrations, confirm the cron job in SQL Editor (as superuser / dashboard):

```sql
-- Exactly one job named playr-engine-tick
select jobid, jobname, schedule, command, active
from cron.job
where jobname = 'playr-engine-tick';

-- Expected: schedule */1 * * * *, command select public.run_playr_engine_tick();
```

If no row is returned, enable **pg_cron** under Database → Extensions and re-run migration `20260327000010_game_engine.sql`, or schedule manually:

```sql
select cron.schedule(
  'playr-engine-tick',
  '* * * * *',
  $$select public.run_playr_engine_tick();$$
);
```

Idempotency smoke test (safe on staging):

```sql
select public.run_playr_engine_tick();
select public.run_playr_engine_tick();
-- Second run should not duplicate notifications or recurring games.
```

See also `supabase/PILOT_VERIFY.sql` and `supabase/VALIDATION_GAME_ENGINE.sql`.

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
