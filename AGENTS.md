# AGENTS.md

## Project Overview

EVACSIM is a Next.js App Router application for agent-based evacuation simulation and congestion analysis for the University of the Philippines Cebu campus. Users authenticate with Supabase (email/password and Google OAuth), choose a campus building on a Mapbox map, run fire or earthquake evacuation scenarios, and review saved analysis data such as heatmaps, bottlenecks, CSV exports, reports, comparisons, and aggregate readiness metrics.

The app is primarily client-rendered. Most pages are marked `'use client'`, and backend work is handled directly from browser-side Supabase service modules under `src/services/`.

## Tech Stack

- Next.js 16.1.6 App Router: `app/`
- React 19.2.3
- TypeScript 5 with `strict: true`: `tsconfig.json`
- Supabase Auth and Postgres via `@supabase/supabase-js`: `src/config/supabase.ts`
- Mapbox / react-map-gl for campus map: `components/MapView.tsx`
- Tailwind CSS 4 PostCSS plugin plus global CSS variables and hand-written CSS: `postcss.config.mjs`, `styles/`
- Data/visualization helpers: D3 dependency is installed; current analysis views mainly use custom SVG/div rendering and simulation utilities.
- No automated test script is defined in `package.json`; available scripts are `dev`, `build`, `start`, and `lint`.

## Important Folders and Files

- `app/` - Next.js routes, layouts, and page-level state/flow.
- `app/layout.tsx` - Root layout, global CSS imports, Inter font setup, Mapbox CSS import, and `Providers` wrapper.
- `app/providers.tsx` - Wraps the app in `AuthProvider`, renders `Navbar`, and offsets authenticated pages by sidebar width.
- `app/page.tsx` - Auth-gated dashboard with aggregate stats, recent drills, drill comparison preview, and quick actions.
- `app/auth/page.tsx` - Email/password sign-in/sign-up UI plus Google OAuth sign-in.
- `app/auth/callback/page.tsx` - Supabase OAuth code exchange and redirect.
- `app/map/page.tsx` - Hardcoded UP Cebu building list, Mapbox campus UI, building details, assembly point highlighting, and navigation to simulations.
- `app/simulate/[id]/disaster/page.tsx` - Disaster and floor picker. Routes selected floors to manual or autonomous simulation.
- `app/simulate/[id]/run/page.tsx` - Manual drill route/planning simulation with room/exit selection, route recommendations, hazards, rerouting, and local result display.
- `app/simulate/[id]/autonomous/page.tsx` - Autonomous multi-agent simulation, hazard placement, preset scenarios, run persistence, density trace persistence, and post-run metrics.
- `app/analysis/page.tsx` - Analysis landing page linking to runs, summary, and comparison.
- `app/analysis/runs/page.tsx` - Individual run analysis, run selector, delete/reset actions, CSV export, report link, heatmap/replay, zone analysis, and key metrics.
- `app/analysis/summary/page.tsx` - Aggregate floor heatmaps and aggregate zone trends.
- `app/analysis/compare/page.tsx` - Side-by-side run comparison with KPI deltas and heatmaps.
- `app/analysis/reports/[runId]/page.tsx` - Printable evacuation report for one run.
- `app/settings/page.tsx` - Account settings UI; profile display name uses Supabase profile services; email/password updates are available via Supabase auth APIs.
- `components/` - Shared UI components (`Navbar`, `MapView`, `ConfirmModal`, etc.).
- `components/analysis/` - Heatmaps, replay, aggregate analysis, run visualization, zone panels, and feature containers.
- `src/config/` - Supabase client, building floor counts, and assembly point data.
- `src/context/AuthContext.tsx` and `src/hooks/useAuth.ts` - Auth state and hook.
- `src/services/` - Supabase-facing data access: auth, user profile, simulation runs/results, audit logs, building analytics, CSV export.
- `src/schema/` - TypeScript app types and generated Supabase database types.
- `src/simulation/` - Core simulation models, engine, autonomous analytics, hazard physics/placement, grid tracing, presets, and authored floor configs.
- `src/simulation/floor-config/buildings/` - Per-building/floor evacuation graph definitions.
- `public/floorplans/` - Floorplan SVG assets served by the app.
- `supabase/migrations/` - SQL migrations for normalized schema and later run metadata additions.
- `docs/` - Project notes, specs, deployment readiness, coding practices, and setup documentation. Some docs are stale; verify against code before relying on them.

## How The App Works

