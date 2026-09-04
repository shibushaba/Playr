-- Production launch: wipe test users and operational data.
-- Keep catalog: sports, discovery_areas, playr_settings.

-- ---------------------------------------------------------------------------
-- 1. Admin email allowlist (survives user wipe; re-binds on signup)
-- ---------------------------------------------------------------------------

create table if not exists public.playr_admin_emails (
  email text primary key,
  created_at timestamptz not null default timezone('utc', now()),
  constraint playr_admin_emails_lower check (email = lower(email))
);

alter table public.playr_admin_emails enable row level security;
revoke all on table public.playr_admin_emails from anon, authenticated;

insert into public.playr_admin_emails (email) values
  ('admin@gmail.com'),
  ('shibushabas23@gmail.com')
on conflict (email) do nothing;

create or replace function public.sync_playr_admin_for_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  user_email text;
begin
  if p_user_id is null then
    return;
  end if;

  select lower(email) into user_email
  from auth.users
  where id = p_user_id;

  if user_email is null then
    return;
  end if;

  if exists (
    select 1 from public.playr_admin_emails e where e.email = user_email
  ) then
    insert into public.playr_admins (user_id, email)
    values (p_user_id, user_email)
    on conflict (user_id) do update
    set email = excluded.email;
  end if;
end;
$$;

create or replace function public.trg_profiles_sync_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_playr_admin_for_user(new.id);
  return new;
end;
$$;

drop trigger if exists profiles_sync_admin on public.profiles;
create trigger profiles_sync_admin
after insert on public.profiles
for each row execute function public.trg_profiles_sync_admin();

create or replace function public.is_playr_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(p_user_id, auth.uid()) is not null
  and (
    exists (
      select 1
      from public.playr_admins a
      where a.user_id = coalesce(p_user_id, auth.uid())
    )
    or exists (
      select 1
      from auth.users u
      join public.playr_admin_emails e on e.email = lower(u.email)
      where u.id = coalesce(p_user_id, auth.uid())
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. Production settings
-- ---------------------------------------------------------------------------

update public.playr_settings
set value = coalesce(value, '{}'::jsonb)
  || jsonb_build_object('expose_phone_verification_codes', false)
where key = 'trust';

insert into public.playr_settings (key, value)
select 'trust', '{"expose_phone_verification_codes": false}'::jsonb
where not exists (select 1 from public.playr_settings where key = 'trust');

-- ---------------------------------------------------------------------------
-- 3. Wipe operational data (not sports / discovery_areas / settings)
-- ---------------------------------------------------------------------------

truncate table
  public.app_feedback,
  public.check_ins,
  public.game_attendance_feedback,
  public.game_events,
  public.game_experience_feedback,
  public.game_invites,
  public.game_messages,
  public.game_players,
  public.game_rsvps,
  public.games,
  public.group_invites,
  public.moderation_actions,
  public.notifications,
  public.phone_verification_challenges,
  public.playr_admins,
  public.profiles,
  public.recurring_group_members,
  public.recurring_groups,
  public.reports,
  public.user_blocks,
  public.venue_edit_requests,
  public.venue_submissions,
  public.venues
restart identity cascade;

delete from auth.users;

drop function if exists public.playr_seed_demo_user(uuid, text, text, text, text);
