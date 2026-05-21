# App Completion and Deployment Readiness

This document lists what still needs to be completed in the codebase and the concrete steps required to start deployment.

---

## 1) Core product gaps (must-fix before shipping)

### 1.1 Campus building list is hardcoded — OUT OF SCOPE (by design)
The app is scoped to a single, fixed university campus. The building list in
`app/map/page.tsx` (`CAMPUS_BUILDINGS`) is intentionally hardcoded — a closed,
known-at-build-time set does not need a database round-trip. This is not a gap.

Status: resolved by decision. No Supabase-backed building fetch is required.

Note: the per-building side-panel still shows a "BUILDING ANALYTICS
(PLACEHOLDER)" block in `app/map/page.tsx`. That label is a separate, smaller
cleanup — either wire it to real run-derived KPIs or remove the block. Tracked
loosely; not a ship blocker.

---

### 1.2 Building admin UI — OUT OF SCOPE (removed)
There is deliberately no building admin UI. Because the building list is a
fixed, single-campus set (see 1.1), CRUD tooling for it has no purpose.

Removed from the codebase:
- `src/services/building.service.ts`
- `components/buildings/BuildingList.tsx`, `BuildingEditModal.tsx`
- `app/buildings/page.tsx` (the `/buildings` route)
- The `Building` interface in `src/schema/building.types.ts`

Status: resolved by decision. No further work.

---

### 1.3 Placeholder floor plans are still used
Current behavior:
- The manual run route falls back to placeholder floors for missing configs.

Where it shows up:
- app/simulate/[id]/run/page.tsx
- src/simulation/floor-config/placeholder.ts
- src/config/building-floor-counts.ts
- docs/adding-building-floors.md (instructions)

What to do:
- Add real FloorConfig definitions for each building that is selectable.
- Ensure BUILDING_FLOOR_COUNT matches actual floor configs so placeholders are not injected.
- Make sure floorplan SVG paths are properly URL-encoded.

Definition of done:
- No simulation uses makePlaceholderFloor().
- All selectable buildings have real floor configs and floorplans.

---

### 1.4 Simulation behavior bugs still listed in docs
Current behavior:
- docs/todos.md lists fire-agent trapping logic and aggregate heatmap tasks as TODO.

What to do:
- Fix the fire trapping edge case (agents entering a fire radius should reroute or backtrack).
- Add aggregate heatmap output per floor (if required for demo).

Definition of done:
- Remove these items from docs/todos.md once completed.

---

## 2) Data and database readiness

### 2.1 Supabase migrations must be applied
Where it shows up:
- supabase/migrations/20260312142037_create_normalized_schema.sql
- supabase/migrations/20260410_add_buildings_audit_tags.sql

What to do:
- Apply both migrations to the production Supabase project.
- Verify RLS policies allow the intended access (read for authenticated users, write for admins/service).

Definition of done:
- All tables exist in production with RLS enabled.
- CRUD operations from the app succeed against production.

---

### 2.2 Seed initial building data — OUT OF SCOPE (by design)
Not required. The map reads its building list from the hardcoded
`CAMPUS_BUILDINGS` array in `app/map/page.tsx` (see 1.1), not from the database.

The `buildings` table still exists in migration
`20260410_add_buildings_audit_tags.sql` and is harmless to leave in place —
the same migration also creates `run_tags` / `audit_logs` and the
`simulation_runs.building_id` column, all of which ARE used. Do not edit or
remove that migration. The `buildings` table simply goes unused.

---

## 3) Environment configuration (missing or inconsistent)

### 3.1 .env.example is missing
Current behavior:
- README instructs copying .env.example, but no file exists.

What to do:
- Add a .env.example file with required keys:
  - NEXT_PUBLIC_SUPABASE_URL=
  - NEXT_PUBLIC_SUPABASE_ANON_KEY=
  - NEXT_PUBLIC_MAPBOX_TOKEN=

Definition of done:
- New developers can bootstrap without guessing env keys.

---

### 3.2 Required environment variables
Used in code:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- NEXT_PUBLIC_MAPBOX_TOKEN

What to do:
- Set these in the deployment platform environment settings.
- Verify Mapbox and Supabase errors are not printed at runtime.

---

## 4) Documentation cleanup (to avoid confusion)

### 4.1 README tech stack is outdated
Current behavior:
- README lists Leaflet, but the app uses Mapbox.

What to do:
- Update README to reflect Mapbox and react-map-gl.

---

### 4.2 Supabase setup guide is out of sync
Current behavior:
- docs/supabase-setup-guide.md mentions placeholder auth logic, but app/auth/page.tsx already uses real auth calls.

What to do:
- Update the guide to match actual login behavior.

---

## 5) QA checklist before deploy

Functional checks:
- Auth: sign-up, sign-in, sign-out, and session persistence.
- Map: map loads with Mapbox token; building selection works.
- Simulation: manual and autonomous runs complete without console errors.
- Analysis: run history loads; heatmaps show for completed runs.
- Settings: profile and password update flows work.

Data checks:
- Campus map renders all buildings from the hardcoded list and selection works.
- Simulation run data is persisted and retrievable.

---

## 6) Deployment steps (baseline)

1) Choose host (Vercel recommended for Next.js).
2) Set environment variables:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - NEXT_PUBLIC_MAPBOX_TOKEN
3) Build locally and fix any errors:
   - npm install
   - npm run lint
   - npm run build
4) Deploy from the main branch.
5) After deploy, set the Supabase Site URL to the production domain.

---

## 7) Post-deploy smoke tests

- Open /auth and verify login works.
- Open /map, confirm map tiles load and building selection works.
- Run a simulation and verify results appear in /analysis/runs.
- Confirm no console errors for missing env vars.

---

## 8) Deployment acceptance criteria

- Core product gaps 1.3–1.4 are resolved (1.1, 1.2 are out of scope by design).
- The "BUILDING ANALYTICS (PLACEHOLDER)" block in `app/map/page.tsx` is wired to real data or removed.
- Supabase migrations are applied and run/auth/tag CRUD works against production.
- .env.example exists and all required env vars are set in the deployment platform.
- README and Supabase setup docs match the current implementation.
- `npm run lint` and `npm run build` pass locally.
- QA checklist in section 5 passes without critical issues.
- Post-deploy smoke tests in section 7 pass on the production URL.

---

## Appendix: Key files referenced

- app/map/page.tsx
- app/simulate/[id]/run/page.tsx
- src/config/supabase.ts
- src/simulation/floor-config/placeholder.ts
- src/config/building-floor-counts.ts
- supabase/migrations/20260312142037_create_normalized_schema.sql
- supabase/migrations/20260410_add_buildings_audit_tags.sql
- docs/todos.md
- README.md
