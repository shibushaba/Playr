-- Allow anonymous discovery to read public profile fields (no phone)
grant select (
  id, display_name, username, avatar_url, bio,
  home_latitude, home_longitude, is_active, created_at, updated_at
) on table public.profiles to anon;

create policy profiles_select_anon
on public.profiles for select
to anon
using (is_active = true);