1. `app/layout.tsx` loads global styles and wraps pages with `Providers`.
2. `Providers` installs `AuthProvider`, renders `Navbar`, and shifts authenticated content to account for the fixed sidebar.
3. `AuthProvider` calls `getCurrentUser()` and subscribes to Supabase auth state changes from `src/services/auth.service.ts`.
4. Most protected pages check `useAuth()` and redirect unauthenticated users to `/auth`.
5. Users start from the dashboard (`/`) or campus map (`/map`).
6. The map uses hardcoded `CAMPUS_BUILDINGS` in `app/map/page.tsx`, Mapbox rendering in `components/MapView.tsx`, and assembly point helpers from `src/config/assembly-points.ts`.
7. Selecting an available building routes to `/simulate/[id]/disaster`, then to either:
   - `/simulate/[id]/autonomous?disaster=...&floor=...` for building IDs in `AUTONOMOUS_BUILDING_IDS`.
   - `/simulate/[id]/run?disaster=...&floor=...` otherwise.
8. Autonomous runs save to Supabase via `src/services/simulation.service.ts`; manual runs appear to be local/manual drill evaluation rather than the main persisted multi-agent flow.
9. Analysis pages load completed Supabase runs and child data through `simulation.service.ts`.

## Main Features And Implementation Locations

- Authentication:
  - UI: `app/auth/page.tsx`, `app/auth/callback/page.tsx`
  - Context/hook: `src/context/AuthContext.tsx`, `src/hooks/useAuth.ts`
  - Service: `src/services/auth.service.ts`
  - Current mode: Email/password auth plus Google OAuth.

- Dashboard:
  - `app/page.tsx`
  - Uses `getAggregateSimulationStats()` and `getSimulationHistory()` from `src/services/simulation.service.ts`.

- Campus map and building readiness:
  - Map page/building list: `app/map/page.tsx`
  - Mapbox renderer: `components/MapView.tsx`
  - Assembly points: `src/config/assembly-points.ts`
  - Floor counts: `src/config/building-floor-counts.ts`
  - Readiness scoring: `src/services/building-analytics.service.ts`

- Disaster and floor selection:
  - `app/simulate/[id]/disaster/page.tsx`
  - Autonomous route allow-list is `AUTONOMOUS_BUILDING_IDS` in that file.

- Manual route drill:
  - `app/simulate/[id]/run/page.tsx`
  - Uses `BUILDING_FLOORS`, `makePlaceholderFloor()`, and hazard plans.
  - Contains route analysis, room/exit selection, path math, hazard checks, rerouting, and local metrics in one large page file.

- Autonomous simulation:
  - UI/orchestration: `app/simulate/[id]/autonomous/page.tsx`
  - Engine: `src/simulation/engine.ts`
  - Graph model/pathfinding: `src/simulation/building-model.ts`
  - Analytics/traces: `src/simulation/autonomous-analytics.ts`
  - Spatial grid density: `src/simulation/spatial-grid.ts`
  - Hazard placement/local storage: `src/simulation/hazard-placement.ts`
  - Hazard growth: `src/simulation/hazard-physics.ts`
  - Demo presets: `src/simulation/presets/demo-presets.ts`

- Floor/building graph data:
  - Authoring types: `src/simulation/floor-config/types.ts`
  - Registered floors: `src/simulation/floor-config/buildings/index.ts`
  - Adapter to autonomous graph: `src/simulation/floor-config/to-floor-model.ts`
  - Placeholder fallback: `src/simulation/floor-config/placeholder.ts`

- Analysis:
  - Landing: `app/analysis/page.tsx`
  - Individual run: `app/analysis/runs/page.tsx`
  - Summary: `app/analysis/summary/page.tsx`
  - Compare: `app/analysis/compare/page.tsx`
  - Report: `app/analysis/reports/[runId]/page.tsx`
  - Components: `components/analysis/`

- CSV export:
  - `src/services/csv-export.ts`
  - Triggered from `app/analysis/runs/page.tsx`

- Settings/profile:
  - UI: `app/settings/page.tsx`
  - Service: `src/services/user.service.ts`
  - Display name is editable through `profiles.display_name`; email/password updates use `supabase.auth.updateUser`.

## Backend, Database, And API Flow

There are no Next.js API route handlers in the current codebase. Browser client pages call Supabase directly through `src/services/*`.

Supabase setup:

