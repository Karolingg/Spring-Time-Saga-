# EVACSIM — Vercel Deployment & Production Readiness Guide

This guide provides a comprehensive walkthrough for deploying the EVACSIM Crowd Evacuation Simulator to **Vercel** and configuring **Supabase** for production.

Next.js App Router applications are developed by Vercel and deploy natively with zero configuration. Because EVACSIM is largely client-rendered (`'use client'`) and communicates directly with Supabase via browser services, the deployment process is highly straightforward.

---

## 🛠️ Step 1: Prepare Your Supabase Database

Your Next.js frontend relies on a fully initialized Supabase Postgres database. You must apply the database migrations in chronological order before running the application in production.

### Option A: Apply via Supabase SQL Editor (Recommended)
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard) and select your project.
2. Click on **SQL Editor** in the left sidebar.
3. Click **New Query**.
4. Paste and execute the contents of the files in `supabase/migrations/` in the following exact order:
   1. `20260312142037_create_normalized_schema.sql` (Creates core tables: runs, configs, results, bottlenecks, density)
   2. `20260410_add_buildings_audit_tags.sql` (Creates buildings list and audit logs)
   3. `20260512_add_run_floor_index.sql` (Creates index for floor runs)
   4. `20260513_add_run_replay_inputs.sql` (Creates input properties for run replay)
   5. `20260515_fix_oauth_profile_trigger_and_rls.sql` (Fixes OAuth profile creation triggers and RLS policies)
   6. `20260516_add_scenario_severity.sql` (Creates drill severity variables for readiness metrics)
   7. `20260517_add_rate_limiting.sql` (Creates rate limiter table and procedures)
   8. `20260518_add_rate_limit_rules.sql` (Seeds rate-limiting policies for public endpoints)
   9. `20260519_update_rate_limit_messages.sql` (Updates rate-limiting feedback responses)

### Option B: Apply via Supabase CLI
If you manage your database locally:
1. Ensure your local Supabase instance is running: `npx supabase start`
2. Link your CLI to your remote project: `npx supabase link --project-ref your-supabase-project-id`
3. Push all migrations: `npx supabase db push`

---

## 🚀 Step 2: Deploy to Vercel

Vercel provides seamless GitHub integration that triggers automatic builds and deployments on every `git push`.

### 1. Import Repository
1. Log in to [Vercel](https://vercel.com).
2. Click **Add New > Project**.
3. Import your GitHub repository (`Karolingg/Spring-Time-Saga-`).

### 2. Configure Environment Variables
In the **Environment Variables** section of the Vercel project creation screen, add the following variables (refer to our `.env.example` in the project root):

| Key | Value Source |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API → `anon` `public` key |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox Account Dashboard → Access Token |

Ensure all variables are checked for **Production**, **Preview**, and **Development** scopes so they are available in all build types.

### 3. Deploy
1. Click **Deploy**.
2. Vercel will compile the Next.js App Router configuration and optimize static assets. The build will take around 1–2 minutes.
3. Once completed, Vercel will provide your live deployment URL (e.g., `https://evacsim.vercel.app`).

---

## 🔐 Step 3: Configure Supabase Auth Redirect URLs

Since EVACSIM supports Google OAuth and email activation flows, Supabase Auth must know which domains are authorized to redirect back to.

1. Go to your **Supabase Dashboard → Authentication → URL Configuration**.
2. In the **Site URL** field, set your main Vercel production domain:
   ```
   https://your-app-name.vercel.app/
   ```
3. In the **Redirect URLs** section, click **Add URL** and add your callback route:
   ```
   https://your-app-name.vercel.app/auth/callback
   ```
4. Click **Save**.

Keep `http://localhost:3000` and `http://localhost:3000/auth/callback` in the Redirect URLs list so you can continue testing authentication flows in local development.

---

## 🔍 Codebase Improvements Completed

We have checked the codebase and implemented the following improvements to guarantee a smooth production build and flawless client execution:

### 1. Mapped Case-Sensitive SVG Asset Mismatch (Critical)
* **Problem**: In `src/simulation/floor-config/to-floor-model.ts`, the mapping for the Social Sciences building pointed to `/floorplans/Ug%202nd%20floor.svg` (lowercase `g`). However, the actual SVG file in `public/floorplans/` was named `UG 2nd floor.svg` (uppercase `G`).
* **Impact**: Local Windows development environments are case-insensitive, so it worked locally. However, Vercel runs on **Linux** (which is case-sensitive), resulting in a broken image (404) for the floorplan layout.
* **Resolution**: Updated `Ug%202nd%20floor.svg` to `UG%202nd%20floor.svg` in `to-floor-model.ts` to perfectly align with the filesystem.

### 2. Created Missing `.env.example`
* **Problem**: Stale references in the codebase instructed developers to copy `.env.example`, but the file was missing in the repository.
* **Resolution**: Created a clean `.env.example` in the root of the project with clear inline guides for `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_MAPBOX_TOKEN`.

### 3. Cleaned Up `README.md`
* **Problem**: The README pointed to the outdated Leaflet/react-leaflet mapping packages (when Mapbox has been implemented) and documented only the first database migration.
* **Resolution**: Updated the Tech Stack section to specify Mapbox GL and react-map-gl, and documented the correct order of execution for all 9 schema migrations.

### 4. Aligned `docs/supabase-setup-guide.md`
* **Problem**: The guide contained outdated instructions to wire a "placeholder auth page" and reference folders like `src/lib/supabase-client.ts` that had since been cleaned up and standardized.
* **Resolution**: Refactored the guide to reflect real, completed auth integrations and corrected all references to files (e.g. `src/config/supabase.ts`, `src/services/auth.service.ts`).

---

## 🚦 Post-Deployment Smoke Test Checklist

Once Vercel reports a successful build:
- **Auth Gating**: Access `https://your-app.vercel.app`. You should be redirected automatically to `/auth`.
- **OAuth login**: Click **Continue with Google**. Authenticate and verify you redirect back cleanly to `/` without errors.
- **Interactive Map**: Access `/map`. Confirm Mapbox tiles load and buildings render with correct pitch and hover highlights.
- **Drill Run**: Start an autonomous simulation from `/simulate/science-building/disaster`. Let it finish and verify you can view saved heatmaps and bottlenecks in `/analysis/runs`.
