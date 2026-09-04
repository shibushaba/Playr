# PLAYR

Find people. Find a game. Play.

Local pickup-sports platform — React, Vite, TypeScript, Tailwind CSS, Supabase.

## Product rules (do not change)

- PLAYR does **not** handle money (no payments, wallets, or gateways).
- Hosts are responsible for venue booking and payment.
- Games confirm or cancel automatically 3 hours before start based on min players.
- Temporary join reservations last up to 8 minutes (capped by confirmation deadline).

## Setup

1. Create a Supabase project.
2. Copy env example and fill publishable credentials only:

```bash
cp .env.example .env.local
```

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_or_publishable_key
```

Never put the service-role / secret key in the frontend or in git.

3. Apply migrations (Supabase CLI or SQL editor, in order):

```bash
npx supabase db push
# or run files under supabase/migrations/ in order
```

4. In Supabase Auth settings, enable the Email provider. For production, keep email confirmation **on**.

5. Install and run:

```bash
npm install
npm run dev
```

## Deploy to Vercel

See **[docs/DEPLOY_VERCEL.md](docs/DEPLOY_VERCEL.md)** for the full checklist (env vars, Supabase auth URLs, pg_cron verification).

Quick summary:

1. Import repo on Vercel (Vite preset, output `dist`).
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in Vercel env.
3. Set Supabase **Site URL** to your `*.vercel.app` domain.
4. Deploy.

```bash
npm run build   # verify locally before pushing
```

Admin access is email-allowlisted (`admin@gmail.com`, `shibushabas23@gmail.com`). Sign up with one of those addresses after a clean database — you become admin automatically.

## Structure

- `src/pages` — screens
- `src/components` — reusable UI
- `src/services` — Supabase data access
- `src/lib/supabase.ts` — browser client (publishable key only)
- `src/types/database.ts` — generated-style DB types
- `src/data/mock.ts` — unused legacy mock data
- `supabase/migrations` — schema, RLS, functions

## Security notes

- RLS enabled on all application tables
- Phone numbers are not selectable via normal profile queries; use `get_game_contact_phone` / `get_my_profile`
- Join/reserve goes through `join_game` RPC (8-minute hold stored as `reservation_expires_at`)
