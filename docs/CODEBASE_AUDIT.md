# Spring-Time-Saga Codebase Audit

Date: 2026-04-10 (Updated)

## 1) Project Overview

This is a Next.js App Router project for a campus evacuation simulator with Supabase as backend.

Core stack:
- Next.js 16 + React 19 + TypeScript 5
- Supabase (Auth + Postgres + RLS)
- Mapbox + react-map-gl
- ESLint for static analysis

Primary flow:
- User authenticates in `/auth`
- User opens `/simulate` to choose building/scenario
- Simulation run pages live under `/simulate/[id]/...`
- Dashboard `/` and `/analysis` read aggregated run data

## 2) Codebase Structure

### App pages
- `app/page.tsx`: Dashboard + stats + recent run table + quick actions
- `app/auth/page.tsx`: Login/signup flow
- `app/simulate/page.tsx`: Building selection and routing into scenario/run pages
- `app/simulate/[id]/disaster/page.tsx`: Scenario selection by building
- `app/simulate/[id]/run/page.tsx`: Run page (dynamic)
- `app/analysis/page.tsx`: Congestion/risk analysis views
- `app/map/page.tsx`: Map visualization
- `app/settings/page.tsx`: Account settings

### Services/data layer
- `src/services/simulation.service.ts`: Simulation run CRUD + aggregation
- `src/services/auth.service.ts`: Auth wrappers
- `src/services/user.service.ts`: Profile/password/email updates

### Auth/context
- `src/context/AuthContext.tsx`: Auth provider and state
- `src/hooks/useAuth.ts`: typed auth hook

### Shared components
- `components/MapView.tsx`: Interactive map and building selection behavior
- `components/Navbar.tsx`: App-level navigation
- `components/analysis/*`: Analysis visual components
- `components/ConfirmModal.tsx`, `components/Cursor.tsx`, etc.

### Database
- `supabase/migrations/20260312142037_create_normalized_schema.sql`: canonical schema + policies

## 3) Database and Data Model

Tables:
- `profiles`: app-level user profile row linked to `auth.users`
- `buildings`: master data for campus buildings (building_id as uuid pk, name, type, polygon [GeoJSON], capacity, floors, exits, risk_level, last_drill_date, notes, timestamps)
- `simulation_runs`: one row per run (status/disaster/user, now includes `notes` and `tags` fields)
- `simulation_configs`: 1:1 config for each run
- `simulation_results`: 1:1 outcome metrics for each run
- `simulation_zones`: 1:N per run for zone-level metrics
- `simulation_bottlenecks`: 1:N per run for bottleneck records
- `density_cells`: fine-grained spatial grid data per run (cell_x, cell_y, peak_density, step, run_id fk)
- `run_tags`: tagging system for simulation runs (run_id fk, tag text, unique constraint on (run_id, tag))
- `audit_logs`: compliance audit trail (user_id, action, resource_type enum, resource_id, changes_json, timestamp)

New enum tables:
- `audit_resource_types`: 'run', 'profile', 'building', 'drill'

RLS status:
- Enabled on all app tables including new tables (buildings, run_tags, audit_logs, density_cells)
- Policies scoped to owner via `auth.uid()` and/or `run_id` ownership checks

Service mapping in `simulation.service.ts`:
- `createSimulationRun`: inserts `simulation_runs` + `simulation_configs`; calls audit log
- `saveSimulationResults`: upserts `simulation_results`; replaces zones/bottlenecks; updates run status; calls audit log
- `getSimulationHistory` / `getLatestSimulationRun`: reads completed runs + child data
- `getAggregateSimulationStats` / `getAggregateZoneStats`: dashboard and analysis aggregates
- `addRunTag(runId, tag)`: insert into `run_tags`; ignores duplicates
- `removeRunTag(runId, tag)`: delete from `run_tags`
- `getRunTags(runId)`: fetch all tags for a run
- `getRunsByTag(tag)`: query runs with given tag for filtering
- `updateRunNotes(runId, notes)`: update simulation_runs.notes; logs audit action
- `saveDensityCells(runId, cells)`: batch insert fine-grained cell density data
- `getDensityCells(runId)`: fetch and map density cells for heatmap visualization
- `toSimulationRun()`: helper now extracts `notes` and `tags` from row

