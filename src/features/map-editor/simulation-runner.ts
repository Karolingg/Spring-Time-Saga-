import type { Agent, AgentStrategy, SimulationState } from './simulation-types'
import type { Point, Zone } from './map-types'
import { clampNumber, pointInPolygon } from './geometry'
import { getZonePoints } from './zone-utils'
import { buildDistanceField } from './simulation-pathfinding'
import {
  cellIndex,
  cellToPoint,
  createGrid,
  isWalkableCell,
  markWalkable,
  pointToCell,
  type Grid,
} from './simulation-grid'

const GRID_CELL_SIZE = 12
const AGENT_SPEED = 48
const MAX_SPAWN_ATTEMPTS = 25
const RANDOM_STRATEGY_RATE = 0.45
const RANDOM_CHOICE_POOL = 3

export interface SimulationContext {
  grid: Grid
  greedyDistances: number[]
  exitCells: number[]
  exitZoneCells: number[][]
  exitZoneDistances: number[][]
}

export function buildSimulationContext(width: number, height: number, zones: Zone[]): SimulationContext {
  const grid = markWalkable(createGrid(width, height, GRID_CELL_SIZE), zones)
  const exitZones = zones.filter((zone) => zone.type === 'exit')
  const exitZoneCells = exitZones.map((zone) => getExitCellsForZone(grid, zone))
  const exitCells = unionCells(exitZoneCells)
  return {
    grid,
    exitCells,
    greedyDistances: buildDistanceField(grid, exitCells),
    exitZoneCells,
    exitZoneDistances: exitZoneCells.map((cells) => buildDistanceField(grid, cells)),
  }
}

export function createSimulationState(zones: Zone[], maxAgents: number, context: SimulationContext): SimulationState {
  const spawnZones = zones.filter((zone) => zone.type === 'spawn')
  const agents = spawnAgents(spawnZones, maxAgents, context)
  return {
    agents,
    exitedCount: 0,
    running: false,
    elapsedMs: 0,
  }
}

export function stepSimulation(state: SimulationState, context: SimulationContext, dtMs: number): SimulationState {
  const occupied = buildOccupiedSet(state.agents)
  const nextAgents = state.agents.map((agent) => stepAgent(agent, context, dtMs, occupied))
  const exited = nextAgents.filter((agent) => agent.status === 'exited').length
  return {
    agents: nextAgents,
    exitedCount: exited,
    running: state.running,
    elapsedMs: state.elapsedMs + dtMs,
  }
}

function stepAgent(agent: Agent, context: SimulationContext, dtMs: number, occupied: Set<number>): Agent {
  if (agent.status !== 'moving') return agent
  const targetCellIndex = agent.targetCellIndex ?? agent.cellIndex
  let nextTargetCell = targetCellIndex
  let nextTarget = agent.target

  if (targetCellIndex === agent.cellIndex) {
    const chosenCell = chooseNextCell(agent, context, occupied)
    if (chosenCell !== agent.cellIndex) {
      nextTargetCell = chosenCell
      nextTarget = cellToPoint(cellFromIndex(chosenCell, context.grid), context.grid)
      occupied.add(chosenCell)
    } else {
      return agent
    }
  }

  const nextPosition = moveToward(agent.position, nextTarget, dtMs)
  const reached = distanceBetween(nextPosition, nextTarget) < 1
  const updatedCell = reached ? nextTargetCell : agent.cellIndex
  const status = reached && isExitCell(nextTargetCell, agent, context) ? 'exited' : agent.status

  return {
    ...agent,
    position: nextPosition,
    target: nextTarget,
    cellIndex: updatedCell,
    targetCellIndex: nextTargetCell,
    status,
  }
}

function moveToward(position: Point, target: Point, dtMs: number): Point {
  const distance = distanceBetween(position, target)
  if (distance === 0) return position
  const step = (AGENT_SPEED * dtMs) / 1000
  const ratio = clampNumber(step / distance, 0, 1)
  return {
    x: position.x + (target.x - position.x) * ratio,
    y: position.y + (target.y - position.y) * ratio,
  }
}

function spawnAgents(zones: Zone[], maxAgents: number, context: SimulationContext): Agent[] {
  const desiredCounts = zones.map((zone) => Math.min(getSpawnCount(zone), getZoneMaxAgents(zone)))
  const totalRequested = desiredCounts.reduce((sum, count) => sum + count, 0)
  const scale = totalRequested > maxAgents && totalRequested > 0 ? maxAgents / totalRequested : 1
  const agents: Agent[] = []
  const occupied = new Set<number>()

  zones.forEach((zone, index) => {
    const count = Math.max(0, Math.floor(desiredCounts[index] * scale))
    const candidates = getSpawnCells(zone, context.grid)
    const shuffled = shuffleArray(candidates)
    let spawned = 0
    for (const cell of shuffled) {
      if (spawned >= count) break
      if (occupied.has(cell)) continue
      const agent = createAgent(zone, cell, context)
      occupied.add(cell)
      agents.push(agent)
      spawned += 1
    }
  })

  return agents
}

function getSpawnCount(zone: Zone): number {
  if (zone.type !== 'spawn') return 0
  return Number(zone.spawnCount ?? 40)
}

function getZoneMaxAgents(zone: Zone): number {
  if (zone.type !== 'spawn') return 0
  return Number(zone.maxAgents ?? 60)
}

