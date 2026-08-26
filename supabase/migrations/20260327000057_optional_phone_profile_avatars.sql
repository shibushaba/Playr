-- Phone is optional and editable on the profile. Do not block join / host / venue.
-- Players can add a photo and change contact details anytime.

create or replace function public.profile_has_verified_phone(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- Compatibility helper: phone verification is no longer required.
  select true;
$$;

drop policy if exists groups_insert_host on public.recurring_groups;

create policy groups_insert_host
on public.recurring_groups for insert
to authenticated
with check (host_id = auth.uid());

-- ---------------------------------------------------------------------------
-- update_my_profile — name, username, bio, phone, avatar (no OTP)
-- ---------------------------------------------------------------------------

create or replace function public.update_my_profile(
  p_display_name text default null,
  p_username text default null,
  p_bio text default null,
  p_phone text default null,
  p_avatar_url text default null,
  p_clear_phone boolean default false,
  p_clear_avatar boolean default false
)
returns public.profiles
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

  return row_out;
end;
$$;

grant execute on function public.update_my_profile(
  text, text, text, text, text, boolean, boolean
) to authenticated;

-- ---------------------------------------------------------------------------
-- Avatars bucket (public read, own write)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatars_public_read on storage.objects;
drop policy if exists avatars_insert_own on storage.objects;
drop policy if exists avatars_update_own on storage.objects;
drop policy if exists avatars_delete_own on storage.objects;

create policy avatars_public_read
on storage.objects for select
using (bucket_id = 'avatars');

create policy avatars_insert_own
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy avatars_update_own
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars'
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy avatars_delete_own
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatars'
  and split_part(name, '/', 1) = auth.uid()::text
);
