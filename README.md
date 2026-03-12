# EVACSIM — Crowd Evacuation Simulator

Agent-based crowd evacuation simulator with predictive congestion analysis for the UP Cebu campus.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env.local
# Then open .env.local and fill in your Supabase credentials
# (Get them from https://supabase.com/dashboard → Project Settings → API)

# 3. Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
app/              → Next.js pages (dashboard, simulate, analysis, map, auth, settings)
components/       → Reusable UI components (Navbar, MapView, etc.)
src/
  config/         → Supabase client setup
  context/        → React context providers (Auth)
  hooks/          → Custom hooks (useAuth)
  schema/         → TypeScript types & enums for the database
  services/       → Data access layer (auth, simulation, user)
styles/           → Global and component CSS
supabase/         → Database migrations
docs/             → Guidelines and documentation
```

## Tech Stack

- **Framework:** Next.js 16 + React 19
- **Language:** TypeScript 5
- **Database:** Supabase (PostgreSQL + Auth + RLS)
- **Styling:** Tailwind CSS 4 + CSS modules
- **Maps:** Leaflet + react-leaflet

## Database Setup

The SQL migration lives in `supabase/migrations/`. To apply it:

1. Go to your Supabase Dashboard → SQL Editor
2. Paste and run the contents of `supabase/migrations/20260312142037_create_normalized_schema.sql`

This creates 7 normalized tables with row-level security.
