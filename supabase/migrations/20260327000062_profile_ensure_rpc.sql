-- Profile bootstrap + grants: client upsert was 403 when touching is_active on conflict.

create or replace function public.ensure_my_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row_out public.profiles;
  meta jsonb;
  display_name text;
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

  insert into public.profiles (id, display_name, is_active)
  values (uid, display_name, true)
  on conflict (id) do nothing;

  select * into row_out from public.profiles where id = uid;
  if not found then
    perform public.raise_playr_error('app_error', 'Could not create profile.');
  end if;

  return row_out;
end;
$$;

grant execute on function public.ensure_my_profile() to authenticated;

-- Re-assert insert grant (upsert / bootstrap)
grant insert (
  id, display_name, username, phone, avatar_url, bio,
  home_latitude, home_longitude, is_active
) on table public.profiles to authenticated;

grant execute on function public.get_my_profile() to authenticated;

grant execute on function public.update_my_profile(
  text, text, text, text, text, boolean, boolean
) to authenticated;
