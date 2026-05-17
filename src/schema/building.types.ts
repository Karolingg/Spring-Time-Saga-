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
