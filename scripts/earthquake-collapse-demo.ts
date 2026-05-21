/**
 * Prototype demo: earthquake structural-collapse model on Science Building 2F.
 *
 * Instead of the user placing debris, an earthquake run picks a severity
 * scenario and the building's `fragile` edges (stairwells + long spans) are
 * rolled against it. Collapsed edges spawn debris; aftershocks re-roll the
 * survivors.
 *
 * This script runs SCIENCE_2F across every scenario with a fixed seed and
 * prints: which edges are fragile, which collapsed (and when), and the
 * resulting evacuation outcome.
 *
 * Run: npx tsx scripts/earthquake-collapse-demo.ts
 */

import { buildBuildingModel } from '../src/simulation/floor-config/to-floor-model'
import { createSimulation, stepSimulation, evaluateSimulation, type QuakeScenario } from '../src/simulation/engine'
import type { FloorModel } from '../src/simulation/building-model'

const BUILDING_ID = 'science-building'
const FLOOR_INDEX = 1 // 2nd Floor
const SEED = 12345
const AGENTS_PER_ROOM = 10
const DT = 0.25
const MAX_SECONDS = 300
const SCENARIOS: QuakeScenario[] = ['minor', 'moderate', 'severe']

function getFloor(): FloorModel {
  const building = buildBuildingModel(BUILDING_ID)
  if (!building) throw new Error(`No building model for ${BUILDING_ID}`)
  const floor = building.floors[FLOOR_INDEX]
  if (!floor) throw new Error(`No floor ${FLOOR_INDEX} for ${BUILDING_ID}`)
  return floor
}

function labelFor(floor: FloorModel, nodeId: string): string {
  return floor.nodes.find(n => n.id === nodeId)?.label ?? nodeId
}

const floor = getFloor()

// 1. Report the fragile edge set (the same for every magnitude).
const fragileEdges = floor.edges.filter(e => e.fragile)
console.log(`Science Building — ${floor.label}`)
console.log(`Fragile edges (${fragileEdges.length}):`)
for (const e of fragileEdges) {
  console.log(`  - ${labelFor(floor, e.from)} <-> ${labelFor(floor, e.to)}  (${e.distance.toFixed(1)}m)`)
}
console.log('')

// 2. Per-scenario runs.
const rooms = floor.nodes.filter(n => n.type === 'room')
const agentsPerRoom: Record<string, number> = {}
for (const r of rooms) agentsPerRoom[r.id] = AGENTS_PER_ROOM
const totalAgents = rooms.length * AGENTS_PER_ROOM

for (const scenario of SCENARIOS) {
  let state = createSimulation(floor, {
    disasterType: 'earthquake',
    agentsPerRoom,
    seed: SEED,
    quakeScenario: scenario,
  })
  state.running = true

  // Collapse hazards carry ids prefixed `quake-collapse-`. Authored hazards
  // (the floor's hand-placed debris) keep their original ids.
  const collapseZones = state.hazards
    .map(h => h.zone)
    .filter(z => z.id.startsWith('quake-collapse-'))

  // Step to completion.
  let seconds = 0
  while (!state.finished && seconds < MAX_SECONDS) {
    state = stepSimulation(state, floor, DT)
    seconds += DT
  }
  const results = evaluateSimulation(state, floor)

  console.log(`Scenario: ${scenario}`)
  console.log(`  Collapsed edges: ${collapseZones.length}`)
  for (const z of collapseZones) {
    console.log(`    - debris @ (${z.x.toFixed(0)}, ${z.y.toFixed(0)})  appearsAt=${z.appearsAt}s`)
  }
  console.log(`  Evacuated: ${results.evacuatedCount}/${totalAgents}   Trapped: ${results.trappedCount}   Reroutes: ${results.totalReroutes}`)
  console.log(`  Evac time: ${results.totalTime.toFixed(1)}s   Avg hazard exposure: ${results.avgHazardExposure.toFixed(2)}s`)
  console.log('')
}
