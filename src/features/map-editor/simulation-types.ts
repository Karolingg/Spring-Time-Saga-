import type { Point } from './map-types'

export type AgentStrategy = 'greedy' | 'random'

export interface Agent {
  id: string
  position: Point
  target: Point
  cellIndex: number
  targetCellIndex: number
  status: 'moving' | 'exited' | 'stuck'
  strategy: AgentStrategy
  exitZoneIndex: number | null
}

export interface SimulationState {
  agents: Agent[]
  exitedCount: number
  running: boolean
  elapsedMs: number
}
