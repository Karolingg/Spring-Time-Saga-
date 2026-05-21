/**
 * Audit every building's floor graph after adapter conversion.
 *
 * Checks:
 *  1. Every room can reach at least one exit through the graph.
 *  2. Every edge endpoint resolves to a real node.
 *  3. No node has an invalid position (NaN / Infinity).
 *  4. No edge spans an unreasonable distance (>30m / 300px) — flags
 *     long teleport edges that may visually cut through walls even
 *     though they're "node-to-node" in graph terms.
 *
 * Run: npx tsx scripts/audit-floor-graphs.ts
 */

import { BUILDING_FLOORS } from '../src/simulation/floor-config/buildings'
import { floorConfigToFloorModel } from '../src/simulation/floor-config/to-floor-model'
import type { FloorModel } from '../src/simulation/building-model'

const LONG_EDGE_THRESHOLD_METERS = 30

function bfsReachable(floor: FloorModel, startId: string): Set<string> {
  const adj = new Map<string, string[]>()
  for (const e of floor.edges) {
    if (!adj.has(e.from)) adj.set(e.from, [])
    if (!adj.has(e.to)) adj.set(e.to, [])
    adj.get(e.from)!.push(e.to)
    adj.get(e.to)!.push(e.from)
  }
  const seen = new Set<string>([startId])
  const queue = [startId]
  while (queue.length) {
    const cur = queue.shift()!
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
let warnCount = 0

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
    const nodeById = new Map(floor.nodes.map((n) => [n.id, n]))

    // 1. Edges reference real nodes.
    for (const e of floor.edges) {
      if (!nodeById.has(e.from) || !nodeById.has(e.to)) {
        console.log(`ERROR [${buildingId} f${idx}] edge ${e.from} -> ${e.to} references missing node`)
        errorCount++
      }
    }

    // 2. Position sanity.
    for (const n of floor.nodes) {
      if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) {
        console.log(`ERROR [${buildingId} f${idx}] node ${n.id} has invalid position (${n.x}, ${n.y})`)
        errorCount++
      }
    }

    // 3. Long teleport edges. These ARE graph edges, but a 30m+ jump
    //    between two nodes almost certainly crosses walls visually.
    for (const e of floor.edges) {
      if (e.distance > LONG_EDGE_THRESHOLD_METERS) {
        const from = nodeById.get(e.from)
        const to = nodeById.get(e.to)
        console.log(`WARN  [${buildingId} f${idx} "${cfg.floorLabel}"] long edge ${e.distance.toFixed(1)}m: ${from?.label} (${from?.x},${from?.y}) -> ${to?.label} (${to?.x},${to?.y})`)
        warnCount++
      }
    }

    // 4. Reachability: each room must reach at least one exit.
    const unreachable: string[] = []
    for (const r of rooms) {
      const seen = bfsReachable(floor, r.id)
      let foundExit = false
      for (const eId of exitIds) {
        if (seen.has(eId)) { foundExit = true; break }
      }
      if (!foundExit) unreachable.push(r.id)
    }
    if (unreachable.length > 0) {
      console.log(`ERROR [${buildingId} f${idx} "${cfg.floorLabel}"] ${unreachable.length} unreachable room(s): ${unreachable.join(', ')}`)
      errorCount++
    }

    const status = unreachable.length === 0 ? 'OK' : 'FAIL'
    console.log(`[${buildingId} f${idx} "${cfg.floorLabel}"] rooms=${rooms.length} exits=${exits.length} nodes=${floor.nodes.length} edges=${floor.edges.length} ${status}`)
  })
}

console.log('')
console.log(`Summary: ${errorCount} error(s), ${warnCount} warning(s)`)
process.exit(errorCount > 0 ? 1 : 0)
