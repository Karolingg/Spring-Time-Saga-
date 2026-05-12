/**
 * Audit every building's floor graph after adapter conversion.
 *
 * Checks:
 *  1. Every room has a path to at least one exit.
 *  2. Every edge endpoint resolves to a real node.
 *  3. No node has an off-graph position (NaN / undefined).
 *
 * Run: node scripts/audit-floor-graphs.cjs
 */

const path = require('path')
const tsNode = require.resolve('ts-node/register')
require(tsNode)
require('tsconfig-paths/register')

const { BUILDING_FLOORS } = require('../src/simulation/floor-config/buildings')
const { floorConfigToFloorModel } = require('../src/simulation/floor-config/to-floor-model')

function bfsReachable(floor, startId) {
  const adj = new Map()
  for (const e of floor.edges) {
    if (!adj.has(e.from)) adj.set(e.from, [])
    if (!adj.has(e.to)) adj.set(e.to, [])
    adj.get(e.from).push(e.to)
    adj.get(e.to).push(e.from)
  }
  const seen = new Set([startId])
  const queue = [startId]
  while (queue.length) {
    const cur = queue.shift()
    for (const n of adj.get(cur) ?? []) {
      if (!seen.has(n)) {
        seen.add(n)
        queue.push(n)
      }
    }
  }
  return seen
}

let errorCount = 0

for (const [buildingId, configs] of Object.entries(BUILDING_FLOORS)) {
  configs.forEach((cfg, idx) => {
    const floor = floorConfigToFloorModel(cfg, {
      buildingId,
      floorIdx: idx,
      floorplanSrc: '',
    })
    const exits = floor.nodes.filter((n) => n.type === 'exit')
    const rooms = floor.nodes.filter((n) => n.type === 'room')
    const exitIds = new Set(exits.map((e) => e.id))

    // 1. Each edge endpoint resolves to a node.
    const nodeIds = new Set(floor.nodes.map((n) => n.id))
    for (const e of floor.edges) {
      if (!nodeIds.has(e.from) || !nodeIds.has(e.to)) {
        console.log(`[${buildingId} f${idx}] edge ${e.from} -> ${e.to} references missing node`)
        errorCount++
      }
    }

    // 2. Position sanity.
    for (const n of floor.nodes) {
      if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) {
        console.log(`[${buildingId} f${idx}] node ${n.id} has invalid position (${n.x}, ${n.y})`)
        errorCount++
      }
    }

    // 3. Reachability: each room must reach at least one exit.
    const unreachableRooms = []
    for (const r of rooms) {
      const seen = bfsReachable(floor, r.id)
      let foundExit = false
      for (const eId of exitIds) {
        if (seen.has(eId)) { foundExit = true; break }
      }
      if (!foundExit) unreachableRooms.push(r.id)
    }
    if (unreachableRooms.length > 0) {
      console.log(`[${buildingId} f${idx} "${cfg.floorLabel}"] ${unreachableRooms.length} unreachable room(s): ${unreachableRooms.join(', ')}`)
      errorCount++
    }

    console.log(`[${buildingId} f${idx} "${cfg.floorLabel}"] ${rooms.length} rooms, ${exits.length} exits, ${floor.nodes.length} nodes, ${floor.edges.length} edges${unreachableRooms.length === 0 ? ' OK' : ''}`)
  })
}

if (errorCount === 0) {
  console.log('\nALL GRAPHS VALID')
  process.exit(0)
} else {
  console.log(`\n${errorCount} graph issue(s) detected`)
  process.exit(1)
}
