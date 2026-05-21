export type DisasterType = 'fire' | 'earthquake'

export interface Point {
  x: number
  y: number
}

export interface ExitDef {
  x: number
  y: number
  label: string
  desc: string
}

export interface ObstacleDef {
  id: string
  x: number
  y: number
  w: number
  h: number
  type: 'fire' | 'smoke' | 'debris'
  label: string
  blocksExits: string[]
  appearsAt?: number
}

export interface RoomDef {
  label: string
  x: number
  y: number
  corridorEntryNode?: string
  corridorEntryNodes?: string[]
}

export type CorridorNodeKind = 'corridor' | 'junction' | 'door' | 'corner' | 'stairs'

export interface CorridorNeighborDef {
  label: string
  width?: number
  blockable?: boolean
  fragile?: boolean
}

export interface CorridorNode {
  label: string
  x: number
  y: number
  kind?: CorridorNodeKind
  capacity?: number
  neighbors?: Array<string | CorridorNeighborDef>
}

export interface FloorConfig {
  viewWidth: number
  viewHeight: number
  exits: Record<string, ExitDef>
  startPos: Point
  primaryPaths: Record<string, Point[]>
  reroutes: Record<string, { to: string; path: Point[] }>
  blockT: Record<string, number>
  obstacles: Record<DisasterType, ObstacleDef[]>
  efficiency: Record<string, number>
  floorLabel: string
  rooms: Record<string, RoomDef>
  corridorNodes?: CorridorNode[]
}
