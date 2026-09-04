-- Return own profile as jsonb so PostgREST does not strip `phone`.
-- Column grants hide profiles.phone from table-typed RPC responses.

drop function if exists public.get_my_profile();
drop function if exists public.ensure_my_profile();
drop function if exists public.update_my_profile(text, text, text, text, text, boolean, boolean);

create or replace function public.get_my_profile()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
  row_out public.profiles;
begin
  if uid is null then
    return null;
  end if;

  perform public.sync_profile_email_verified(uid);
  select * into row_out from public.profiles where id = uid;
  if not found then
    return null;
  end if;
  return to_jsonb(row_out);
end;
$$;

create or replace function public.ensure_my_profile()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
  row_out public.profiles;
  meta jsonb;
  display_name text;
  phone_val text;
begin
  if uid is null then
    perform public.raise_playr_error('UNAUTHENTICATED', 'Please sign in.');
  end if;

  select * into row_out from public.profiles where id = uid;
  if found then
    return to_jsonb(row_out);
  end if;

  meta := coalesce(
    (select raw_user_meta_data from auth.users where id = uid),
    '{}'::jsonb
  );
  display_name := nullif(
    trim(coalesce(meta ->> 'display_name', meta ->> 'full_name', '')),
    ''
  );
  phone_val := public.normalize_phone_e164(coalesce(meta ->> 'phone', ''));
  if phone_val is not null and not public.is_valid_e164(phone_val) then
    phone_val := null;
  end if;

  insert into public.profiles (id, display_name, phone, is_active)
  values (uid, display_name, phone_val, true)
  on conflict (id) do nothing;

  select * into row_out from public.profiles where id = uid;
  if not found then
    perform public.raise_playr_error('app_error', 'Could not create profile.');
  end if;

  return to_jsonb(row_out);
end;
$$;

create or replace function public.update_my_profile(
  p_display_name text default null,
  p_username text default null,
  p_bio text default null,
  p_phone text default null,
  p_avatar_url text default null,
  p_clear_phone boolean default false,
  p_clear_avatar boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  normalized_phone text;
  uname text;
  row_out public.profiles;
begin
  if uid is null then
    perform public.raise_playr_error('UNAUTHENTICATED', 'Please sign in.');
  end if;

  insert into public.profiles (id, is_active)
  values (uid, true)
  on conflict (id) do nothing;

  if p_clear_phone then
    normalized_phone := null;
  elsif p_phone is not null then
    if length(trim(p_phone)) = 0 then
      normalized_phone := null;
    else
      normalized_phone := public.normalize_phone_e164(p_phone);
      if not public.is_valid_e164(normalized_phone) then
        perform public.raise_playr_error('INVALID_PHONE', 'Enter a valid phone number.');
      end if;
    end if;
  end if;

  if p_username is not null then
    uname := nullif(lower(trim(p_username)), '');
    if uname is not null and uname !~ '^[a-z0-9_]{3,30}$' then
      perform public.raise_playr_error(
        'INVALID_USERNAME',
        'Username must be 3–30 letters, numbers, or underscores.'
      );
    end if;
  end if;

  begin
    update public.profiles
    set
      display_name = case
        when p_display_name is not null then nullif(btrim(p_display_name), '')
        else display_name
      end,
      username = case
        when p_username is not null then uname
        else username
      end,
      bio = case
        when p_bio is not null then nullif(btrim(p_bio), '')
        else bio
      end,
      phone = case
        when p_clear_phone then null
        when p_phone is not null then normalized_phone
        else phone
      end,
      phone_verified_at = case
        when p_clear_phone or p_phone is not null then null
        else phone_verified_at
      end,
      avatar_url = case
        when p_clear_avatar then null
        when p_avatar_url is not null then nullif(btrim(p_avatar_url), '')
        else avatar_url
      end,
      updated_at = timezone('utc', now())
    where id = uid
    returning * into row_out;
  exception
    when unique_violation then
      perform public.raise_playr_error('USERNAME_TAKEN', 'That username is taken.');
  end;

  if row_out is null then
    perform public.raise_playr_error('NOT_FOUND', 'Profile not found.');
  end if;

  return to_jsonb(row_out);
end;
$$;

revoke all on function public.get_my_profile() from public;
revoke all on function public.ensure_my_profile() from public;
revoke all on function public.update_my_profile(text, text, text, text, text, boolean, boolean) from public;

grant execute on function public.get_my_profile() to authenticated;
grant execute on function public.ensure_my_profile() to authenticated;
grant execute on function public.update_my_profile(
  text, text, text, text, text, boolean, boolean
) to authenticated;
