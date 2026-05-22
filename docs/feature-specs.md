# Feature Specifications (Ship target: 2026-05-18)

This document defines stakeholder-facing features and the exact parts of the codebase they touch. It is written for implementation by another developer.

---

## 1) CSV Export (one click from run summary)

### Goal
Allow stakeholders to export a run summary and per-zone metrics as a CSV.

### Where this lives
- Run detail view: app/analysis/runs/page.tsx
- Data sources: src/services/simulation.service.ts, src/schema/simulation.types.ts

### UI placement
Add a "Export CSV" button in the run header area (near the run selector and delete/reset actions). The button is disabled when no run is selected.

### CSV format (exact columns)
Section A: run summary (single row)

Columns:
- run_id
- created_at
- building_id
- disaster_type
- agent_count
- total_steps
- evacuated_count
- evacuation_time_seconds
- max_congestion_percent
- congestion_exposure
- global_peak_density

Section B: zone rows (one row per SimulationZone)

Columns:
- zone_name
- intensity_percent
- agent_count
- bottleneck_count
- risk_level
- lat
- lng

Format details:
- Use ISO strings for dates.
- If results are missing, leave those fields blank.
- Use a blank line between Section A and Section B.
- File name pattern: evacsim_run_{runId}_{YYYYMMDD}.csv

### Acceptance criteria
- Export button appears only when a run is loaded.
- Clicking the button downloads a CSV that opens cleanly in Excel/Sheets.
- All rows match the active selected run.
- If no zones exist, Section B still prints the header only.

---

## 2) Evacuation report (HTML/PDF)

### Goal
Generate a clean, printable report for a run with a summary narrative and charts.

### Where this lives
- New report route: app/analysis/reports/[runId]/page.tsx
- Trigger button: app/analysis/runs/page.tsx
- Data sources: src/services/simulation.service.ts

### UI placement
Add a "Generate Report" button in the run header next to "Export CSV". It opens a new tab at /analysis/reports/{runId}.

### Report layout
- Header: Building name (if available), disaster type, run ID, date/time.
- KPI grid (large numbers): evacuation time, evacuated count, max congestion, global peak density.
- Narrative block (2-3 sentences) using simple rules:
  - If maxCongestion >= 75 -> mention critical congestion.
  - If evacuatedCount < agentCount -> mention incomplete evacuation.
  - Else -> mention successful evacuation.
- Zone table: top 6 zones by intensity (name, intensity, bottleneck count, risk level).
- Optional mini chart: bar chart of zone intensity (div-based, no external libs).
- Footer: generated timestamp and application name.

### Print requirements
- Add print-friendly CSS (new file in styles/report.css or inline styles).
- Page should fit on 1-2 pages when printed to PDF (A4/Letter).
- No interactive controls in print (hide buttons with @media print).

### Acceptance criteria
- Report route loads with a runId and fetches run + zones.
- Print to PDF from the browser produces a clean, readable report.
- If data is missing, show a clear empty-state message.

---

## Implementation notes
- Use existing run data already fetched in app/analysis/runs/page.tsx to avoid extra queries where possible.
- All new UI should follow the existing inline-style pattern unless a new CSS file is explicitly created.
- Ensure no new dependencies are required for CSV or reporting.

---

## Testing checklist
- Run a simulation, export CSV, and verify numeric fields align with the UI.
- Generate report, print to PDF, and check for layout overflow.