- Client: `src/config/supabase.ts`
- Auth provider: Supabase email/password plus Google OAuth. For Google OAuth, Supabase must have Google enabled and redirect URLs must include `/auth/callback` for local and production deployments.
- Required env vars used by code:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_MAPBOX_TOKEN`
- `src/config/supabase.ts` falls back to placeholder Supabase values and logs an error if Supabase env vars are missing.
- `components/MapView.tsx` shows an in-app warning when `NEXT_PUBLIC_MAPBOX_TOKEN` is missing.

Database migrations:

- `supabase/migrations/20260312142037_create_normalized_schema.sql`
  - Creates `profiles`, `simulation_runs`, `simulation_configs`, `simulation_results`, `simulation_zones`, `simulation_bottlenecks`, and `density_cells`.
  - Enables RLS; users can operate on their own runs and child records.
- `supabase/migrations/20260410_add_buildings_audit_tags.sql`
  - Adds `buildings`, `run_tags`, `audit_logs`, `simulation_runs.notes`, and `simulation_runs.building_id`.
  - Seeds a `buildings` table, but current map code uses hardcoded `CAMPUS_BUILDINGS` instead of reading this table.
- `supabase/migrations/20260512_add_run_floor_index.sql`
  - Adds run floor indexing.
- `supabase/migrations/20260513_add_run_replay_inputs.sql`
  - Adds replay inputs such as hazards, agents per room, and seed.
- `supabase/migrations/20260515_fix_oauth_profile_trigger_and_rls.sql`
  - OAuth/profile trigger/RLS fixes.
- `supabase/migrations/20260516_add_scenario_severity.sql`
  - Adds scenario severity used by readiness scoring.

Simulation persistence flow:

1. `app/simulate/[id]/autonomous/page.tsx` creates a simulation state from a `FloorModel`, hazards, occupancy, and replay seed.
2. On completion, it calls `createSimulationRun()` in `src/services/simulation.service.ts`.
3. `createSimulationRun()` ensures the authenticated profile row exists, inserts into `simulation_runs`, inserts `simulation_configs`, and logs an audit action.
4. `saveSimulationResults()` upserts `simulation_results`, replaces zones and bottlenecks, updates run status to completed, and logs completion.
5. `saveDensityCells()` writes spatial density cells for heatmaps.
6. Analysis pages use `getSimulationRun()`, `getLatestSimulationRun()`, `getSimulationHistory()`, `getDensityCells()`, and aggregate helpers from `simulation.service.ts`.

Notable service behavior:

- `simulation.service.ts` includes fallback insert/read logic for newer optional columns so the app can partially survive a Supabase project that has not applied every migration.
- `audit.service.ts` logs actions defensively and does not throw on logging failures.
- `building-analytics.service.ts` computes readiness scores only from completed runs; it returns `null` when no completed run data exists.

## Frontend, Page, And Component Flow

- Root layout imports `styles/globals.css` and Mapbox CSS, and self-hosts the Inter font via `next/font/google` (exposed as `--font-inter`, consumed by the body font stack in `globals.css`).
- `Navbar` is only visible for authenticated users and uses `SIDEBAR_WIDTH` exported from `components/Navbar.tsx`.
- UI style is mostly inline React style objects, with shared/global CSS in `styles/` and analysis/simulation classes in page-specific CSS files.
- Common app colors are CSS variables in `styles/globals.css`; the main accent is teal `#2db8b0`.
- Map rendering lives in `components/MapView.tsx`; `app/map/page.tsx` owns building selection state and passes markers/assembly markers/focus data.
- Analysis components are grouped under `components/analysis/` and are used by several analysis routes.
- Simulation UI is not highly componentized. `app/simulate/[id]/run/page.tsx` and `app/simulate/[id]/autonomous/page.tsx` are large files that combine UI, state orchestration, and logic.

## Known Incomplete Or Risky Areas

- No automated test suite is present in `package.json`; only lint/build scripts exist.
- `README.md` says to copy `.env.example`, but no `.env.example` is present in the repo.
- `README.md` lists Leaflet/react-leaflet, but current map implementation uses Mapbox/react-map-gl. Leaflet packages remain installed.
- Some docs may be stale or internally inconsistent; `docs/deployment-readiness.md` itself notes some docs drift. Trust the source code over the docs where they disagree.
- Several docs may drift on auth details. Trust the source of truth in `app/auth/page.tsx` and `src/services/auth.service.ts`.
- `app/map/page.tsx` intentionally hardcodes campus buildings. The migration-created `buildings` table is currently not used by the map.
- `src/schema/building.types.ts` defines `RunTag`, `AuditLog`, and `DensityCell`, but no active `Building` type/service is present.
- `app/settings/page.tsx` notification preferences and simulation defaults are local UI state only; there is no persistence visible in current code.
- `app/settings/page.tsx` displays "Administrator" role locally; this does not appear to come from Supabase profile metadata.
- `app/simulate/[id]/run/page.tsx` still falls back to `makePlaceholderFloor()` when a building has no authored configs or no declared floor count.
- `src/simulation/floor-config/to-floor-model.ts` has floorplan mappings for only some registered buildings; several registered floor configs may have empty `floorplanSrc`.
- Possible floorplan path issue: social-sciences maps to `/floorplans/Ug%202nd%20floor.svg`, while `public/floorplans/` contains `SocialSciences 2nd floor.svg` and `UG 2nd floor.svg`.
- `docs/todos.md` says no open items but then lists new issues: decide whether to keep hazard presets, decide admin/user app view, and finalize earthquake simulation.
- `saveSimulationResults()` replaces child zones/bottlenecks with delete-then-insert. This is okay for one writer per run, but it is not transactional in client code.
- Many protected pages redirect with `window.location.href` from client effects rather than middleware/server guards.
- The manual simulation page is large and mixes many responsibilities; changes there have higher regression risk.