## 4) What Works (verified)

Verified by checks run in this audit and recent builds:
- TypeScript compiles successfully (`next build`) ✅
- App routes build successfully:
  - `/`, `/analysis`, `/auth`, `/map`, `/settings`, `/simulate`
  - dynamic routes `/simulate/[id]/disaster`, `/simulate/[id]/run`
- Lint passes with clean source code (`npm run lint`) ✅
- New services compile and type-check:
  - `src/services/building.service.ts`: PASS
  - `src/services/audit.service.ts`: PASS
  - `src/services/simulation.service.ts` with tag/density functions: PASS
- Editor diagnostics show no active compile/type errors
- ESLint-disable comments properly suppress intended `any` type casts for Supabase schema lag workaround

## 5) What Was Broken and Fixed

### A) Broken dashboard JSX and hidden row rendering
File: `app/page.tsx`

Problem:
- Recent runs table had malformed/partially commented JSX and broken ternary structure.

Fix:
- Repaired table body conditional rendering.
- Removed accidental duplicated inline "Quick Actions" block in the wrong place.
- Restored correct row rendering behavior for recent runs.

### B) Simulation page parse/type failures from stale logic
File: `app/simulate/page.tsx`

Problem:
- File contained stale simulation-state logic referencing undefined variables (`applied`, `setApplied`, `setAgents`, etc.).
- This caused build/type failures and dead code paths.

Fix:
- Removed disconnected/unused simulation state logic that was not wired to current UI flow.
- Preserved active behavior: map/building selection and route to scenario page.
- Removed unused `buildingId` prop in `BuildingPanel`.

### C) MapView lint/type issues
File: `components/MapView.tsx`

Problems:
- `any` casts in Mapbox layer handling
- ref read during render (`mapRef.current` in memo)
- strict hooks lint complaints for synchronous state updates inside effects

Fixes:
- Replaced `any` with typed `FillExtrusionLayerSpecification` and `MapboxGeoJSONFeature` usage.
- Removed render-time ref access by simplifying marker readiness condition.
- Refactored effects to avoid direct synchronous setState patterns flagged by lint.
- Added missing `flat2d` effect dependency where needed.

### D) Global CSS import diagnostics
Files:
- `app/layout.tsx`
- `components/Cursor.tsx`
- `src/types/styles.d.ts`

Problem:
- Editor complained about side-effect CSS type declarations.

Fixes:
- Centralized global CSS imports in app root layout:
  - `styles/globals.css`
  - `styles/components.css`
  - `mapbox-gl/dist/mapbox-gl.css`
- Removed component-level global CSS import from `Cursor.tsx`.
- Added `src/types/styles.d.ts` with `declare module '*.css'` for diagnostics compatibility.

### E) Minor unused import
File: `app/settings/page.tsx`

Fix:
- Removed unused `useEffect` import.

## 5.5) New Features Implemented (2026-04-10)

### A) Building Master Data Migration
**File:** `supabase/migrations/20260410_add_buildings_audit_tags.sql` (new)
**Services:** `src/services/building.service.ts` (new)

Features:
- New `buildings` table with schema: id (uuid), name, type, polygon (GeoJSON), capacity, floors, exits, risk_level, last_drill_date, notes, timestamps
- CRUD service with functions:
  - `getBuildings()`: Fetch all buildings ordered by name
  - `getBuilding(id)`: Fetch single building by ID
  - `createBuilding(building)`: Insert new building with audit logging
  - `updateBuilding(id, updates)`: Partial update with audit logging
  - `deleteBuilding(id)`: Delete building
- RLS policies: authenticated users can read all buildings; only admins/app service role can write
- Type definitions: `src/schema/building.types.ts` with Building and AuditLog interfaces

Integration notes:
- Migration includes RLS policy covering authenticated reads
- All mutations trigger `logAction()` calls to audit_logs for compliance
- Type casting workaround used for `supabase.from('buildings')` during initial migration deployment (due to schema generation lag)

### B) Run Tagging & Notes
**Schema update:** `src/schema/simulation.types.ts`
**Service update:** `src/services/simulation.service.ts`

