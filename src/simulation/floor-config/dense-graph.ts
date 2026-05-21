import type {
  CorridorNeighborDef,
  CorridorNode,
  CorridorNodeKind,
  FloorConfig,
  RoomDef,
} from './types'

function inferNodeKind(label: string): CorridorNodeKind {
  const lower = label.toLowerCase()
  if (lower.includes('stairs')) return 'stairs'
  if (lower.startsWith('out ') || lower.includes('entry') || lower.startsWith('door ')) return 'door'
  if (lower.includes('near room')) return 'corner'
  if (lower.includes('near exit')) return 'junction'
  if (lower.includes('corridor')) return 'corridor'
  return 'junction'
}

function defaultNodeCapacity(kind: CorridorNodeKind): number {
  if (kind === 'door') return 8
  if (kind === 'stairs') return 10
  if (kind === 'corner') return 12
  if (kind === 'junction') return 18
  return 15
}

function defaultEdgeWidth(fromKind: CorridorNodeKind, neighbor: string | CorridorNeighborDef): number {
  if (typeof neighbor !== 'string' && neighbor.width !== undefined) return neighbor.width
  if (fromKind === 'door') return 1.2
  if (fromKind === 'stairs') return 1.6
  return 2.2
}

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
      const fragile = typeof neighbor === 'string' ? false : neighbor.fragile ?? false
      return { label, width, blockable, fragile }
    }),
  }
}

function entryPointFor(label: string, config: FloorConfig, nodes: CorridorNode[]) {
  const node = nodes.find((candidate) => candidate.label === label)
  if (node) return { x: node.x, y: node.y }
  const exit = config.exits[label] ?? Object.values(config.exits).find((candidate) => candidate.label === label)
  return exit ? { x: exit.x, y: exit.y } : null
}

function doorPoint(room: RoomDef, entry: { x: number; y: number }) {
  return {
    x: Math.round(entry.x + (room.x - entry.x) * 0.22),
    y: Math.round(entry.y + (room.y - entry.y) * 0.22),
  }
}

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
