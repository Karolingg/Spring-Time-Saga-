/**
 * EVACSIM — Building Model & Navigation Graph
 *
 * Defines rooms, corridors, exits, hazard zones, and a navigation graph
 * for the Admin Building 2nd Floor.
 *
 * Coordinate system: matches SVG viewBox 0 0 1200 675
 */

/* ── Core types ── */

export interface NavNode {
  id: string
  label: string
  x: number
  y: number
  type: 'room' | 'corridor' | 'exit' | 'stairs' | 'junction'
  /** Capacity in number of people */
  capacity: number
  /** Room bounding box for rendering overlays (optional) */
  bounds?: { x: number; y: number; w: number; h: number }
}

export interface NavEdge {
  from: string
  to: string
  /** Distance in meters (approx) */
  distance: number
  /** Width of passage in meters — affects congestion */
  width: number
  /** Can this edge be blocked by hazards? */
  blockable: boolean
}

export interface HazardZone {
  id: string
  type: 'fire' | 'smoke' | 'debris' | 'blocked'
  /** Center position */
  x: number
  y: number
  /** Initial radius */
  radius: number
  /** Growth rate per second */
  growthRate: number
  /** Appears after this many seconds */
  appearsAt: number
}

export interface FloorModel {
  id: string
  label: string
  floorplanSrc: string
  nodes: NavNode[]
  edges: NavEdge[]
  /** Hazard templates per disaster type */
  hazards: Record<string, HazardZone[]>
}

export interface BuildingModel {
  id: string
  name: string
  floors: FloorModel[]
}

/* ── Admin Building 2nd Floor ── */

const ADMIN_2F_NODES: NavNode[] = [
  // Rooms
  {
    id: 'room-201',
    label: 'Room 201',
    x: 820, y: 480,
    type: 'room',
    capacity: 40,
    bounds: { x: 720, y: 395, w: 230, h: 210 },
  },
  {
    id: 'room-202',
    label: 'Room 202',
    x: 820, y: 300,
    type: 'room',
    capacity: 40,
    bounds: { x: 720, y: 215, w: 230, h: 170 },
  },
  {
    id: 'room-203',
    label: 'Room 203',
    x: 820, y: 130,
    type: 'room',
    capacity: 40,
    bounds: { x: 720, y: 50, w: 230, h: 160 },
  },
  {
    id: 'room-204',
    label: 'Room 204',
    x: 260, y: 340,
    type: 'room',
    capacity: 60,
    bounds: { x: 145, y: 55, w: 240, h: 565 },
  },

  // Central corridor junctions
  {
    id: 'corridor-north',
    label: 'North Corridor',
    x: 560, y: 95,
    type: 'corridor',
    capacity: 20,
  },
  {
    id: 'corridor-center',
    label: 'Central Lobby',
    x: 560, y: 300,
    type: 'junction',
    capacity: 30,
  },
  {
    id: 'corridor-south',
    label: 'South Corridor',
    x: 560, y: 580,
    type: 'corridor',
    capacity: 20,
  },
  {
    id: 'corridor-east',
    label: 'East Corridor',
    x: 710, y: 300,
    type: 'corridor',
    capacity: 15,
  },
  {
    id: 'corridor-west',
    label: 'West Corridor',
    x: 400, y: 300,
    type: 'corridor',
    capacity: 15,
  },

  // Stairs / utility
  {
    id: 'stairs-center',
    label: 'Central Stairwell',
    x: 600, y: 100,
    type: 'stairs',
    capacity: 10,
    bounds: { x: 530, y: 50, w: 100, h: 80 },
  },

  // Exits
  {
    id: 'exit-e1',
    label: 'Exit E1',
    x: 430, y: 50,
    type: 'exit',
    capacity: 8,
  },
  {
    id: 'exit-e2',
    label: 'Exit E2',
    x: 370, y: 620,
    type: 'exit',
    capacity: 8,
  },
  {
    id: 'exit-e3',
    label: 'Exit E3',
    x: 610, y: 620,
    type: 'exit',
    capacity: 8,
  },
]

