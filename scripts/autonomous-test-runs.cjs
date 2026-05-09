/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unused-vars */
const path = require('path')
const ts = require('typescript')

require.extensions['.ts'] = function loadTs(module, filename) {
  const source = require('fs').readFileSync(filename, 'utf8')
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

const { getBuildingById, getNode } = require('../src/simulation/building-model')
const { createSimulation, evaluateSimulation, stepSimulation } = require('../src/simulation/engine')
const { hazardGrowthRate, hazardMaxRadius } = require('../src/simulation/hazard-physics')

function seededRandom(seed) {
  let value = seed % 2147483647
  if (value <= 0) value += 2147483646
  return () => {
    value = (value * 16807) % 2147483647
    return (value - 1) / 2147483646
  }
}

function makeHazard(id, type, x, y, radius = type === 'smoke' ? 46 : type === 'fire' ? 38 : 34) {
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
  const entries = floor.nodes
    .filter((node) => node.type === 'room')
    .map((node) => [node.id, Math.min(perRoom, node.capacity)])
  return Object.fromEntries(entries)
}

function runScenario({ label, disasterType, floor, hazards, perRoom = 4, maxSeconds = 900 }) {
  const originalRandom = Math.random
  Math.random = seededRandom(20260509)
  try {
    let state = createSimulation(floor, {
      disasterType,
      agentsPerRoom: roomAgents(floor, perRoom),
      hazardGrowthMultiplier: 0.45,
      hazardOverrides: hazards,
    })
    state.running = true

    let steps = 0
    while (!state.finished && state.elapsedTime < maxSeconds) {
      state = stepSimulation(state, floor, 1)
      steps++
    }

    const results = evaluateSimulation(state, floor)
    return {
      label,
      disasterType,
      floor: floor.label,
      hazards: hazards.map((hazard) => hazard.type),
      hazardCount: hazards.length,
      steps,
      finished: state.finished,
      totalAgents: state.agents.length,
      evacuated: results.evacuatedCount,
      trapped: results.trappedCount,
      reroutes: results.totalReroutes,
      avgExposure: Number(results.avgHazardExposure.toFixed(2)),
      totalTime: Number(results.totalTime.toFixed(1)),
      feedback: results.feedback,
    }
  } finally {
    Math.random = originalRandom
  }
}

const building = getBuildingById('science-building')
if (!building) {
  throw new Error('science-building model not found')
}

const floor = building.floors[1]
if (!floor) {
  throw new Error('science-building 2nd floor model not found')
}

const exitEdge = (edge) => {
  const from = getNode(floor, edge.from)
  const to = getNode(floor, edge.to)
  return from?.type === 'exit' || to?.type === 'exit'
}

const oneExitEdge = (edge) => {
  const from = getNode(floor, edge.from)
  const to = getNode(floor, edge.to)
  return from?.label === 'S1' || to?.label === 'S1'
}

const centralEdges = (edge) => {
  const from = getNode(floor, edge.from)
  const to = getNode(floor, edge.to)
  if (!from || !to) return false
  const mx = (from.x + to.x) / 2
  const my = (from.y + to.y) / 2
  return mx >= 430 && mx <= 620 && my >= 180 && my <= 420
}

const scenarios = [
  {
    label: 'Fire baseline: no placed hazards',
    disasterType: 'fire',
    floor,
    hazards: [],
  },
  {
    label: 'Fire stress: smoke-only central/exit corridors',
    disasterType: 'fire',
    floor,
    hazards: edgeMidpointHazards(floor, 'smoke', (edge) => centralEdges(edge) || exitEdge(edge), 55),
  },
  {
    label: 'Fire reroute: one exit connector hard-blocked',
    disasterType: 'fire',
    floor,
    hazards: edgeMidpointHazards(floor, 'fire', oneExitEdge, 45),
  },
  {
    label: 'Fire fail: all exit connectors hard-blocked',
    disasterType: 'fire',
    floor,
    hazards: edgeMidpointHazards(floor, 'fire', exitEdge, 45),
  },
  {
    label: 'Earthquake reroute: one stair/exit connector blocked',
    disasterType: 'earthquake',
    floor,
    hazards: edgeMidpointHazards(floor, 'debris', oneExitEdge, 42),
  },
  {
    label: 'Earthquake fail: all stair/exit connectors blocked',
    disasterType: 'earthquake',
    floor,
    hazards: edgeMidpointHazards(floor, 'debris', exitEdge, 42),
  },
]

const results = scenarios.map(runScenario)
console.log(JSON.stringify(results, null, 2))
