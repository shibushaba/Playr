-- Host roster: expose participant phones only with contact consent + valid E164.

create or replace function public.get_game_contact_phone(
  p_game_id uuid,
  p_target_user_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  viewer uuid := auth.uid();
  g public.games%rowtype;
  phone_out text;
begin
  if viewer is null then
    return null;
  end if;

  select * into g from public.games where id = p_game_id;
  if not found then
    return null;
  end if;

  if public.is_blocked_between(viewer, p_target_user_id) then
    return null;
  end if;

  if viewer = p_target_user_id then
    select phone into phone_out from public.profiles where id = p_target_user_id;
    if phone_out is not null and public.is_valid_e164(phone_out) then
      return phone_out;
    end if;
    return null;
  end if;

  if public.is_game_host_or_cohost(p_game_id, viewer)
     and public.is_contact_eligible(p_game_id, p_target_user_id) then
    select p.phone into phone_out
    from public.profiles p
    inner join public.game_players gp
      on gp.user_id = p.id and gp.game_id = p_game_id
    where p.id = p_target_user_id
      and gp.contact_consent_at is not null
      and p.phone is not null
      and public.is_valid_e164(p.phone);

    return phone_out;
  end if;

  if public.is_contact_eligible(p_game_id, viewer)
     and p_target_user_id = g.host_id then
    select phone into phone_out from public.profiles where id = p_target_user_id;
    if phone_out is not null and public.is_valid_e164(phone_out) then
      return phone_out;
    end if;
    return null;
  end if;

  return null;
end;
$$;

create or replace function public.list_game_roster_contact_phones(p_game_id uuid)
returns table (user_id uuid, phone text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return;
  end if;

  if not public.is_game_host_or_cohost(p_game_id, uid) then
    return;
  end if;

  return query
  select p.id, p.phone
  from public.profiles p
  inner join public.game_players gp
    on gp.user_id = p.id and gp.game_id = p_game_id
  where p.id <> uid
    and gp.contact_consent_at is not null
    and gp.status in ('reserved', 'confirmed', 'attended', 'waitlisted')
    and (
      gp.status <> 'reserved'
      or gp.reservation_expires_at is null
      or gp.reservation_expires_at > timezone('utc', now())
    )
    and p.phone is not null
    and public.is_valid_e164(p.phone);
end;
$$;

revoke all on function public.get_game_contact_phone(uuid, uuid) from public;
grant execute on function public.get_game_contact_phone(uuid, uuid) to authenticated;

revoke all on function public.list_game_roster_contact_phones(uuid) from public;
grant execute on function public.list_game_roster_contact_phones(uuid) to authenticated;