const ADMIN_2F_EDGES: NavEdge[] = [
  // Room 201 ↔ East Corridor
  { from: 'room-201', to: 'corridor-east', distance: 12, width: 1.5, blockable: true },
  // Room 202 ↔ East Corridor
  { from: 'room-202', to: 'corridor-east', distance: 8, width: 1.5, blockable: true },
  // Room 203 ↔ Corridor North (via east side)
  { from: 'room-203', to: 'corridor-north', distance: 14, width: 1.5, blockable: true },
  { from: 'room-203', to: 'corridor-east', distance: 10, width: 1.5, blockable: false },
  // Room 204 ↔ West Corridor
  { from: 'room-204', to: 'corridor-west', distance: 10, width: 2.0, blockable: true },
  { from: 'room-204', to: 'corridor-south', distance: 15, width: 1.5, blockable: true },

  // Corridor interconnections
  { from: 'corridor-north', to: 'corridor-center', distance: 18, width: 2.5, blockable: true },
  { from: 'corridor-center', to: 'corridor-south', distance: 22, width: 2.5, blockable: true },
  { from: 'corridor-center', to: 'corridor-east', distance: 12, width: 2.0, blockable: false },
  { from: 'corridor-center', to: 'corridor-west', distance: 12, width: 2.0, blockable: false },
  { from: 'corridor-north', to: 'corridor-west', distance: 14, width: 2.0, blockable: true },

  // Stairs
  { from: 'stairs-center', to: 'corridor-north', distance: 5, width: 1.5, blockable: false },

  // Exits
  { from: 'exit-e1', to: 'corridor-north', distance: 8, width: 1.8, blockable: true },
  { from: 'exit-e1', to: 'corridor-west', distance: 10, width: 1.8, blockable: true },
  { from: 'exit-e2', to: 'corridor-south', distance: 6, width: 1.8, blockable: true },
  { from: 'exit-e2', to: 'corridor-west', distance: 12, width: 1.8, blockable: true },
  { from: 'exit-e3', to: 'corridor-south', distance: 6, width: 1.8, blockable: true },
  { from: 'exit-e3', to: 'corridor-east', distance: 14, width: 1.8, blockable: true },
]

const FIRE_HAZARDS: HazardZone[] = [
  { id: 'fire-1', type: 'fire', x: 560, y: 300, radius: 25, growthRate: 8, appearsAt: 0 },
  { id: 'smoke-1', type: 'smoke', x: 560, y: 250, radius: 40, growthRate: 12, appearsAt: 3 },
  { id: 'fire-2', type: 'fire', x: 450, y: 350, radius: 20, growthRate: 6, appearsAt: 8 },
  { id: 'blocked-sw', type: 'blocked', x: 400, y: 550, radius: 30, growthRate: 0, appearsAt: 12 },
]

const EARTHQUAKE_HAZARDS: HazardZone[] = [
  { id: 'debris-1', type: 'debris', x: 560, y: 200, radius: 35, growthRate: 2, appearsAt: 2 },
  { id: 'debris-2', type: 'debris', x: 700, y: 400, radius: 30, growthRate: 1, appearsAt: 5 },
  { id: 'blocked-e1', type: 'blocked', x: 430, y: 80, radius: 25, growthRate: 0, appearsAt: 0 },
  { id: 'debris-3', type: 'debris', x: 350, y: 580, radius: 25, growthRate: 3, appearsAt: 10 },
]

export const ADMIN_BUILDING: BuildingModel = {
  id: 'admin-building',
  name: 'Administration Building',
  floors: [
    {
      id: 'admin-2f',
      label: '2nd Floor',
      floorplanSrc: '/floorplans/admin-building-f1.svg',
      nodes: ADMIN_2F_NODES,
      edges: ADMIN_2F_EDGES,
      hazards: {
        fire: FIRE_HAZARDS,
        earthquake: EARTHQUAKE_HAZARDS,
      },
    },
  ],
}

/* ── CSB (Science Building) 2nd Floor ── */

