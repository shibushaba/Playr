-- get_my_profile syncs email_verified_at, so it cannot be STABLE.
-- PostgREST runs STABLE no-arg RPCs in a read-only transaction (error 25006).

create or replace function public.get_my_profile()
returns jsonb
language plpgsql
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

revoke all on function public.get_my_profile() from public;
grant execute on function public.get_my_profile() to authenticated;
