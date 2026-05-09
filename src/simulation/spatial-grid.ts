import type { DensityCell } from '@/src/schema/simulation.types'

export const GRID_VIEW_WIDTH = 1200
export const GRID_VIEW_HEIGHT = 675
export const GRID_CELL_SIZE = 25
export const GRID_COLS = GRID_VIEW_WIDTH / GRID_CELL_SIZE
export const GRID_ROWS = GRID_VIEW_HEIGHT / GRID_CELL_SIZE

export interface SpatialPoint {
  x: number
  y: number
}

export interface GridCellCoord {
  cellX: number
  cellY: number
}

export interface SpatialGridCellTrace {
  cellX: number
  cellY: number
  peakDensity: number
  cumulativeDensity: number
  peakStep: number
}

export interface RenderableGridCell extends SpatialGridCellTrace {
  intensity: number
  liveDensity: number
  hazardIntensity: number
}

export interface SpatialGridTrace {
  tickCount: number
  totalSeconds: number
  cells: Record<string, SpatialGridCellTrace>
  liveDensity: Record<string, number>
  liveHazardIntensity: Record<string, number>
}

export interface SpatialHazard {
  x: number
  y: number
  currentRadius: number
  active: boolean
}

export function clampGridCell(value: number, maxExclusive: number): number {
  return Math.min(Math.max(Math.floor(value), 0), maxExclusive - 1)
}

export function pointToGridCell(point: SpatialPoint): GridCellCoord {
  return {
    cellX: clampGridCell(point.x / GRID_CELL_SIZE, GRID_COLS),
    cellY: clampGridCell(point.y / GRID_CELL_SIZE, GRID_ROWS),
  }
}

export function gridCellKey(cellX: number, cellY: number): string {
  return `${cellX}:${cellY}`
}

export function createSpatialGridTrace(): SpatialGridTrace {
  return {
    tickCount: 0,
    totalSeconds: 0,
    cells: {},
    liveDensity: {},
    liveHazardIntensity: {},
  }
}

export function updateSpatialGridTrace(
  trace: SpatialGridTrace,
  agentPositions: SpatialPoint[],
  hazards: SpatialHazard[],
  dt: number,
): SpatialGridTrace {
  const liveDensity: Record<string, number> = {}

  for (const position of agentPositions) {
    const { cellX, cellY } = pointToGridCell(position)
    const key = gridCellKey(cellX, cellY)
    liveDensity[key] = (liveDensity[key] || 0) + 1
  }

  const nextCells: Record<string, SpatialGridCellTrace> = { ...trace.cells }
  const nextTick = trace.tickCount + 1

  for (const [key, density] of Object.entries(liveDensity)) {
    const [cellXRaw, cellYRaw] = key.split(':')
    const cellX = Number(cellXRaw)
    const cellY = Number(cellYRaw)
    const existing = nextCells[key] ?? {
      cellX,
      cellY,
      peakDensity: 0,
      cumulativeDensity: 0,
      peakStep: nextTick,
    }
    const isNewPeak = density > existing.peakDensity
    nextCells[key] = {
      ...existing,
      peakDensity: Math.max(existing.peakDensity, density),
      cumulativeDensity: existing.cumulativeDensity + density * dt,
      peakStep: isNewPeak ? nextTick : existing.peakStep,
    }
  }

  return {
    tickCount: nextTick,
    totalSeconds: trace.totalSeconds + dt,
    cells: nextCells,
    liveDensity,
    liveHazardIntensity: computeLiveHazardIntensity(hazards),
  }
}

export function getRenderableGridCells(trace: SpatialGridTrace): RenderableGridCell[] {
  const maxDensity = Math.max(
    ...Object.values(trace.cells).map((cell) => cell.peakDensity),
    ...Object.values(trace.liveDensity),
    0,
  )

  return Object.values(trace.cells)
    .map((cell) => {
      const key = gridCellKey(cell.cellX, cell.cellY)
      const liveDensity = trace.liveDensity[key] || 0
      const displayDensity = Math.max(cell.peakDensity, liveDensity)
      return {
        ...cell,
        liveDensity,
        hazardIntensity: trace.liveHazardIntensity[key] || 0,
        intensity: maxDensity > 0 ? displayDensity / maxDensity : 0,
      }
    })
    .filter((cell) => cell.intensity > 0 || cell.hazardIntensity > 0)
}

export function densityCellsFromTrace(trace: SpatialGridTrace): Omit<DensityCell, 'id' | 'runId'>[] {
  return Object.values(trace.cells)
    .filter((cell) => cell.peakDensity > 0)
    .sort((left, right) => (
      left.cellY === right.cellY ? left.cellX - right.cellX : left.cellY - right.cellY
    ))
    .map((cell) => ({
      cellX: cell.cellX,
      cellY: cell.cellY,
      peakDensity: cell.peakDensity,
      step: cell.peakStep,
    }))
}

export function renderableCellsFromDensityCells(cells: DensityCell[]): RenderableGridCell[] {
  const maxDensity = Math.max(...cells.map((cell) => cell.peakDensity), 0)

  return cells.map((cell) => ({
    cellX: cell.cellX,
    cellY: cell.cellY,
    peakDensity: cell.peakDensity,
    cumulativeDensity: 0,
    peakStep: cell.step,
    liveDensity: 0,
    hazardIntensity: 0,
    intensity: maxDensity > 0 ? cell.peakDensity / maxDensity : 0,
  }))
}

export function gridCellRect(cell: GridCellCoord) {
  return {
    x: cell.cellX * GRID_CELL_SIZE,
    y: cell.cellY * GRID_CELL_SIZE,
    width: GRID_CELL_SIZE,
    height: GRID_CELL_SIZE,
  }
}

function computeLiveHazardIntensity(hazards: SpatialHazard[]): Record<string, number> {
  const intensity: Record<string, number> = {}

  for (const hazard of hazards) {
    if (!hazard.active || hazard.currentRadius <= 0) continue

    const minCell = pointToGridCell({
      x: hazard.x - hazard.currentRadius,
      y: hazard.y - hazard.currentRadius,
    })
    const maxCell = pointToGridCell({
      x: hazard.x + hazard.currentRadius,
      y: hazard.y + hazard.currentRadius,
    })

    for (let cellY = minCell.cellY; cellY <= maxCell.cellY; cellY++) {
      for (let cellX = minCell.cellX; cellX <= maxCell.cellX; cellX++) {
        const centerX = cellX * GRID_CELL_SIZE + GRID_CELL_SIZE / 2
        const centerY = cellY * GRID_CELL_SIZE + GRID_CELL_SIZE / 2
        const distance = Math.hypot(centerX - hazard.x, centerY - hazard.y)
        if (distance > hazard.currentRadius) continue
        const key = gridCellKey(cellX, cellY)
        const cellIntensity = 1 - distance / hazard.currentRadius
        intensity[key] = Math.max(intensity[key] || 0, cellIntensity)
      }
    }
  }

  return intensity
}
