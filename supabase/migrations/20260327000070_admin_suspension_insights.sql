-- Remaining community/admin backend: suspension guards, insights RPCs, edit needs-info

-- ---------------------------------------------------------------------------
-- 1. Suspension assertion + table-level guards (covers engine RPCs safely)
-- ---------------------------------------------------------------------------

create or replace function public.assert_not_suspended(p_user_id uuid default auth.uid())
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    return;
  end if;
  if public.profile_is_suspended(p_user_id) then
    perform public.raise_playr_error('ACCOUNT_SUSPENDED', 'Your account is suspended.');
  end if;
end;
$$;

create or replace function public.guard_not_suspended_actor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    return new;
  end if;

  if tg_table_name = 'game_players' then
    if new.user_id = actor then
      perform public.assert_not_suspended(actor);
    end if;
  elsif tg_table_name = 'games' then
    if new.host_id = actor then
      perform public.assert_not_suspended(actor);
    end if;
  elsif tg_table_name = 'reports' then
    if new.reporter_id = actor then
      perform public.assert_not_suspended(actor);
    end if;
  elsif tg_table_name = 'venues' then
    if new.created_by = actor then
      perform public.assert_not_suspended(actor);
    end if;
  elsif tg_table_name = 'venue_edit_requests' then
    if new.submitted_by = actor then
      perform public.assert_not_suspended(actor);
    end if;
  elsif tg_table_name = 'game_experience_feedback' then
    if new.user_id = actor then
      perform public.assert_not_suspended(actor);
    end if;
  elsif tg_table_name = 'app_feedback' then
    if new.user_id = actor then
      perform public.assert_not_suspended(actor);
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists game_players_guard_suspended on public.game_players;
create trigger game_players_guard_suspended
before insert on public.game_players
for each row execute function public.guard_not_suspended_actor();

drop trigger if exists games_guard_suspended on public.games;
create trigger games_guard_suspended
before insert or update on public.games
for each row execute function public.guard_not_suspended_actor();

drop trigger if exists reports_guard_suspended on public.reports;
create trigger reports_guard_suspended
before insert on public.reports
for each row execute function public.guard_not_suspended_actor();

drop trigger if exists venues_guard_suspended on public.venues;
create trigger venues_guard_suspended
before insert on public.venues
for each row execute function public.guard_not_suspended_actor();

drop trigger if exists venue_edit_requests_guard_suspended on public.venue_edit_requests;
create trigger venue_edit_requests_guard_suspended
before insert on public.venue_edit_requests
for each row execute function public.guard_not_suspended_actor();

drop trigger if exists game_experience_feedback_guard_suspended on public.game_experience_feedback;
create trigger game_experience_feedback_guard_suspended
before insert on public.game_experience_feedback
for each row execute function public.guard_not_suspended_actor();

do $$ begin
  if to_regclass('public.app_feedback') is not null then
    execute 'drop trigger if exists app_feedback_guard_suspended on public.app_feedback';
    execute 'create trigger app_feedback_guard_suspended before insert on public.app_feedback for each row execute function public.guard_not_suspended_actor()';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Venue edit: request more information
-- ---------------------------------------------------------------------------

create or replace function public.admin_request_venue_edit_info(
  p_request_id uuid,
  p_notes text default null
)
returns public.venue_edit_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  req public.venue_edit_requests;
  vname text;
begin
  perform public.assert_playr_admin();

  update public.venue_edit_requests r
  set status = 'needs_info',
      reviewed_at = timezone('utc', now()),
      reviewed_by = uid,
      admin_notes = nullif(trim(coalesce(p_notes, '')), '')
  where r.id = p_request_id
    and r.status = 'pending'
  returning * into req;

  if req.id is null then
    perform public.raise_playr_error('ALREADY_REVIEWED', 'This edit request was already reviewed.');
  end if;

  select name into vname from public.venues where id = req.venue_id;

  perform public.log_moderation_action(
    'venue_edit_needs_info', 'venue_edit_request', p_request_id,
    jsonb_build_object('notes', p_notes)
  );

  perform public.create_notification(
    req.submitted_by,
    'venue_edit_rejected',
    'Venue edit needs changes',
    coalesce(
      nullif(trim(coalesce(p_notes, '')), ''),
      'Your proposed changes to ' || coalesce(vname, 'the venue') || ' need more information.'
    ),
    null,
    null,
    uid,
    'venue_edit_needs_info:' || p_request_id::text
  );

  return req;
end;
$$;