## Coding Conventions Used In This Repo

- TypeScript with strict mode and `@/*` path alias to the project root.
- Component files use PascalCase in `components/`; page files follow Next App Router conventions.
- Services are named with dot suffixes, e.g. `auth.service.ts`, `simulation.service.ts`.
- Most imports use the alias form, e.g. `@/src/services/simulation.service`.
- Most route pages are client components and perform auth checks in `useEffect`.
- Styling is a mix of inline styles, CSS variables, and global CSS files. Existing code favors inline styles for page-specific UI.
- Supabase table rows are mapped into camelCase app types in service helper functions.
- Some Supabase calls use `as any` with eslint disable comments to handle generated type lag for newer tables/columns.
- Comments are used for non-obvious behavior, especially simulation, scoring, and Mapbox handling.
- Existing code uses semicolons inconsistently; many newer TS/TSX files omit semicolons.

## Rules For Future Codex Work

- Read this file and inspect the relevant code before editing.
- Do not install packages unless explicitly requested.
- Prefer existing patterns: client pages, Supabase service modules, inline style objects, and `@/` imports.
- Keep data access in `src/services/`; do not put new Supabase queries directly into reusable presentational components.
- When changing simulation persistence, update `src/schema/simulation.types.ts`, `src/services/simulation.service.ts`, migrations, and affected analysis views together.
- When adding floor/building simulation support, update all relevant places:
  - `src/config/building-floor-counts.ts`
  - `src/simulation/floor-config/buildings/index.ts`
  - a building file in `src/simulation/floor-config/buildings/`
  - `src/simulation/floor-config/to-floor-model.ts` floorplan mappings if floorplan SVGs are needed
  - `public/floorplans/` if assets are required
  - `app/simulate/[id]/disaster/page.tsx` if autonomous routing eligibility changes
- Treat `app/simulate/[id]/run/page.tsx`, `app/simulate/[id]/autonomous/page.tsx`, `src/simulation/engine.ts`, and `src/simulation/building-model.ts` as high-risk areas. Make focused changes and verify carefully.
- Preserve RLS/owner-scoped assumptions in Supabase queries.
- Keep auth flows consistent: if changing supported providers or credential flows, update `app/auth/page.tsx`, `src/services/auth.service.ts`, `app/settings/page.tsx`, and any related docs together.
- Do not fabricate readiness/analytics data. Existing scoring code intentionally returns empty/no-data states when runs are missing.
- If docs conflict with source code, trust source code and note the discrepancy.
- Run `npm run lint` after code changes when feasible. Run `npm run build` for broad changes, especially route, schema, simulation, or Supabase changes.

## Files Or Folders To Avoid Changing Unless Specifically Requested

- `supabase/migrations/` - Historical migrations should not be edited casually. Add new migrations instead unless the user explicitly asks to rewrite local migration history.
- `src/schema/database.types.ts` - Generated Supabase types; regenerate/update intentionally only.
- `public/floorplans/` - Floorplan assets are coordinate-sensitive and tied to authored graph data.
- `src/simulation/floor-config/buildings/` - Authored graph coordinates are fragile; change only when adding/fixing building floor data.
- `src/simulation/engine.ts` and `src/simulation/building-model.ts` - Core simulation/pathfinding behavior.
- `package-lock.json` and `package.json` - Do not change dependencies or scripts unless requested.
- `.env.local` - Contains local secrets/config; do not print or modify unless explicitly requested.
- `.next/` and `node_modules/` - Generated/vendor output.

## Suggested Next Steps

- Add `.env.example` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_MAPBOX_TOKEN`.
- Update `README.md` and stale docs to reflect Mapbox/react-map-gl, current routes, the mixed email/password + Google OAuth auth model, and the hardcoded building-map decision.
- Add basic automated tests for `src/services/simulation.service.ts`, `src/services/building-analytics.service.ts`, and key simulation helpers.
- Decide whether settings notification/default preferences should be persisted or clearly marked as local-only.
- Audit floorplan mappings in `src/simulation/floor-config/to-floor-model.ts` against `public/floorplans/`.
- Continue replacing placeholder floor configs with authored floor graphs where needed.
- Consider moving very large page-local simulation logic into smaller hooks/components/services once behavior is  stable.
