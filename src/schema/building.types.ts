import type { RiskLevel } from './enums'

export interface Building {
  id: string
  name: string
  type: string
  polygon: [number, number][] // [lat, lng] pairs
  capacity: number
  floors: number
  exits: number
  riskLevel: RiskLevel
  lastDrillDate: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface RunTag {
  id: string
  runId: string
  tag: string
  createdAt: string
}

export interface AuditLog {
  id: string
  userId: string | null
  action: string
  resourceType: 'run' | 'profile' | 'building' | 'drill'
  resourceId: string
  changesJson: Record<string, unknown> | null
  ipAddress: string | null
  createdAt: string
}

export interface DensityCell {
  id: string
  runId: string
  cellX: number
  cellY: number
  peakDensity: number
  step: number
}