grant execute on function public.admin_request_venue_edit_info(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Admin analytics RPCs (server-side aggregation only)
-- ---------------------------------------------------------------------------

create or replace function public.admin_get_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  ist_today date := (timezone('Asia/Kolkata', now()))::date;
  week_start date := ist_today - 6;
  fill numeric;
begin
  perform public.assert_playr_admin();

  select case
    when count(*) = 0 then null
    else round(avg(
      least(1.0, public.get_game_player_count(g.id)::numeric / nullif(g.maximum_players, 0))
    )::numeric, 3)
  end
  into fill
  from public.games g
  where g.status in ('open', 'confirmed', 'live', 'completed')
    and g.game_date between week_start and ist_today;

  return jsonb_build_object(
    'games_today', (
      select count(*)::integer from public.games g
      where g.game_date = ist_today and g.status <> 'draft'
    ),
    'games_this_week', (
      select count(*)::integer from public.games g
      where g.game_date between week_start and ist_today and g.status <> 'draft'
    ),
    'completed_games', (
      select count(*)::integer from public.games g where g.status = 'completed'
    ),
    'cancelled_games', (
      select count(*)::integer from public.games g where g.status = 'cancelled'
    ),
    'players', (select count(*)::integer from public.profiles),
    'new_users_7d', (
      select count(*)::integer from public.profiles p
      where p.created_at >= timezone('utc', now()) - interval '7 days'
    ),
    'active_users_7d', (
      select count(distinct gp.user_id)::integer
      from public.game_players gp
      where gp.joined_at >= timezone('utc', now()) - interval '7 days'
         or gp.created_at >= timezone('utc', now()) - interval '7 days'
    ),
    'venues_total', (select count(*)::integer from public.venues),
    'venues_verified', (
      select count(*)::integer from public.venues v where v.status = 'verified'
    ),
    'venues_community', (
      select count(*)::integer from public.venues v where v.status = 'community_added'
    ),
    'pending_venue_reviews', (
      select count(*)::integer from public.venues v where v.status = 'community_added'
    ),
    'pending_edit_requests', (
      select count(*)::integer from public.venue_edit_requests r where r.status = 'pending'
    ),
    'open_reports', (
      select count(*)::integer from public.reports r where r.status in ('open', 'reviewing')
    ),
    'feedback_count', (
      select count(*)::integer from public.game_experience_feedback
    ),
    'avg_fill_rate_7d', fill
  );
end;
$$;

create or replace function public.admin_game_insights(
  p_days integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  d integer := greatest(1, least(coalesce(p_days, 30), 365));
  since date := (timezone('Asia/Kolkata', now()))::date - (d - 1);
begin
  perform public.assert_playr_admin();

  return jsonb_build_object(
    'window_days', d,
    'by_status', (
      select coalesce(jsonb_object_agg(status, cnt), '{}'::jsonb)
      from (
        select g.status::text as status, count(*)::integer as cnt
        from public.games g
        where g.game_date >= since
        group by g.status
      ) s
    ),
    'total', (
      select count(*)::integer from public.games g where g.game_date >= since and g.status <> 'draft'
    ),
    'avg_players', (
      select round(avg(public.get_game_player_count(g.id))::numeric, 2)
      from public.games g
      where g.game_date >= since and g.status in ('open', 'confirmed', 'live', 'completed')
    ),
    'fill_rate', (
      select case when count(*) = 0 then null
        else round(avg(
          least(1.0, public.get_game_player_count(g.id)::numeric / nullif(g.maximum_players, 0))
        )::numeric, 3) end
      from public.games g
      where g.game_date >= since and g.status in ('open', 'confirmed', 'live', 'completed')
    ),
    'cancellation_rate', (
      select case when count(*) = 0 then null
        else round(
          (count(*) filter (where g.status = 'cancelled'))::numeric / count(*)::numeric
        , 3) end
      from public.games g
      where g.game_date >= since and g.status <> 'draft'
    ),
    'per_day', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'date', d.game_date,
        'count', d.cnt
      ) order by d.game_date), '[]'::jsonb)
      from (
        select g.game_date, count(*)::integer as cnt
        from public.games g
        where g.game_date >= since and g.status <> 'draft'
        group by g.game_date
      ) d
    ),
    'per_sport', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'sport', s.name,
        'games', s.cnt,
        'fill_rate', s.fill
      ) order by s.cnt desc), '[]'::jsonb)
      from (
        select sp.name,
          count(*)::integer as cnt,
          round(avg(
            least(1.0, public.get_game_player_count(g.id)::numeric / nullif(g.maximum_players, 0))
          )::numeric, 3) as fill
        from public.games g
        join public.sports sp on sp.id = g.sport_id
        where g.game_date >= since and g.status <> 'draft'
        group by sp.name
      ) s
    ),
    'per_city', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'city', c.city,
        'games', c.cnt
      ) order by c.cnt desc), '[]'::jsonb)
      from (
        select coalesce(nullif(trim(v.city), ''), 'Unknown') as city,
          count(*)::integer as cnt
        from public.games g
        left join public.venues v on v.id = g.venue_id
        where g.game_date >= since and g.status <> 'draft'
        group by 1
        order by 2 desc
        limit 20
      ) c
    )
  );
end;
$$;

create or replace function public.admin_venue_insights()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_playr_admin();

  return jsonb_build_object(
    'by_status', (
      select coalesce(jsonb_object_agg(status, cnt), '{}'::jsonb)
      from (
        select v.status::text as status, count(*)::integer as cnt
        from public.venues v
        group by v.status
      ) s
    ),
    'most_used', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', m.id,
        'name', m.name,
        'status', m.status,
        'games', m.games,
        'fill_rate', m.fill
      ) order by m.games desc), '[]'::jsonb)
      from (
        select v.id, v.name, v.status::text as status,
          count(g.id)::integer as games,
          case when count(g.id) = 0 then null
            else round(avg(
              least(1.0, public.get_game_player_count(g.id)::numeric / nullif(g.maximum_players, 0))
            )::numeric, 3) end as fill
        from public.venues v
        left join public.games g on g.venue_id = v.id and g.status <> 'draft'
        group by v.id, v.name, v.status
        having count(g.id) > 0
        order by count(g.id) desc
        limit 20
      ) m
    )
  );
end;
$$;

grant execute on function public.admin_game_insights(integer) to authenticated;
grant execute on function public.admin_venue_insights() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Re-seed admin allowlist (idempotent)
-- ---------------------------------------------------------------------------

insert into public.playr_admins (user_id, email)
select u.id, u.email
from auth.users u
where lower(u.email) in (
  lower('admin@gmail.com'),
  lower('shibushabas23@gmail.com')
)
on conflict (user_id) do update
set email = excluded.email;

-- ---------------------------------------------------------------------------
-- 5. Indexes for new admin analytics filters (evidence: status + date scans)
-- ---------------------------------------------------------------------------

create index if not exists games_game_date_status_idx
  on public.games (game_date, status);

create index if not exists profiles_created_at_idx
  on public.profiles (created_at desc);
