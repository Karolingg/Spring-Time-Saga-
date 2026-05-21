import type { DisasterType, RiskLevel, SeverityLevel, SimulationStatus } from './enums'
import type { PlacedHazard } from '@/src/simulation/hazard-placement'

export interface SimulationConfig {
  disasterType: DisasterType
  agentCount: number
  gridWidth: number
  gridHeight: number
  exitCount: number
  wallDensity: number
  speedMs: number
}

export interface SimulationResults {
  totalSteps: number
  evacuatedCount: number
  maxCongestion: number
  evacuationTime: number
  congestionExposure: number
  globalPeakDensity: number
  status: SimulationStatus
}

export interface SimulationRun {
  id: string
  userId: string
  disasterType: DisasterType
  status: SimulationStatus
  buildingId: string | null
  floorIndex: number | null
  /** Hazards the user placed on the map before running. Used by the replay
   *  view to reproduce fire/smoke/debris in the same spots. */
  hazards: PlacedHazard[] | null
  /** Per-room agent allocation used by the run; lets replay reproduce the
   *  exact population distribution across rooms. */
  agentsPerRoom: Record<string, number> | null
  /** RNG seed captured at run launch so reaction delays, speeds, and
   *  routing jitter can be replayed agent-for-agent. */
  seed: number | null
  notes: string | null
  createdAt: string
  updatedAt: string
  config: SimulationRunConfig | null
  results: SimulationRunResults | null
  zones: SimulationZone[]
  bottlenecks: SimulationBottleneck[]
}

export interface SimulationRunConfig {
  id: string
  runId: string
  agentCount: number
  gridWidth: number
  gridHeight: number
  exitCount: number
  wallDensity: number
  speedMs: number
}

export interface SimulationRunResults {
  id: string
  runId: string
  totalSteps: number
  evacuatedCount: number
  maxCongestion: number
  evacuationTime: number
  congestionExposure: number
  globalPeakDensity: number
}

export interface SimulationZone {
  id: string
  runId: string
  zoneName: string
  intensity: number
  agentCount: number
  bottleneckCount: number
  riskLevel: RiskLevel
  lat: number | null
  lng: number | null
}

export interface SimulationBottleneck {
  id: string
  runId: string
  zoneName: string
  severity: SeverityLevel
  cellX: number | null
  cellY: number | null
  description: string | null
}

export interface DensityCell {
  id: string
  runId: string
  cellX: number
  cellY: number
  peakDensity: number
  step: number
}
