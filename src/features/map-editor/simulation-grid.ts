import type { Point, Rect, Zone } from './map-types'
import { pointInPolygon, rectToPoints } from './geometry'
import { getZonePoints } from './zone-utils'

export interface Grid {
  cellSize: number
  cols: number
  rows: number
  walkable: boolean[]
  width: number
  height: number
}

export interface GridCell {
  col: number
  row: number
}

export function createGrid(width: number, height: number, cellSize: number): Grid {
  const cols = Math.ceil(width / cellSize)
  const rows = Math.ceil(height / cellSize)
  return {
    cellSize,
    cols,
    rows,
    walkable: new Array(cols * rows).fill(false),
    width,
    height,
  }
}

export function pointToCell(point: Point, grid: Grid): GridCell {
  return {
    col: Math.max(0, Math.min(grid.cols - 1, Math.floor(point.x / grid.cellSize))),
    row: Math.max(0, Math.min(grid.rows - 1, Math.floor(point.y / grid.cellSize))),
  }
}

export function cellToPoint(cell: GridCell, grid: Grid): Point {
  return {
    x: cell.col * grid.cellSize + grid.cellSize / 2,
    y: cell.row * grid.cellSize + grid.cellSize / 2,
  }
}

export function cellIndex(cell: GridCell, grid: Grid): number {
  return cell.row * grid.cols + cell.col
}

export function cellFromIndex(index: number, grid: Grid): GridCell {
  const row = Math.floor(index / grid.cols)
  const col = index % grid.cols
  return { col, row }
}

export function isWalkableCell(index: number, grid: Grid): boolean {
  return grid.walkable[index] === true
}

export function markWalkable(grid: Grid, zones: Zone[]): Grid {
  const walkableZones = zones.filter((zone) => (
    zone.type === 'walkable' || zone.type === 'exit' || zone.type === 'spawn'
  ))
  for (let row = 0; row < grid.rows; row += 1) {
    for (let col = 0; col < grid.cols; col += 1) {
      const center = cellToPoint({ col, row }, grid)
      if (isInsideZones(center, walkableZones)) {
        grid.walkable[cellIndex({ col, row }, grid)] = true
      }
    }
  }
  return grid
}

function isInsideZones(point: Point, zones: Zone[]): boolean {
  return zones.some((zone) => pointInPolygon(point, getZonePoints(zone)))
}

export function getZoneBounds(zone: Zone): Rect {
  return zone.shape === 'rect' ? zone.rect : getBoundsForPoints(zone.points)
}

function getBoundsForPoints(points: Point[]): Rect {
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
}

export function getRectPoints(rect: Rect): Point[] {
  return rectToPoints(rect)
}
