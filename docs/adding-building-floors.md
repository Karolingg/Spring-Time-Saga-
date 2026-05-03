# Add Building Floors

This guide explains how to add floors to an existing building or register a new building. It also calls out the exact code segments to edit.

## Quick checklist (existing building)

1. Add the new floorplan SVG under public/floorplans.
2. Add a new FloorConfig constant in the building file (e.g. science-building.ts).
3. Append the new FloorConfig to the building's exported floor array.
4. Add the floor label -> SVG path mapping in FLOORPLAN_SRC_BY_BUILDING.
5. Update BUILDING_FLOOR_COUNT to match the new total.

## Quick checklist (new building ID)

1. Create a new floor-config file under src/simulation/floor-config/buildings.
2. Export a BUILDING_FLOORS array from that file.
3. Register the building ID in BUILDING_FLOORS and BUILDING_FLOOR_LOADERS.
4. Add the building name and floorplan mapping.
5. Add BUILDING_FLOOR_COUNT entry for the building ID.

## What to edit and why

- Floor definitions (per building):
  - [src/simulation/floor-config/buildings/science-building.ts](../src/simulation/floor-config/buildings/science-building.ts)
  - Add a new FloorConfig object and include it in the exported floor array.

- Floor registry (static build):
  - [src/simulation/floor-config/buildings/index.ts](../src/simulation/floor-config/buildings/index.ts)
  - Ensure your building ID maps to the correct exported floor array.

- Floor registry (lazy load for simulation routes):
  - [src/simulation/floor-config/buildings/loaders.ts](../src/simulation/floor-config/buildings/loaders.ts)
  - Add a loader entry if you introduce a new building ID.

- Floor count used by the UI:
  - [src/config/building-floor-counts.ts](../src/config/building-floor-counts.ts)
  - Keep counts aligned with the number of FloorConfig objects to avoid placeholder injection.

- Floorplan SVG path mapping:
  - [src/simulation/floor-config/to-floor-model.ts](../src/simulation/floor-config/to-floor-model.ts)
  - Update FLOORPLAN_SRC_BY_BUILDING with the floor label and SVG path.

- FloorConfig schema reference:
  - [src/simulation/floor-config/types.ts](../src/simulation/floor-config/types.ts)
  - Use this to confirm required fields and data types.

## Building a new FloorConfig

Start by copying an existing floor and adjusting values. Key fields to update:

- viewWidth / viewHeight
  - Match the SVG viewBox (for CSB floors this is 1200 x 675).

- floorLabel
  - Must match the label used in FLOORPLAN_SRC_BY_BUILDING.

- exits
  - One entry per exit or stair. These coordinates are used as navigation targets.

- primaryPaths
  - The main corridor centerlines that lead to each exit (polylines of points).
  - These do not start in rooms; rooms connect later via corridorEntryNode or nearest corridor node.

- reroutes
  - Alternate corridor polylines used to connect between exits.
  - One alternate per exit in the current schema.

- corridorNodes (recommended)
  - Named corridor points and neighbor links.
  - If you add these, match primaryPaths and reroutes to the same points.

- rooms
  - Each room should specify corridorEntryNode when possible to avoid invalid shortcuts.

- obstacles, blockT, efficiency
  - Keep the keys aligned to the exits on the floor. You can copy values from a nearby floor and tune later.

## Asset and path notes

- Place new SVGs in public/floorplans.
- If the filename contains spaces, the mapping in FLOORPLAN_SRC_BY_BUILDING must use URL encoding.
  - Example file: [public/floorplans/CSB 3rd floor.svg](../public/floorplans/CSB%203rd%20floor.svg)
  - Example mapping value: /floorplans/CSB%203rd%20floor.svg

## Common mistakes to avoid

- Floor label mismatch between FloorConfig and FLOORPLAN_SRC_BY_BUILDING.
- BUILDING_FLOOR_COUNT not matching the number of custom floors.
- Using room coordinates in primaryPaths instead of corridor midlines.
- Forgetting to register a new building ID in loaders and BUILDING_FLOORS.
