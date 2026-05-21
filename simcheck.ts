/**
 * Bug-fix verification — confirms previously broken exits are now reachable.
 * Run with: npx tsx simcheck.ts
 */

import { BUILDING_FLOORS } from './src/simulation/floor-config/buildings/index'
import { floorConfigToFloorModel } from './src/simulation/floor-config/to-floor-model'
import { createSimulation, stepSimulation } from './src/simulation/engine'
import { distributeAgentsByCapacity } from './src/simulation/autonomous-analytics'

const MAX_STEPS = 8000
const SEED = 42
const DT = 0.35

const TARGETS: { building: string; floorIdx: number; label: string; disasterType?: 'fire' | 'earthquake' }[] = [
  { building: 'social-sciences', floorIdx: 0, label: '1st Floor (sanity)' },
  { building: 'social-sciences', floorIdx: 1, label: '2nd Floor — was 800/800 trapped' },
  // 1F only has E1; the fire obstacle (fire-north) is authored to block E1.
  // Using earthquake validates the graph link we fixed without the fire engulfing the sole exit.
  { building: 'as-east-wing',    floorIdx: 0, label: '1st Floor — E1 was unreachable', disasterType: 'earthquake' },
  { building: 'as-east-wing',    floorIdx: 1, label: '2nd Floor (sanity)' },
  { building: 'as-east-wing',    floorIdx: 2, label: '3rd Floor — E1 was unreachable' },
]

let allOk = true

for (const { building, floorIdx, label, disasterType = 'fire' } of TARGETS) {
  const floors = BUILDING_FLOORS[building]
  if (!floors) { console.log(`  SKIP  ${building} — not in registry`); continue }
  const cfg = floors[floorIdx]
  if (!cfg) { console.log(`  SKIP  ${building} [${label}] — floor index out of range`); continue }

  const floor = floorConfigToFloorModel(cfg, { buildingId: building, floorIdx, floorplanSrc: '' })
  const roomNodes = floor.nodes.filter(n => n.type === 'room')
  const totalCapacity = roomNodes.reduce((s, n) => s + n.capacity, 0)

  if (totalCapacity === 0) {
    console.log(`  SKIP  ${building} [${label}] — no rooms`)
    continue
  }

  const agentCount = Math.min(200, totalCapacity)
  const agentsPerRoom = distributeAgentsByCapacity(floor, agentCount)
  const totalAgents = Object.values(agentsPerRoom).reduce((s, v) => s + v, 0)

  let state = createSimulation(floor, { disasterType, agentsPerRoom, seed: SEED })
  let steps = 0

  while (steps < MAX_STEPS) {
    const active = state.agents.filter(a => a.state !== 'evacuated' && a.state !== 'trapped')
    if (active.length === 0) break
    state = stepSimulation(state, floor, DT)
    steps++
  }

  const evac    = state.agents.filter(a => a.state === 'evacuated').length
  const trapped = state.agents.filter(a => a.state === 'trapped').length
  const stuck   = state.agents.filter(a => a.state !== 'evacuated' && a.state !== 'trapped').length
  // Fail if any agents are still moving OR if 100% ended up trapped (total graph disconnect)
  const allTrapped = trapped === totalAgents && totalAgents > 0
  const finished = stuck === 0 && !allTrapped
  const tag = finished ? '  OK' : 'FAIL'
  if (!finished) allOk = false

  const extra = allTrapped ? ' (ALL TRAPPED — graph disconnect)' : !finished ? ' (NOT FINISHED)' : ''
  console.log(
    `${tag}  ${building} [${label}]` +
    `  agents=${totalAgents} evac=${evac} trap=${trapped} stuck=${stuck} steps=${steps}${extra}`
  )
}

console.log('')
if (allOk) {
  console.log('All targeted floors resolved cleanly.')
} else {
  console.log('*** SOME FLOORS STILL HAVE ISSUES ***')
  process.exit(1)
}
