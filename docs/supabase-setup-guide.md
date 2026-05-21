# Supabase Setup Guide

Step-by-step guide to connect this project to Supabase for authentication.

---

## Step 1: Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign up or log in.
2. Click **New Project**.
3. Choose your organization (or create one).
4. Fill in:
   - **Project name**: `evacuation-simulator` (or any name)
   - **Database password**: choose a strong password (save it somewhere safe)
   - **Region**: pick the closest to your users
5. Click **Create new project** and wait for it to finish provisioning.

---

## Step 2: Get Your API Keys

1. In your Supabase dashboard, go to **Settings > API**.
2. Copy these two values:
   - **Project URL** — looks like `https://abcdefgh.supabase.co`
   - **anon / public key** — a long JWT string

---

## Step 3: Configure Environment Variables

1. Open the `.env.local` file in the project root.
2. Replace the placeholder values:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

3. Save the file. **Never commit `.env.local` to version control.**

---

## Step 4: Enable Email Auth in Supabase

1. In your Supabase dashboard, go to **Authentication > Providers**.
2. Make sure **Email** is enabled (it is by default).
3. Optionally, under **Authentication > Settings**:
   - Disable **Confirm email** if you want instant login during development.
   - Set the **Site URL** to `http://localhost:3000`.

---

## Step 5: Create a Test User

Option A — via the Supabase dashboard:
1. Go to **Authentication > Users**.
2. Click **Add user > Create new user**.
3. Enter an email and password.

Option B — via the app (if sign-up is wired):
1. You can add a sign-up form later using `signUpWithEmail()` from `src/services/auth-service.ts`.

---

## Step 6: Verified Login Flow

The login page at `app/auth/page.tsx` is already fully implemented and wired to the Supabase authentication services. It supports:
1. **Email & Password login** (via `loginWithEmail(email, password)`)
2. **Email & Password registration** (via `signUpWithEmail(email, password)`)
3. **Google OAuth sign-in** (via `loginWithGoogle()`)

No boilerplate or manual wiring is required! The page automatically handles input, shows loading indicators, handles cooldown timers, and displays descriptive error and success messages.

---

## Step 7: Auth Provider and Page Gating

The application is structured to automatically gate protected pages at the layout level:
1. `app/layout.tsx` imports the global `Providers` component.
2. `app/providers.tsx` wraps children with `AuthProvider` (`src/context/AuthContext.tsx`) and renders the modern sidebar `Navbar` (`components/Navbar.tsx`) for authenticated sessions.
3. Individual protected pages use the custom `useAuth()` hook to check session validity and seamlessly redirect unauthenticated users back to `/auth` on the client side.

---

## Step 8: Verify the Connection

1. Restart your development server if environment variables were changed:
   ```bash
   npm run dev
   ```
2. Open `http://localhost:3000` — you will be automatically redirected to `/auth`.
3. Create a test account or use Google sign-in.
4. On success, you will be redirected to the main dashboard (`/`).

---

## File Overview

| File | Purpose |
|---|---|
| `.env.local` | Custom environment variables (Supabase URL, anon key, Mapbox token) |
| `src/config/supabase.ts` | Creates and exports the Supabase JS client with standard TypeScript schemas |
| `src/services/auth.service.ts` | Auth API service functions (Google sign-in, Email signup/login, signOut, getSession) |
| `src/context/AuthContext.tsx` | React Context and hooks (`useAuth`) that manage user session state and auto-gate routes |
| `app/auth/page.tsx` | Complete responsive login/register page with built-in Google OAuth trigger |
| `app/providers.tsx` | App wrapper setting up auth contexts, sidebar offset margins, and responsive layouts |
| `components/Navbar.tsx` | Sidebar navigation, account profiles panel, and sign-out UI control |

---

## Troubleshooting

- **"Missing Supabase environment variables"** — Ensure `.env.local` has your credentials and restart the Next.js development server.
- **"Google sign-in redirect fails"** — Ensure your production site URL (e.g. `https://your-app.vercel.app`) or local development URL is whitelisted in your **Supabase Dashboard → Auth → URL Configuration**.
- **"Invalid login credentials"** — Confirm the user exists in your Supabase project under **Authentication → Users**.
- **"TypeScript Schema lag"** — If you add database columns, you can regenerate types using the Supabase CLI: `npx supabase gen types typescript --project-id your-project-id > src/schema/database.types.ts`.

