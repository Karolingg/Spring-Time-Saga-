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
}

export interface RoomDef {
  label: string
  x: number
  y: number
  // Optional explicit room->corridor entry node to avoid invalid shortcuts.
  corridorEntryNode?: string
}

export interface CorridorNode {
  label: string
  x: number
  y: number
  neighbors?: string[]
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
