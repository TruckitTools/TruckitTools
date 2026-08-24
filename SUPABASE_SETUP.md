# TruckitTools → Supabase setup

## 1. In Supabase SQL Editor, run this

```sql
-- Simple cloud store for loads / customers / carriers JSON
create table if not exists public.app_kv (
  key text primary key,
  value jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- Allow the anon key to read/write (OK for a single-broker private app).
-- Tighten with Auth + RLS policies when you add real multi-user logins.
alter table public.app_kv enable row level security;

drop policy if exists "anon read app_kv" on public.app_kv;
drop policy if exists "anon write app_kv" on public.app_kv;

create policy "anon read app_kv"
  on public.app_kv for select
  to anon
  using (true);

create policy "anon insert app_kv"
  on public.app_kv for insert
  to anon
  with check (true);

create policy "anon update app_kv"
  on public.app_kv for update
  to anon
  using (true)
  with check (true);

create policy "anon delete app_kv"
  on public.app_kv for delete
  to anon
  using (true);
```

## 2. Copy your API keys

Supabase dashboard → **Project Settings** → **API**:

- **Project URL** → e.g. `https://abcdefgh.supabase.co`
- **anon public** key → long `eyJ...` string

## 3. Upload these files to GitHub Pages (same folder as index.html)

- `cloud-sync.js`
- updated `loads.html`, `customers.html`, `carriers.html`, `index.html`, `customer-portal.html`

## 4. Configure the app (one time in the browser)

Open your live site → browser console (F12) → run:

```js
TruckitCloud.configure(
  'https://YOUR_PROJECT_REF.supabase.co',
  'YOUR_ANON_KEY'
)
location.reload()
```

Or use the **Cloud** button on Load Management (if present) to paste URL + key.

## 5. First-time data move

If you already have data in the browser:

1. Configure Supabase (step 4)
2. On Load Management, click **Upload local data to cloud**  
   (or in console: `await TruckitCloud.pushAllFromLocal()`)
3. On another device/browser: open the site (same config) → data pulls automatically on load

## 6. How it works

- On each page load: pull `truckit_loads`, `truckit_customers`, `truckit_carriers` from Supabase into localStorage
- On each save: write localStorage **and** push that key to Supabase
- Tracking sessions (`truckit_TR-...`) stay local for now (high-frequency GPS); can be cloud-synced later

## Security note

The **anon** key is meant to be in the frontend. With the policies above, **anyone who has your site URL + anon key could read/write this table**. That is acceptable only while you are the only user. Before other brokers use it, add Supabase Auth and stricter RLS.
