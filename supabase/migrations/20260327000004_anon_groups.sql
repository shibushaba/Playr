-- Public recurring group discovery for guests
create policy groups_select_anon_public
on public.recurring_groups for select
to anon
using (visibility = 'public' and is_active = true);

grant select on table public.recurring_groups to anon;
