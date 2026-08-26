-- PLAYR hardening: revoke unsafe client mutations, tighten privacy columns,
-- lock game status transitions

-- ---------------------------------------------------------------------------
-- C1: game_players — RPC-only mutations
-- ---------------------------------------------------------------------------

drop policy if exists game_players_update_own_cancel on public.game_players;
revoke update on table public.game_players from authenticated;
grant select on table public.game_players to authenticated;

-- ---------------------------------------------------------------------------
-- H3: tighten game status transitions for authenticated clients
-- ---------------------------------------------------------------------------

create or replace function public.protect_game_mutations()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Engine / service role (no JWT) may change status freely
  if auth.uid() is null then
    if tg_op = 'UPDATE'
       and old.status = 'confirmed'
       and new.status is distinct from old.status
       and (
         new.confirmation_deadline is distinct from old.confirmation_deadline
         or new.minimum_players is distinct from old.minimum_players
         or new.maximum_players is distinct from old.maximum_players
         or new.game_date is distinct from old.game_date
         or new.start_time is distinct from old.start_time
         or new.end_time is distinct from old.end_time
         or new.host_id is distinct from old.host_id
         or new.group_id is distinct from old.group_id
       ) then
      perform public.raise_playr_error(
        'CONFIRMED_GAME_LOCKED',
        'Confirmed games cannot change capacity, schedule, or host'
      );
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    -- Host may publish draft → open
    if new.status = 'open'
       and old.status = 'draft'
       and new.host_id = auth.uid() then
      null;
    -- Host may cancel only before confirmation
    elsif new.status = 'cancelled'
       and old.status in ('draft', 'open')
       and new.host_id = auth.uid() then
      null;
    else
      perform public.raise_playr_error(
        'STATUS_LOCKED',
        'Game status changes are controlled by PLAYR rules'
      );
    end if;
  end if;

  if tg_op = 'UPDATE'
     and old.status = 'confirmed'
     and (
       new.confirmation_deadline is distinct from old.confirmation_deadline
       or new.minimum_players is distinct from old.minimum_players
       or new.maximum_players is distinct from old.maximum_players
       or new.game_date is distinct from old.game_date
       or new.start_time is distinct from old.start_time
       or new.end_time is distinct from old.end_time
       or new.host_id is distinct from old.host_id
       or new.group_id is distinct from old.group_id
     ) then
    perform public.raise_playr_error(
      'CONFIRMED_GAME_LOCKED',
      'Confirmed games cannot change capacity, schedule, or host'
    );
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- H1: invite tokens not readable via table SELECT
-- ---------------------------------------------------------------------------

revoke select on table public.game_invites from authenticated;
revoke select on table public.group_invites from authenticated;

grant select (
  id, game_id, invited_by, invited_user_id, short_code, status,
  expires_at, created_at, accepted_at
) on table public.game_invites to authenticated;

grant select (
  id, group_id, invited_by, invited_user_id, short_code, status,
  expires_at, created_at, accepted_at
) on table public.group_invites to authenticated;

-- ---------------------------------------------------------------------------
-- H2: check-in coordinates not returned via table SELECT
-- ---------------------------------------------------------------------------

revoke select on table public.check_ins from authenticated;

grant select (
  id, game_id, user_id, checked_in_at, method, checked_in_by, created_at
) on table public.check_ins to authenticated;

-- ---------------------------------------------------------------------------
-- H4: anon must not read home coordinates
-- ---------------------------------------------------------------------------

revoke select on table public.profiles from anon;

grant select (
  id, display_name, username, avatar_url, bio, is_active, created_at, updated_at
) on table public.profiles to anon;

-- Authenticated: only self may update phone; public select already excludes phone.
-- Also omit home coords from broad authenticated select if column grant exists.
do $$
begin
  -- Best-effort: re-grant public profile columns without home_* for authenticated
  -- (phone already revoked in init)
  begin
    revoke select on table public.profiles from authenticated;
  exception when others then null;
  end;

  grant select (
    id, display_name, username, avatar_url, bio, is_active, created_at, updated_at
  ) on table public.profiles to authenticated;

  -- Own row full access for update still needs phone via get_my_profile / column update
  grant update (
    display_name, username, phone, avatar_url, bio, home_latitude, home_longitude, updated_at
  ) on table public.profiles to authenticated;
end $$;

-- ---------------------------------------------------------------------------
-- M1: notifications — only read_at updatable (prefer RPC)
-- ---------------------------------------------------------------------------

revoke update on table public.notifications from authenticated;
grant update (read_at) on table public.notifications to authenticated;

-- ---------------------------------------------------------------------------
-- M2: attendance feedback — revoke direct insert; use host_mark_attendance RPC
-- ---------------------------------------------------------------------------

drop policy if exists feedback_insert on public.game_attendance_feedback;
drop policy if exists game_attendance_feedback_insert on public.game_attendance_feedback;
revoke insert on table public.game_attendance_feedback from authenticated;
grant select on table public.game_attendance_feedback to authenticated;

-- ---------------------------------------------------------------------------
-- M3: revoke client token generators
-- ---------------------------------------------------------------------------

revoke execute on function public.generate_invite_token() from authenticated;
revoke execute on function public.generate_short_code() from authenticated;

-- ---------------------------------------------------------------------------
-- Indexes justified by hot paths (IF NOT EXISTS)
-- ---------------------------------------------------------------------------

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_unread_partial_idx
  on public.notifications (user_id)
  where read_at is null;

create index if not exists game_players_game_status_idx
  on public.game_players (game_id, status);

create index if not exists games_group_date_idx
  on public.games (group_id, game_date, start_time)
  where group_id is not null;
