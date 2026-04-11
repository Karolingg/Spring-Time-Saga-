import type { DisasterType, RiskLevel, SeverityLevel, SimulationStatus } from './enums'

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
