# Deploy PLAYR on Vercel

Frontend-only deploy. Supabase stays on your Supabase project (migrations + pg_cron already applied).

## 1. Push to GitHub

Vercel imports from Git. Ensure the repo is pushed:

```bash
git push origin main
```

## 2. Create Vercel project

1. [vercel.com/new](https://vercel.com/new) → Import your PLAYR repo.
2. Framework preset: **Vite** (auto-detected).
3. Build command: `npm run build`
4. Output directory: `dist`
5. Do **not** deploy until env vars are set (step 3).

## 3. Environment variables (Vercel → Settings → Environment Variables)

Add for **Production** (and Preview if you want staging):

| Name | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://YOUR_PROJECT.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase **anon / publishable** key |

Optional:

| Name | Value |
| --- | --- |
| `VITE_MAP_PROVIDER_KEY` | Google Maps JavaScript + Places API key |

Never add the Supabase **service_role** key to Vercel — it belongs only on the server / Supabase.

## 4. Supabase Auth URLs

In Supabase Dashboard → **Authentication** → **URL Configuration**:

- **Site URL**: `https://playr-nine.vercel.app`
- **Redirect URLs** (add all that apply):
  - `https://playr-nine.vercel.app`
  - `https://playr-nine.vercel.app/auth`
  - `http://localhost:5173/**` (local dev)

Email confirmation links use `emailRedirectTo` → `/auth` on your deployed domain.

## 5. Google Maps key (optional)

If using `VITE_MAP_PROVIDER_KEY`, restrict the key in Google Cloud Console:

- **HTTP referrers**: `https://YOUR_APP.vercel.app/*`, `http://localhost:5173/*`
- APIs: Maps JavaScript API, Places API

## 6. Deploy

Click **Deploy** or push to `main` if Git integration is connected.

Direct links like `/games/:id` and `/join/game/:token` work via SPA rewrites in `vercel.json`.

## 7. Post-deploy checklist

- [ ] Landing page loads
- [ ] Sign in / sign up works
- [ ] Home shows nearby games (location permission)
- [ ] Game details, join, host, chat work
- [ ] Invite link copies as `https://YOUR_APP.vercel.app/join/game/...`
- [ ] Supabase Dashboard → Database → Extensions → **pg_cron** → job `playr-engine-tick` active

Quick SQL (Supabase SQL Editor):

```sql
select jobname, schedule, active from cron.job where jobname = 'playr-engine-tick';
select public.run_playr_engine_tick();
```

## 8. Custom domain (optional)

Vercel → Settings → Domains → add your domain.

Then update Supabase **Site URL** and **Redirect URLs** to the custom domain, and Google Maps referrer restrictions.

## Troubleshooting

| Issue | Fix |
| --- | --- |
| Blank app / "Supabase is not configured" | Set `VITE_*` env vars on Vercel and **redeploy** (env is baked at build time) |
| Sign in fails with generic error | Same — redeploy after env vars; check Supabase anon key is correct |
| 404 on refresh at `/games/...` | Ensure `vercel.json` rewrites are committed |
| Auth email link goes to localhost | Update Supabase Site URL to production domain |
| Maps search empty | Add `VITE_MAP_PROVIDER_KEY` + domain restriction |
| Games don't confirm/cancel on time | Verify pg_cron on Supabase (not Vercel) |
