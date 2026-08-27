-- Signup phone: normalize on auth trigger + bootstrap profile with phone from metadata.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  display_name_val text;
  username_val text;
  phone_val text;
begin
  display_name_val := nullif(
    trim(coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', '')),
    ''
  );
  username_val := nullif(lower(trim(coalesce(new.raw_user_meta_data ->> 'username', ''))), '');
  phone_val := public.normalize_phone_e164(coalesce(new.raw_user_meta_data ->> 'phone', ''));
  if phone_val is not null and not public.is_valid_e164(phone_val) then
    phone_val := null;
  end if;

  insert into public.profiles (id, display_name, username, phone)
  values (new.id, display_name_val, username_val, phone_val)
  on conflict (id) do update
  set
    display_name = coalesce(public.profiles.display_name, excluded.display_name),
    username = coalesce(public.profiles.username, excluded.username),
    phone = coalesce(public.profiles.phone, excluded.phone);

  return new;
exception
  when others then
    raise warning 'PLAYR profile create failed for %: %', new.id, sqlerrm;
    return new;
end;
$$;

create or replace function public.ensure_my_profile()
returns public.profiles
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
    return row_out;
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

  return row_out;
end;
$$;
