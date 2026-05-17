/* eslint-disable @typescript-eslint/no-require-imports */
const ts = require('typescript')
const fs = require('fs')

require.extensions['.ts'] = function loadTs(module, filename) {
  const source = fs.readFileSync(filename, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2019,
      esModuleInterop: true,
      skipLibCheck: true,
    },
    fileName: filename,
  })
  module._compile(output.outputText, filename)
}

const assert = require('assert')
const { getBuildingById, getNode } = require('../src/simulation/building-model')
const { getAgentRenderPosition } = require('../src/simulation/autonomous-analytics')
const { createSimulation, evaluateSimulation, stepSimulation } = require('../src/simulation/engine')
const { hazardGrowthRate, hazardMaxRadius } = require('../src/simulation/hazard-physics')
const {
  GRID_COLS,
  GRID_ROWS,
  createSpatialGridTrace,
  densityCellsFromTrace,
  pointToGridCell,
  updateSpatialGridTrace,
} = require('../src/simulation/spatial-grid')

function seededRandom(seed) {
  let value = seed % 2147483647
  if (value <= 0) value += 2147483646
  return () => {
    value = (value * 16807) % 2147483647
    return (value - 1) / 2147483646
  }
}

function makeHazard(id, type, x, y, radius = type === 'smoke' ? 55 : 45) {
  return {
    id,
    type,
    x,
    y,
    radius,
    growthRate: hazardGrowthRate(type),
    appearsAt: 0,
    maxRadius: hazardMaxRadius(type, radius),
  }
}

function edgeMidpointHazards(floor, type, predicate, radius) {
  const hazards = []
  let index = 0
  for (const edge of floor.edges) {
    if (!edge.blockable || !predicate(edge)) continue
    const from = getNode(floor, edge.from)
    const to = getNode(floor, edge.to)
    if (!from || !to) continue
    hazards.push(makeHazard(`${type}-${index++}`, type, (from.x + to.x) / 2, (from.y + to.y) / 2, radius))
  }
  return hazards
}

function roomAgents(floor, perRoom = 4) {
  return Object.fromEntries(
    floor.nodes
      .filter((node) => node.type === 'room')
      .map((node) => [node.id, Math.min(perRoom, node.capacity)]),
  )
}

function runScenario({ floor, disasterType, hazards }) {
  const originalRandom = Math.random
  Math.random = seededRandom(20260509)
  try {
    let state = createSimulation(floor, {
      disasterType,
      agentsPerRoom: roomAgents(floor),
      hazardGrowthMultiplier: 0.45,
      hazardOverrides: hazards,
    })
    state.running = true

    let gridTrace = updateSpatialGridTrace(
      createSpatialGridTrace(),
      state.agents.map((agent) => getAgentRenderPosition(agent, floor)),
      [],
      0,
    )

    while (!state.finished && state.elapsedTime < 900) {
      state = stepSimulation(state, floor, 1)
      gridTrace = updateSpatialGridTrace(
        gridTrace,
        state.agents
          .filter((agent) => agent.state !== 'evacuated' && agent.state !== 'trapped')
          .map((agent) => getAgentRenderPosition(agent, floor)),
        state.hazards.map((hazard) => ({
          x: hazard.zone.x,
          y: hazard.zone.y,
          currentRadius: hazard.currentRadius,
          active: hazard.active,
        })),
        1,
      )
    }

    return {
      results: evaluateSimulation(state, floor),
      densityCells: densityCellsFromTrace(gridTrace),
    }
  } finally {
    Math.random = originalRandom
  }
}

assert.strictEqual(GRID_COLS, 48)
assert.strictEqual(GRID_ROWS, 27)
assert.deepStrictEqual(pointToGridCell({ x: 0, y: 0 }), { cellX: 0, cellY: 0 })
assert.deepStrictEqual(pointToGridCell({ x: 1200, y: 675 }), { cellX: 47, cellY: 26 })
assert.deepStrictEqual(pointToGridCell({ x: 600, y: 337.5 }), { cellX: 24, cellY: 13 })
assert.deepStrictEqual(pointToGridCell({ x: -100, y: 9999 }), { cellX: 0, cellY: 26 })

let trace = createSpatialGridTrace()
trace = updateSpatialGridTrace(trace, [{ x: 10, y: 10 }, { x: 11, y: 11 }], [], 1)
trace = updateSpatialGridTrace(trace, [{ x: 10, y: 10 }], [], 1)
const firstCell = densityCellsFromTrace(trace).find((cell) => cell.cellX === 0 && cell.cellY === 0)
assert(firstCell)
assert.strictEqual(firstCell.peakDensity, 2)
assert.strictEqual(firstCell.step, 1)

const building = getBuildingById('science-building')
assert(building)
const floor = building.floors[1]
assert(floor)

const exitEdge = (edge) => {
  const from = getNode(floor, edge.from)
  const to = getNode(floor, edge.to)
  return from?.type === 'exit' || to?.type === 'exit'
}

const centralOrExitEdge = (edge) => {
  const from = getNode(floor, edge.from)
  const to = getNode(floor, edge.to)
  if (!from || !to) return false
  const mx = (from.x + to.x) / 2
  const my = (from.y + to.y) / 2
  return exitEdge(edge) || (mx >= 430 && mx <= 620 && my >= 180 && my <= 420)
}

const scenarios = [
  {
    label: 'baseline',
    disasterType: 'fire',
    hazards: [],
    expectTrapped: false,
  },
  {
    label: 'smoke-only',
    disasterType: 'fire',
    hazards: edgeMidpointHazards(floor, 'smoke', centralOrExitEdge, 55),
    expectTrapped: false,
  },
  {
    label: 'fire-fail',
    disasterType: 'fire',
    hazards: edgeMidpointHazards(floor, 'fire', exitEdge, 45),
    expectTrapped: true,
  },
  {
    label: 'debris-fail',
    disasterType: 'earthquake',
    hazards: edgeMidpointHazards(floor, 'debris', exitEdge, 42),
    expectTrapped: true,
  },
]

const summary = scenarios.map((scenario) => {
  const { results, densityCells } = runScenario({ floor, disasterType: scenario.disasterType, hazards: scenario.hazards })
  assert(densityCells.length > 0, `${scenario.label} should produce density cells`)
  if (scenario.expectTrapped) {
    assert(results.trappedCount > 0, `${scenario.label} should preserve graph fail behavior`)
  } else {
    assert.strictEqual(results.trappedCount, 0, `${scenario.label} should not trap agents`)
  }
  return {
    label: scenario.label,
    evacuated: results.evacuatedCount,
    trapped: results.trappedCount,
    densityCells: densityCells.length,
  }
})

console.log(JSON.stringify({ ok: true, summary }, null, 2))