const CSB_2F_NODES: NavNode[] = [
  // Rooms — Room 204 is large left side, Rooms 201-203 are right side
  {
    id: 'csb-room-204',
    label: 'Room 204',
    x: 290, y: 320,
    type: 'room',
    capacity: 60,
    bounds: { x: 100, y: 80, w: 200, h: 520 },
  },
  {
    id: 'csb-room-203',
    label: 'Room 203',
    x: 770, y: 130,
    type: 'room',
    capacity: 40,
    bounds: { x: 680, y: 50, w: 200, h: 160 },
  },
  {
    id: 'csb-room-202',
    label: 'Room 202',
    x: 770, y: 330,
    type: 'room',
    capacity: 40,
    bounds: { x: 680, y: 230, w: 200, h: 170 },
  },
  {
    id: 'csb-room-201',
    label: 'Room 201',
    x: 770, y: 530,
    type: 'room',
    capacity: 40,
    bounds: { x: 680, y: 430, w: 200, h: 180 },
  },

  // Corridor — open area below stairs
  {
    id: 'csb-corridor-center',
    label: 'Central Corridor',
    x: 500, y: 440,
    type: 'corridor',
    capacity: 25,
  },
  // Junction connecting north area
  {
    id: 'csb-corridor-north',
    label: 'North Corridor',
    x: 500, y: 130,
    type: 'corridor',
    capacity: 15,
  },
  // Junction connecting south area
  {
    id: 'csb-corridor-south',
    label: 'South Corridor',
    x: 500, y: 595,
    type: 'corridor',
    capacity: 15,
  },
  // East corridor connecting rooms to center
  {
    id: 'csb-corridor-east',
    label: 'East Corridor',
    x: 650, y: 330,
    type: 'corridor',
    capacity: 15,
  },
  // West corridor connecting room 204 to center
  {
    id: 'csb-corridor-west',
    label: 'West Corridor',
    x: 380, y: 320,
    type: 'corridor',
    capacity: 15,
  },

  // Stairs
  {
    id: 'csb-stairs',
    label: 'Stairwell',
    x: 500, y: 280,
    type: 'stairs',
    capacity: 10,
    bounds: { x: 450, y: 240, w: 100, h: 80 },
  },

  // Exits
  {
    id: 'csb-exit-e1',
    label: 'Exit E1',
    x: 350, y: 85,
    type: 'exit',
    capacity: 8,
  },
  {
    id: 'csb-exit-e2',
    label: 'Exit E2',
    x: 350, y: 595,
    type: 'exit',
    capacity: 8,
  },
  {
    id: 'csb-exit-e3',
    label: 'Exit E3',
    x: 610, y: 595,
    type: 'exit',
    capacity: 8,
  },
]

const CSB_2F_EDGES: NavEdge[] = [
  // Room 204 ↔ West Corridor (door at ~290)
  { from: 'csb-room-204', to: 'csb-corridor-west', distance: 8, width: 1.5, blockable: true },
  // Room 204 top door ↔ North Corridor
  { from: 'csb-room-204', to: 'csb-corridor-north', distance: 16, width: 1.5, blockable: true },

  // Room 203 ↔ East Corridor
  { from: 'csb-room-203', to: 'csb-corridor-east', distance: 10, width: 1.5, blockable: true },
  { from: 'csb-room-203', to: 'csb-corridor-north', distance: 14, width: 1.5, blockable: false },
  // Room 202 ↔ East Corridor
  { from: 'csb-room-202', to: 'csb-corridor-east', distance: 8, width: 1.5, blockable: true },
  // Room 201 ↔ East Corridor
  { from: 'csb-room-201', to: 'csb-corridor-east', distance: 12, width: 1.5, blockable: true },
  { from: 'csb-room-201', to: 'csb-corridor-south', distance: 14, width: 1.5, blockable: true },

  // Corridor interconnections
  { from: 'csb-corridor-west', to: 'csb-corridor-center', distance: 14, width: 2.0, blockable: false },
  { from: 'csb-corridor-east', to: 'csb-corridor-center', distance: 14, width: 2.0, blockable: false },
  { from: 'csb-corridor-center', to: 'csb-corridor-south', distance: 16, width: 2.5, blockable: true },
  { from: 'csb-corridor-north', to: 'csb-corridor-west', distance: 14, width: 2.0, blockable: true },
  { from: 'csb-corridor-center', to: 'csb-stairs', distance: 12, width: 2.0, blockable: false },
  { from: 'csb-stairs', to: 'csb-corridor-north', distance: 10, width: 1.5, blockable: false },

  // Exits
  { from: 'csb-exit-e1', to: 'csb-corridor-north', distance: 8, width: 1.8, blockable: true },
  { from: 'csb-exit-e2', to: 'csb-corridor-south', distance: 6, width: 1.8, blockable: true },
  { from: 'csb-exit-e2', to: 'csb-corridor-west', distance: 18, width: 1.8, blockable: true },
  { from: 'csb-exit-e3', to: 'csb-corridor-south', distance: 6, width: 1.8, blockable: true },
  { from: 'csb-exit-e3', to: 'csb-corridor-east', distance: 16, width: 1.8, blockable: true },
]

const CSB_FIRE_HAZARDS: HazardZone[] = [
  { id: 'csb-fire-1', type: 'fire', x: 500, y: 130, radius: 30, growthRate: 8, appearsAt: 0 },
  { id: 'csb-smoke-1', type: 'smoke', x: 450, y: 300, radius: 40, growthRate: 10, appearsAt: 4 },
  { id: 'csb-fire-2', type: 'fire', x: 380, y: 440, radius: 20, growthRate: 6, appearsAt: 10 },
  { id: 'csb-blocked-e1', type: 'blocked', x: 350, y: 110, radius: 28, growthRate: 0, appearsAt: 6 },
]

