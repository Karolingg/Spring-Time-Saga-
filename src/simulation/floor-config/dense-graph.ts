/**
 * Shared "dense graph" enrichment for per-floor configs.
 *
 * Wrap any `FloorConfig[]` with `.map(withDenseGraph)` at export time and
 * the floors get:
 *
 *   1. **Normalized corridor nodes** — every corridor node is given a `kind`
 *      (corridor / junction / door / corner / stairs), a default `capacity`
 *      based on that kind, and explicit per-edge widths/blockable flags.
 *
 *   2. **Synthesized "door" nodes** — for every room with a declared
 *      `corridorEntryNode(s)`, a thin door node is inserted between the
 *      room's centroid and the corridor entry. This produces the dense
 *      grid that the spatial-grid heatmap relies on for visible
 *      congestion blooms at room thresholds.
 *
 * Centralizing this here means every building's heatmap is computed off
 * the same enrichment rules — no per-building drift.
 */

import type {
  CorridorNeighborDef,
  CorridorNode,
  CorridorNodeKind,
  FloorConfig,
  RoomDef,
} from './types'

/** Heuristic — guess the structural role of a corridor node from its label.
 *  Falls back to `'junction'` when nothing matches. */
function inferNodeKind(label: string): CorridorNodeKind {
  const lower = label.toLowerCase()
  if (lower.includes('stairs')) return 'stairs'
  if (lower.startsWith('out ') || lower.includes('entry') || lower.startsWith('door ')) return 'door'
  if (lower.includes('near room')) return 'corner'
  if (lower.includes('near exit')) return 'junction'
  if (lower.includes('corridor')) return 'corridor'
  return 'junction'
}

/** Default agent capacity per node kind. Doors are the narrowest, corridors
 *  the most permissive. */
function defaultNodeCapacity(kind: CorridorNodeKind): number {
  if (kind === 'door') return 8
  if (kind === 'stairs') return 10
  if (kind === 'corner') return 12
  if (kind === 'junction') return 18
  return 15
}

/** Default edge width (meters) — used unless the neighbor spec overrides. */
function defaultEdgeWidth(fromKind: CorridorNodeKind, neighbor: string | CorridorNeighborDef): number {
  if (typeof neighbor !== 'string' && neighbor.width !== undefined) return neighbor.width
  if (fromKind === 'door') return 1.2
  if (fromKind === 'stairs') return 1.6
  return 2.2
}

/** Promote string neighbors to full `CorridorNeighborDef` shape, infer
 *  missing kind/capacity. Idempotent — calling it twice is safe. */
function normalizeCorridorNode(node: CorridorNode): CorridorNode {
  const kind = node.kind ?? inferNodeKind(node.label)
  return {
    ...node,
    kind,
    capacity: node.capacity ?? defaultNodeCapacity(kind),
    neighbors: (node.neighbors ?? []).map((neighbor) => {
      const label = typeof neighbor === 'string' ? neighbor : neighbor.label
      const width = defaultEdgeWidth(kind, neighbor)
      const blockable = typeof neighbor === 'string' ? true : neighbor.blockable ?? true
      return { label, width, blockable }
    }),
  }
}

/** Resolve a label to a point — either a corridor node or an exit. Used
 *  when synthesizing door positions. */
function entryPointFor(label: string, config: FloorConfig, nodes: CorridorNode[]) {
  const node = nodes.find((candidate) => candidate.label === label)
  if (node) return { x: node.x, y: node.y }
  const exit = config.exits[label] ?? Object.values(config.exits).find((candidate) => candidate.label === label)
  return exit ? { x: exit.x, y: exit.y } : null
}

/** Compute a synthetic door point along the room→corridor segment, ~22%
 *  of the way from the corridor entry toward the room centroid. */
function doorPoint(room: RoomDef, entry: { x: number; y: number }) {
  return {
    x: Math.round(entry.x + (room.x - entry.x) * 0.22),
    y: Math.round(entry.y + (room.y - entry.y) * 0.22),
  }
}

/**
 * Apply the dense-graph enrichment to a single floor. Idempotent on
 * already-enriched configs (re-running it is a no-op semantically — at
 * worst it produces duplicate door labels, which the adapter dedupes).
 *
 * Use as: `[FLOOR_1, FLOOR_2, ...].map(withDenseGraph)` at the bottom of
 * a building config file.
 */
export function withDenseGraph(config: FloorConfig): FloorConfig {
  const baseNodes = (config.corridorNodes ?? []).map(normalizeCorridorNode)
  const rooms: Record<string, RoomDef> = {}
  const doorNodes: CorridorNode[] = []

  for (const [roomKey, room] of Object.entries(config.rooms)) {
    if (roomKey === 'corridor') {
      rooms[roomKey] = room
      continue
    }

    const entryLabels = room.corridorEntryNodes?.length
      ? room.corridorEntryNodes
      : room.corridorEntryNode
        ? [room.corridorEntryNode]
        : []

    if (entryLabels.length === 0) {
      rooms[roomKey] = room
      continue
    }

    const doorLabels: string[] = []
    for (const [index, entryLabel] of entryLabels.entries()) {
      const entry = entryPointFor(entryLabel, config, baseNodes)
      if (!entry) continue
      const label = entryLabels.length === 1 ? `Door ${room.label}` : `Door ${room.label} ${index + 1}`
      const point = doorPoint(room, entry)
      doorLabels.push(label)
      doorNodes.push({
        label,
        x: point.x,
        y: point.y,
        kind: 'door',
        capacity: 8,
        neighbors: [{ label: entryLabel, width: 1.2, blockable: true }],
      })
    }

    rooms[roomKey] = {
      ...room,
      corridorEntryNode: doorLabels.length === 1 ? doorLabels[0] : undefined,
      corridorEntryNodes: doorLabels.length > 1 ? doorLabels : undefined,
    }
  }

  return {
    ...config,
    rooms,
    corridorNodes: [...baseNodes, ...doorNodes],
  }
}
