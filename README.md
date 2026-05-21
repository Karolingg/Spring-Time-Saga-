# EVACSIM — Crowd Evacuation Simulator

Agent-based crowd evacuation simulator with predictive congestion analysis for the UP Cebu campus. Model fire and earthquake scenarios across campus buildings, watch crowds evacuate in real time, and surface bottlenecks before they become real-world risks.

## Features

- **Campus map** — interactive map of UP Cebu buildings; pick a building to drill.
- **Disaster scenarios** — fire and earthquake drills with placeable hazards (fire, smoke, debris) that grow and spread over time.
- **Two drill modes** — *manual* (draw an evacuation path yourself) and *autonomous* (an agent-based crowd that pathfinds to exits on its own).
- **Adaptive agent routing** — Dijkstra-based pathfinding with live rerouting: agents avoid blocked corridors, smoke, and the danger radius of spreading fire.
- **Congestion heatmaps** — spatial density maps and time-lapse replay of agent movement, clipped to the building footprint.
- **Run analysis** — per-run zone analysis, bottleneck identification, and key evacuation metrics (including the evacuated-rate outcome).
- **Aggregate insights** — cross-run floor heatmaps, drill-over-drill trends, and zone trends.
- **Side-by-side comparison** — compare two completed runs to see which KPIs improved or regressed.
- **Generated reports** — printable per-run reports with summary stats and crowd heatmap.

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
app/               → Next.js pages
  page.tsx           → Dashboard (campus readiness, recent drills)
  map/               → Interactive campus map
  simulate/[id]/     → Disaster setup, manual run, autonomous drill
  analysis/          → Run analysis, summary, compare, generated reports
  auth/, settings/   → Authentication and user settings
components/         → Reusable UI components (Navbar, MapView, analysis widgets)
src/
  config/           → Supabase client setup
  context/          → React context providers (Auth)
  hooks/            → Custom hooks (useAuth)
  schema/           → TypeScript types & enums for the database
  services/         → Data access layer (auth, simulation, analytics)
  simulation/       → Agent-based engine: pathfinding, hazards, building model
styles/             → Global and component CSS
supabase/           → Database migrations
docs/               → Guidelines and documentation
```

## Tech Stack

- **Framework:** Next.js 16 + React 19
- **Language:** TypeScript 5
- **Database:** Supabase (PostgreSQL + Auth + RLS)
- **Styling:** Tailwind CSS 4 + CSS modules
- **Maps:** Mapbox GL via `react-map-gl`

## Database Setup

The SQL migrations live in `supabase/migrations/`. To set up your Supabase database:

### Option A: Via Supabase SQL Editor (Hosted Supabase)
If you are using a hosted Supabase project, go to your **Supabase Dashboard → SQL Editor** and paste and run the contents of the migration files in `supabase/migrations/` in chronological order:

1. `20260312142037_create_normalized_schema.sql` (Creates core tables: runs, configs, results, bottlenecks, density)
2. `20260410_add_buildings_audit_tags.sql` (Adds buildings list and audit logs)
3. `20260512_add_run_floor_index.sql` (Adds index for floor runs)
4. `20260513_add_run_replay_inputs.sql` (Adds input properties for run replay)
5. `20260515_fix_oauth_profile_trigger_and_rls.sql` (Fixes OAuth profile creation triggers and RLS policies)
6. `20260516_add_scenario_severity.sql` (Adds drill severity variables for readiness metrics)
7. `20260517_add_rate_limiting.sql` (Creates rate limiter table and procedures)
8. `20260518_add_rate_limit_rules.sql` (Seeds rate-limiting policies for public endpoints)
9. `20260519_update_rate_limit_messages.sql` (Updates rate-limiting feedback responses)

### Option B: Via Supabase CLI (Local Development)
If you are developing locally with the Supabase CLI:
1. Ensure your local Supabase instance is running: `npx supabase start`
2. Apply migrations automatically: `npx supabase db push`