Features:
- SimulationRun interface now includes `notes?: string` and `tags?: string[]` fields
- New functions in simulation.service:
  - `addRunTag(runId, tag)`: Insert tag; unique constraint prevents duplicates; calls audit log
  - `removeRunTag(runId, tag)`: Delete specific tag
  - `getRunTags(runId)`: Fetch all tags for a run
  - `getRunsByTag(tag)`: Query all runs with given tag (enables tag-based filtering)
  - `updateRunNotes(runId, notes)`: Update run notes; calls audit log
- Helper `toSimulationRun()` now extracts tags and notes from DB rows

New table:
- `run_tags` (run_id fk, tag text, unique constraint on (run_id, tag))

Integration notes:
- Tags enable run categorization/filtering across UI
- Notes provide run-level metadata for retrospective analysis
- Type casting workaround used for `supabase.from('run_tags')` during migration rollout

### C) Audit Logging Service
**File:** `src/services/audit.service.ts` (new)
**Schema:** `src/schema/building.types.ts` includes AuditLog type

Features:
- New service module for compliance audit trail logging
- Functions:
  - `logAction(action, resourceType, resourceId, changesJson, ipAddress)`: Primary logging function; logs to audit_logs table; never throws (defensive)
  - `getAuditLog(resourceType?, resourceId?, limit)`: Query audit by resource; returns array of AuditLog
  - `getUserAuditLog(userId, limit)`: Query audit by user; returns array of AuditLog
- Captures: action name, resource type (run/profile/building/drill), resource ID, JSON changes, user ID, timestamp

New table:
- `audit_logs` (id uuid, user_id uuid fk, action text, resource_type enum, resource_id uuid, changes_json jsonb, ip_address text, timestamp default now())

Integration points:
- Called by `building.service` on all mutations
- Called by `simulation.service` on `saveSimulationResults()` and `updateRunNotes()`
- Non-blocking; errors logged to console but don't interrupt main flow
- Type casting workaround used for `supabase.from('audit_logs')` during migration rollout

### D) Density Cells Integration
**Service update:** `src/services/simulation.service.ts`

Features:
- New functions for spatial grid data (fine-grained cell-level metrics from simulation):
  - `saveDensityCells(runId, cells)`: Batch insert density cell grid data; uses type casting for supabase call
  - `getDensityCells(runId)`: Fetch all cells for a run; returns DensityCell array with id, runId, cellX, cellY, peakDensity, step
- Density cells support heatmap visualization on map page
- Grid cells capture peak pedestrian density per cell per time step

Table:
- `density_cells` (id uuid, run_id uuid fk, cell_x int, cell_y int, peak_density float, step int, created_at timestamp)

Status:
- Schema and functions ready for integration into run simulation engine
- Currently awaiting UI heatmap components to consume cell data

## 6) Useless / Low-Value / Dead Items Identified

1. Previous stale simulation logic in `app/simulate/page.tsx` was dead and disconnected.
- Removed during earlier audit.

2. `coverage/` generated artifacts are included in lint scope.
- Current lint warning is from `coverage/block-navigation.js` (generated file), not app source.

## 7) Remaining Issues / Risks

1. Remaining lint warning (non-blocking):
- `coverage/block-navigation.js` has an unused eslint-disable directive.
- This is generated output and does not affect app runtime/build.

2. Test coverage gap:
- No automated unit/integration tests are present for service logic and critical flows.
- Recommended next: add tests around `simulation.service.ts` and auth lifecycle.

3. Potential data race in service write strategy:
- `saveSimulationResults` replaces zones/bottlenecks via delete + insert pattern.
- Works for normal single-writer flow, but concurrent writes to same run could overwrite each other.

## 8) Validation Commands Executed

- `npm run lint`
- `npm run build`
- VS Code diagnostics scan (`get_errors`)

Outcome summary:
- Build: PASS
- TypeScript: PASS
- Source lint errors: NONE
- Source warnings: NONE
- Generated-file warning: 1 (`coverage/block-navigation.js`)

## 9) Recommended Next Steps

1. Exclude generated `coverage/**` from ESLint to keep lint clean.
2. Add baseline tests for `simulation.service.ts` aggregates and write paths.
3. Consider making run-result child writes transactional if concurrent writers are expected.
4. Optionally extract shared risk/intensity color constants used in multiple files.
