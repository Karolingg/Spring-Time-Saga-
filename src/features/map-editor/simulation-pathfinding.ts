import type { Grid } from './simulation-grid'
import { cellFromIndex, cellIndex, isWalkableCell } from './simulation-grid'

export function buildDistanceField(grid: Grid, exitCells: number[]): number[] {
  const distances = new Array(grid.walkable.length).fill(Number.POSITIVE_INFINITY)
  const queue: number[] = []

  exitCells.forEach((index) => {
    distances[index] = 0
    queue.push(index)
  })

  while (queue.length > 0) {
    const current = queue.shift()
    if (current === undefined) break
    const neighbors = getNeighborIndexes(current, grid)
    for (const neighbor of neighbors) {
      if (!isWalkableCell(neighbor, grid)) continue
      if (distances[neighbor] <= distances[current] + 1) continue
      distances[neighbor] = distances[current] + 1
      queue.push(neighbor)
    }
  }

  return distances
}

export function getNextCell(index: number, grid: Grid, distances: number[]): number {
  const neighbors = getNeighborIndexes(index, grid)
  const best = neighbors.reduce((bestIndex, neighbor) => {
    if (distances[neighbor] < distances[bestIndex]) return neighbor
    return bestIndex
  }, index)
  return best
}

function getNeighborIndexes(index: number, grid: Grid): number[] {
  const cell = cellFromIndex(index, grid)
  const candidates = [
    { col: cell.col - 1, row: cell.row },
    { col: cell.col + 1, row: cell.row },
    { col: cell.col, row: cell.row - 1 },
    { col: cell.col, row: cell.row + 1 },
    { col: cell.col - 1, row: cell.row - 1 },
    { col: cell.col + 1, row: cell.row - 1 },
    { col: cell.col - 1, row: cell.row + 1 },
    { col: cell.col + 1, row: cell.row + 1 },
  ]
  return candidates
    .filter((candidate) => candidate.col >= 0 && candidate.col < grid.cols && candidate.row >= 0 && candidate.row < grid.rows)
    .map((candidate) => cellIndex(candidate, grid))
}
