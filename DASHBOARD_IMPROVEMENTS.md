# Dashboard Improvement Plan

> Audit date: 2026-05-21  
> Scope: `/analysis` hub, `/analysis/summary`, `/analysis/runs`, `BuildingTrends`  
> Status: **Not yet implemented**

---

## Current Issues

### 1. Analysis Hub (`/analysis`) — static menu, no live data

The landing page is three link cards with no numbers. A stakeholder lands there and sees no indication of how many runs exist, when the last drill was, or what building was most recently analyzed. It reads like a table of contents rather than a dashboard.

### 2. Summary page — all three feature layers look identical

All three `FeatureContainer`s use `accent="#2db8b0"`. The Aggregate Heatmaps, Drill Trends, and Zone Trends headers are visually indistinguishable — there is no at-a-glance hierarchy or color differentiation between layers.

### 3. Runs page — 7+ buttons crammed into the header

`PageHeader` contains: Back, run selector + delete, Export CSV, Generate Report, Compare, Summary View, New Simulation, and Reset All Data — all on one row. On narrow screens they wrap into two rows. The destructive **Reset All Data** button sits next to navigation links with no visual separation or distance from safe actions.

### 4. `SummaryStats` — missing the most important metric

The three stat cards show *Zones Analyzed*, *Critical Bottlenecks*, and *Avg Evacuation Time*. **Evacuated rate (% of agents who got out)** is absent — that is the primary outcome metric for a drill and the number stakeholders will ask about first.

### 5. Run selector label is hard to scan

The run dropdown uses the format:

```
fire — 200 agents (5/21/2026, 2:15:32 PM)
```

At 40+ characters this is truncated inside the `maxWidth: 320px` box, and all runs look similar when only the timestamp differentiates them.

### 6. `BuildingTrends` sparkline only plots one dimension

The sparkline tracks evacuation *time* across drills. A run can improve on time while worsening on evacuation *rate* (more agents trapped). The trend card does not surface that second dimension.

---

## Recommended Fixes

### Priority 1 — High impact, low effort

These are the three changes that will matter most visually on demo day.

#### 1a. Add evacuated % stat card to `SummaryStats`

**File:** `app/analysis/runs/page.tsx` → `SummaryStats` component  
**Change:** Add a 4th stat card using `run.results.evacuatedCount / run.config.agentCount × 100`. Update the grid from `repeat(3, 1fr)` to `repeat(4, 1fr)` (collapses to 2×2 on mobile via `data-grid-2col-mobile`).

```
Stat cards after fix:
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ Zones        │ Bottlenecks  │ Evac Time    │ Evacuated %  │
│ Analyzed     │ (critical)   │ (avg)        │              │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

Accent color for the new card: green `#22c55e` when ≥ 90 %, amber `#f59e0b` when 70–89 %, red `#ef4444` below 70 %.

---

#### 1b. Differentiate the three layer accents on the summary page

**File:** `app/analysis/summary/page.tsx`  
**Change:** Replace the uniform `#2db8b0` accent with distinct colors per layer so the hierarchy is immediately readable.

| Layer | Current accent | Proposed accent |
|-------|---------------|-----------------|
| Aggregate Floor Heatmaps | `#2db8b0` | `#2db8b0` (keep teal — primary) |
| Drill Trends | `#2db8b0` | `#6366f1` (indigo) |
| Aggregate Zone Trends | `#2db8b0` | `#f59e0b` (amber) |

---

#### 1c. Shorten the run selector label

**File:** `app/analysis/runs/page.tsx` → `buildRunHistory()`  
**Change:** Replace the verbose datetime string with a compact relative-time label.

```
Before: fire — 200 agents (5/21/2026, 2:15:32 PM)
After:  Fire · 200 agents · 2h ago
```

Implementation: compute `Math.floor((Date.now() - new Date(r.createdAt).getTime()) / 60000)` and format as `Xm ago`, `Xh ago`, or `X days ago`.

---

### Priority 2 — Medium effort, high demo value

#### 2a. Add a live stats strip to the analysis hub

**File:** `app/analysis/page.tsx`  
**Change:** Call `getSimulationHistory()` on mount and render a compact strip below the page title:

```
8 runs completed  ·  Last drill 2h ago  ·  Best evac time 47.3 s
```

Strip only renders if at least one run exists; shows nothing (no empty state) while loading so the page does not flicker.

---

#### 2b. Add evacuation-rate line to `BuildingTrends` sparkline

**File:** `components/analysis/BuildingTrends.tsx` → `Sparkline` component  
**Change:** Accept a second `rates` array prop. Render a dashed secondary polyline (color `#6366f1`) over the existing solid evacuation-time line. Add a two-item legend row beneath the sparkline (`— Evac time` and `- - Evac rate`).

---

### Priority 3 — Toolbar cleanup (post-demo)

#### 3a. Restructure `PageHeader` button groups

**File:** `app/analysis/runs/page.tsx` → `PageHeader`  
**Change:** Organize the 7+ buttons into three logical groups:

```
[ Back ]  [ Run selector ▾ ] [ 🗑 ]    ←  navigation + selection

[ Export CSV ]  [ Report ]  [ Compare ]  [ ⚡ New Simulation ]  ←  actions

                                        [ Reset All Data ]  ←  danger (separate row, bottom of page)
```

- Remove Reset All Data from the header entirely; move it to a "Danger zone" section at the very bottom of the page, below all analysis content.
- On mobile: action buttons collapse into a `⋯` overflow menu or wrap under the run selector row.

---

## File Change Summary

| File | Section | Change |
|------|---------|--------|
| `app/analysis/page.tsx` | Page body | Add live stats strip (P2a) |
| `app/analysis/summary/page.tsx` | Three `FeatureContainer`s | Differentiate accent colors (P1b) |
| `app/analysis/runs/page.tsx` | `SummaryStats` | Add evacuated % stat card (P1a) |
| `app/analysis/runs/page.tsx` | `buildRunHistory()` | Shorten run label (P1c) |
| `app/analysis/runs/page.tsx` | `PageHeader` | Restructure button groups, move Reset (P3a) |
| `components/analysis/BuildingTrends.tsx` | `Sparkline` | Add evacuation-rate secondary line (P2b) |

---

## Notes

- All Priority 1 items are self-contained — no new API calls or data model changes required.
- Priority 2a (`getSimulationHistory`) is already imported on the runs page; the hub page would need to add that import.
- Priority 2b requires adding a `rates` prop to `Sparkline` — backward-compatible since it would default to `undefined`/skip rendering.
- Priority 3 is cosmetic restructuring with no logic changes; safe to defer until after the demo.
