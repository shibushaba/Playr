-- Add admin@gmail.com to playr_admins allowlist (safe if 66 already applied without this email)

insert into public.playr_admins (user_id, email)
select u.id, u.email
from auth.users u
where lower(u.email) = lower('admin@gmail.com')
on conflict (user_id) do nothing;
