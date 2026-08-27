-- App feedback and suggestions from signed-in users

create table if not exists public.app_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'feedback',
  message text not null,
  page_path text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint app_feedback_kind_check check (kind in ('feedback', 'suggestion')),
  constraint app_feedback_message_len check (char_length(trim(message)) between 3 and 2000)
);

create index if not exists app_feedback_user_idx on public.app_feedback (user_id);
create index if not exists app_feedback_created_idx on public.app_feedback (created_at desc);

alter table public.app_feedback enable row level security;

drop policy if exists app_feedback_insert_own on public.app_feedback;
create policy app_feedback_insert_own
on public.app_feedback for insert
to authenticated
with check (user_id = auth.uid());

revoke all on table public.app_feedback from anon;
revoke all on table public.app_feedback from authenticated;
grant insert on table public.app_feedback to authenticated;

create or replace function public.submit_app_feedback(
  p_kind text,
  p_message text,
  p_page_path text default null
)
returns public.app_feedback
language plpgsql
security definer
set search_path = public
as $$
declare
  row_out public.app_feedback;
  uid uuid := auth.uid();
  trimmed text := trim(p_message);
begin
  if uid is null then
    raise exception 'Please sign in.' using errcode = 'P0001';
  end if;

  if trimmed is null or char_length(trimmed) < 3 then
    raise exception 'Write a little more detail.' using errcode = 'P0001';
  end if;

  if p_kind is null or p_kind not in ('feedback', 'suggestion') then
    raise exception 'Invalid feedback type.' using errcode = 'P0001';
  end if;

  insert into public.app_feedback (user_id, kind, message, page_path)
  values (
    uid,
    p_kind,
    trimmed,
    nullif(trim(p_page_path), '')
  )
  returning * into row_out;

  return row_out;
end;
$$;

revoke all on function public.submit_app_feedback(text, text, text) from public;
grant execute on function public.submit_app_feedback(text, text, text) to authenticated;
