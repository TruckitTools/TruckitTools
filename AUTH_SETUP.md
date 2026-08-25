# TruckitTools – Supabase Auth setup

## 1. Enable Email auth
Supabase Dashboard → **Authentication** → **Providers** → **Email**
- Enable Email
- While testing: **Confirm email = OFF** (so new users can log in immediately)

## 2. Site URL (optional but recommended)
Authentication → URL configuration
- Site URL: `https://truckittools.github.io/TruckitTools`

## 3. First admin
1. Open **Admin Tools** on the home page
2. Enter your email + a password (6+ characters)
3. Tap **Create first admin**
4. Later visits: **Sign In** with that email/password

Old login `Admin` / `Truckit757` is retired.

## 4. Broker users
Admin Tools → Users → **+ New User**
- Email + password + profile fields
- Creates a Supabase Auth user with role `broker`
- After create, you may need to **sign in again as admin** (Supabase signs in the new user)

## 5. Broker Portal
Home → Broker Portal → email + password of a broker (or admin) account

## 6. Upload
- cloud-sync.js
- broker-auth.js
- admin-app.js
- admin.html (unchanged shell is fine)

## Security notes
- Anon key stays in the client (normal for Supabase web apps)
- Never put the **service_role** key in GitHub Pages
- For production multi-tenant: add RLS, private storage, and proper invite flows