const CSB_EARTHQUAKE_HAZARDS: HazardZone[] = [
  { id: 'csb-debris-1', type: 'debris', x: 500, y: 350, radius: 35, growthRate: 2, appearsAt: 2 },
  { id: 'csb-debris-2', type: 'debris', x: 650, y: 500, radius: 30, growthRate: 1, appearsAt: 5 },
  { id: 'csb-blocked-e2', type: 'blocked', x: 350, y: 570, radius: 25, growthRate: 0, appearsAt: 0 },
  { id: 'csb-debris-3', type: 'debris', x: 420, y: 200, radius: 25, growthRate: 3, appearsAt: 8 },
]

export const CSB_BUILDING: BuildingModel = {
  id: 'science-building',
  name: 'College of Science Building',
  floors: [
    {
      id: 'csb-2f',
      label: '2nd Floor',
      floorplanSrc: '/floorplans/csb-2f.svg',
      nodes: CSB_2F_NODES,
      edges: CSB_2F_EDGES,
      hazards: {
        fire: CSB_FIRE_HAZARDS,
        earthquake: CSB_EARTHQUAKE_HAZARDS,
      },
    },
  ],
}

/* ── Building registry ── */
const BUILDING_REGISTRY: Record<string, BuildingModel> = {
  'admin-building': ADMIN_BUILDING,
  'science-building': CSB_BUILDING,
}

export function getBuildingById(id: string): BuildingModel | undefined {
  return BUILDING_REGISTRY[id]
}

/* ── Graph utilities ── */

export function getNode(floor: FloorModel, id: string): NavNode | undefined {
  return floor.nodes.find(n => n.id === id)
}

export function getNeighbors(floor: FloorModel, nodeId: string): { node: NavNode; edge: NavEdge }[] {
  const results: { node: NavNode; edge: NavEdge }[] = []
  for (const edge of floor.edges) {
    let neighborId: string | null = null
    if (edge.from === nodeId) neighborId = edge.to
    else if (edge.to === nodeId) neighborId = edge.from
    if (neighborId) {
      const node = getNode(floor, neighborId)
      if (node) results.push({ node, edge })
    }
  }
  return results
}

export function getExits(floor: FloorModel): NavNode[] {
  return floor.nodes.filter(n => n.type === 'exit')
}

export function getRooms(floor: FloorModel): NavNode[] {
  return floor.nodes.filter(n => n.type === 'room')
}

/** Dijkstra shortest path from a node to the nearest exit */
export function findShortestPathToExit(
  floor: FloorModel,
  startId: string,
  blockedEdges: Set<string> = new Set(),
): { path: string[]; distance: number; exitId: string } | null {
  const exits = getExits(floor)
  if (exits.length === 0) return null

  const dist: Record<string, number> = {}
  const prev: Record<string, string | null> = {}
  const visited = new Set<string>()

  for (const n of floor.nodes) {
    dist[n.id] = Infinity
    prev[n.id] = null
  }
  dist[startId] = 0

  while (true) {
    let current: string | null = null
    let minDist = Infinity
    for (const n of floor.nodes) {
      if (!visited.has(n.id) && dist[n.id] < minDist) {
        minDist = dist[n.id]
        current = n.id
      }
    }
    if (current === null) break
    visited.add(current)

    // Check if this is an exit
    const currentNode = getNode(floor, current)
    if (currentNode?.type === 'exit') {
      // Build path
      const path: string[] = []
      let c: string | null = current
      while (c) {
        path.unshift(c)
        c = prev[c]
      }
      return { path, distance: dist[current], exitId: current }
    }

    // Explore neighbors
    for (const { node: neighbor, edge } of getNeighbors(floor, current)) {
      const edgeKey = `${edge.from}-${edge.to}`
      const edgeKeyR = `${edge.to}-${edge.from}`
      if (blockedEdges.has(edgeKey) || blockedEdges.has(edgeKeyR)) continue

      const alt = dist[current] + edge.distance
      if (alt < dist[neighbor.id]) {
        dist[neighbor.id] = alt
        prev[neighbor.id] = current
      }
    }
  }

  return null
}

/** Get edge key for lookups */
export function edgeKey(from: string, to: string): string {
  return from < to ? `${from}-${to}` : `${to}-${from}`
}
