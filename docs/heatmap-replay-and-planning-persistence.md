# Heatmap Replay + Planning Hazard Persistence

## Purpose

Keep heatmap visualization available without slowing live simulation, and ensure planning hazards are not lost on refresh or back navigation.

## Decision Summary

1. Heatmap layers remain available in replay or post-run analysis views.
2. Heatmaps only render for the floor that was actually simulated for that run.
3. Planning mode hazards persist across refresh and back/forward navigation using local storage.

## Heatmap Scope: Only the Simulated Floor

### Behavior

- A run captures the floor it simulated (building ID + floor ID/label).
- Heatmap layers render only when the currently viewed floor matches the run's simulated floor.
- If the user selects a different floor, the heatmap option is hidden or disabled with a short message.

### Rationale

- Prevents misleading overlays on floors that were not simulated.
- Keeps analysis and replay scoped to the actual run context.
- Avoids confusion when users switch buildings or floors after a run.

### Suggested UI Copy

- Disabled state: "Heatmap available only for the simulated floor."
- Empty state: "Run a simulation on this floor to see a heatmap."

### Data Requirements

Each run needs to store:

- `buildingId`
- `floorId` (or `floorLabel` if that is the stable identifier)
- `runId`
- `timestamp`

The heatmap selector should validate:

- `currentFloor === run.floor`

If not, hide or disable the heatmap toggle.

## Planning Mode: Persist Hazards Across Refresh/Back

### Behavior

- Placed hazards are saved to local storage on every change.
- If the user refreshes or navigates back/forward, hazards are restored automatically.
- Hazards only clear on explicit actions (e.g., "Clear" or "New Plan").

### Suggested Storage Key

Use a key per building + floor to avoid collisions:

- `sim:planning:hazards:{buildingId}:{floorId}`

### Stored Payload

- `version`
- `buildingId`
- `floorId`
- `hazards` (type, position, size, metadata)
- `updatedAt`

### Restore Rules

- On planning page load, read the matching key and rehydrate hazards.
- If the stored `floorId` or `buildingId` does not match the active context, ignore it.
- If the data schema changes, use `version` to migrate or drop old entries.

### Clear Rules

- Clear local storage only when the user explicitly clears or starts a new plan.
- Do not clear on `refresh`, `back`, or route transitions.

## Edge Cases

- If local storage is unavailable, fall back to in-memory only and show a non-blocking warning.
- If a user changes floors, save the old floor plan before switching.
- If a user changes buildings, reset the UI but keep the old plan stored under its key.

## Acceptance Criteria

- Heatmap toggle appears only for the simulated floor of the selected run.
- Switching floors removes or disables the heatmap layer immediately.
- Planning hazards remain after refresh or back navigation.
- Hazards clear only on explicit user action.
