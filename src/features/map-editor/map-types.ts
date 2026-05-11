export type ZoneType = 'spawn' | 'walkable' | 'exit'
export type ZoneShape = 'rect' | 'polygon'
export type EditorTool = 'select' | 'rect' | 'polygon' | 'pan'

export interface Point {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface SpawnSettings {
  maxAgents: number
  spawnCount: number
}

export interface ZoneBase {
  id: string
  name: string
  type: ZoneType
  shape: ZoneShape
  maxAgents?: number
  spawnCount?: number
}

export interface RectZone extends ZoneBase {
  shape: 'rect'
  rect: Rect
}

export interface PolygonZone extends ZoneBase {
  shape: 'polygon'
  points: Point[]
}

export type Zone = RectZone | PolygonZone

export interface MapImage {
  id: string
  name: string
  src: string
  width: number
  height: number
}

export interface MapLayout {
  id: string
  name: string
  image: MapImage
  zones: Zone[]
  createdAt: string
  updatedAt: string
}

export interface ViewBox {
  x: number
  y: number
  width: number
  height: number
}