function createAgent(zone: Zone, cell: number, context: SimulationContext): Agent {
  const point = cellToPoint(cellFromIndex(cell, context.grid), context.grid)
  const strategy = pickAgentStrategy(context)
  const exitZoneIndex = pickExitZoneIndex(strategy, context)
  return {
    id: `agent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    position: point,
    target: point,
    cellIndex: cell,
    targetCellIndex: cell,
    status: 'moving',
    strategy,
    exitZoneIndex,
  }
}

function getSpawnCells(zone: Zone, grid: Grid): number[] {
  const polygon = getZonePoints(zone)
  const candidates: number[] = []
  const walkableCandidates: number[] = []
  for (let row = 0; row < grid.rows; row += 1) {
    for (let col = 0; col < grid.cols; col += 1) {
      const center = cellToPoint({ col, row }, grid)
      if (pointInPolygon(center, polygon)) {
        const index = cellIndex({ col, row }, grid)
        candidates.push(index)
        if (grid.walkable[index]) {
          walkableCandidates.push(index)
        }
      }
    }
  }
  if (walkableCandidates.length > 0) return walkableCandidates
  if (candidates.length > 0) return candidates
  return fallbackSpawnCells(zone, grid)
}

function fallbackSpawnCells(zone: Zone, grid: Grid): number[] {
  const polygon = getZonePoints(zone)
  const bounds = getBounds(polygon)
  const fallbackCells: number[] = []
  for (let i = 0; i < MAX_SPAWN_ATTEMPTS; i += 1) {
    const candidate = {
      x: bounds.x + Math.random() * bounds.width,
      y: bounds.y + Math.random() * bounds.height,
    }
    if (pointInPolygon(candidate, polygon)) {
      const cell = pointToCell(candidate, grid)
      fallbackCells.push(cellIndex(cell, grid))
    }
  }
  if (fallbackCells.length > 0) return fallbackCells
  const centerCell = pointToCell(centerOfBounds(bounds), grid)
  return [cellIndex(centerCell, grid)]
}

function getExitCellsForZone(grid: Grid, zone: Zone): number[] {
  const cells: number[] = []
  for (let row = 0; row < grid.rows; row += 1) {
    for (let col = 0; col < grid.cols; col += 1) {
      const center = cellToPoint({ col, row }, grid)
      if (pointInPolygon(center, getZonePoints(zone))) {
        cells.push(cellIndex({ col, row }, grid))
      }
    }
  }
  return cells
}

function unionCells(groups: number[][]): number[] {
  const unique = new Set<number>()
  groups.forEach((cells) => cells.forEach((cell) => unique.add(cell)))
  return Array.from(unique)
}

function buildOccupiedSet(agents: Agent[]): Set<number> {
  const occupied = new Set<number>()
  agents.forEach((agent) => {
    if (agent.status === 'exited') return
    occupied.add(agent.cellIndex)
    if (agent.targetCellIndex !== agent.cellIndex) occupied.add(agent.targetCellIndex)
  })
  return occupied
}

function chooseNextCell(agent: Agent, context: SimulationContext, occupied: Set<number>): number {
  const neighbors = getNeighborIndexes(agent.cellIndex, context.grid)
    .filter((index) => isWalkableCell(index, context.grid))
    .filter((index) => !occupied.has(index))
  if (neighbors.length === 0) return agent.cellIndex

  const distances = getAgentDistances(agent, context)
  const currentDistance = distances[agent.cellIndex]
  const improving = neighbors.filter((index) => distances[index] < currentDistance)
  const equal = neighbors.filter((index) => distances[index] === currentDistance)

  if (agent.strategy === 'random') {
    const candidates = improving.length > 0 ? improving : neighbors
    const sorted = [...candidates].sort((a, b) => distances[a] - distances[b])
    const pool = sorted.slice(0, Math.min(RANDOM_CHOICE_POOL, sorted.length))
    return pool[Math.floor(Math.random() * pool.length)]
  }

  if (improving.length === 0 && equal.length > 0) {
    return equal[Math.floor(Math.random() * equal.length)]
  }
  if (improving.length === 0) {
    return neighbors.reduce((bestIndex, neighbor) => {
      if (distances[neighbor] < distances[bestIndex]) return neighbor
      return bestIndex
    }, neighbors[0])
  }

  return improving.reduce((bestIndex, neighbor) => {
    if (distances[neighbor] < distances[bestIndex]) return neighbor
    return bestIndex
  }, improving[0])
}

function getAgentDistances(agent: Agent, context: SimulationContext): number[] {
  if (agent.strategy === 'random' && agent.exitZoneIndex !== null) {
    return context.exitZoneDistances[agent.exitZoneIndex] ?? context.greedyDistances
  }
  return context.greedyDistances
}

function isExitCell(cell: number, agent: Agent, context: SimulationContext): boolean {
  const distances = getAgentDistances(agent, context)
  return distances[cell] === 0
}

function pickAgentStrategy(context: SimulationContext): AgentStrategy {
  if (context.exitZoneCells.length === 0) return 'greedy'
  return Math.random() < RANDOM_STRATEGY_RATE ? 'random' : 'greedy'
}

function pickExitZoneIndex(strategy: AgentStrategy, context: SimulationContext): number | null {
  if (strategy !== 'random' || context.exitZoneCells.length === 0) return null
  return Math.floor(Math.random() * context.exitZoneCells.length)
}

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = copy[i]
    copy[i] = copy[j]
    copy[j] = temp
  }
  return copy
}

function getBounds(points: Point[]) {
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
}

function centerOfBounds(bounds: { x: number; y: number; width: number; height: number }): Point {
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
}

function distanceBetween(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
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

function cellFromIndex(index: number, grid: Grid) {
  const row = Math.floor(index / grid.cols)
  const col = index % grid.cols
  return { col, row }
}
