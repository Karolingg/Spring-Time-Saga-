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

## Step 6: Wire Up the Login Page

The login page at `app/auth/page.tsx` currently has placeholder logic. To make it functional:

1. Replace the placeholder timeout in the `handleFormSubmit` function with the real auth call.
2. The function should look like this:

```tsx
import { loginWithEmail } from '../../src/services/auth-service';

async function handleFormSubmit(event: React.FormEvent) {
  event.preventDefault();
  setIsLoading(true);
  setErrorMessage('');
  try {
    await loginWithEmail(email, password);
    window.location.href = '/';
  } catch (err) {
    setErrorMessage((err as Error).message);
  } finally {
    setIsLoading(false);
  }
}
```

---

## Step 7: Add the Auth Provider to Your Layout

To enable the auth bar (login/logout buttons) on all pages, wrap children in the `Providers` component.

In `app/layout.tsx`, import and wrap:

```tsx
import { Providers } from './providers';

// Inside the <body> tag:
<body>
  <Providers>
    {children}
  </Providers>
</body>
```

This adds the `AuthProvider` (session tracking) and `AuthBar` (login/logout UI) without modifying any other existing code.

---

## Step 8: Verify the Connection

1. Run the dev server:
   ```bash
   npm run dev
   ```
2. Open `http://localhost:3000` — you should be redirected to `/auth`.
3. Log in with the test user you created in Step 5.
4. On success, you should be redirected to the main dashboard.

---

## File Overview

| File | Purpose |
|---|---|
| `.env.local` | Supabase URL and anon key |
| `src/lib/supabase-client.ts` | Creates and exports the Supabase client |
| `src/services/auth-service.ts` | Auth functions: login, sign-up, logout, session |
| `src/context/auth-context.tsx` | React context for auth state across the app |
| `app/auth/page.tsx` | Login page (matching existing UI) |
| `app/providers.tsx` | Wraps app with AuthProvider and AuthBar |
| `components/auth/auth-bar.tsx` | Top-right login/logout buttons |
| `middleware.ts` | Redirects unauthenticated users to /auth |

---

## Troubleshooting

- **"Missing Supabase environment variables"** — make sure `.env.local` has real values and restart the dev server.
- **Redirect loop on /auth** — make sure the middleware excludes `/auth` paths (it does by default).
- **"Invalid login credentials"** — verify the user exists in Supabase dashboard under Authentication > Users.
- **Cookie not set after login** — Supabase JS client stores the session in localStorage by default. The middleware cookie check is a secondary gate; for full SSR cookie-based auth, consider `@supabase/ssr`.
