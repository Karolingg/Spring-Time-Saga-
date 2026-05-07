import type { HazardZone } from './building-model'
import { hazardGrowthRate, hazardMaxRadius, type HazardType } from './hazard-physics'

export type HazardDisaster = 'fire' | 'earthquake'
export type { HazardType }

export interface PlacedHazard {
  id: string
  type: HazardType
  x: number
  y: number
  radius: number
}

export interface HazardPlan {
  version: 1
  hazards: PlacedHazard[]
  updatedAt: string
}

const DEFAULT_RADII: Record<HazardType, number> = {
  fire: 38,
  smoke: 46,
  debris: 34,
}

export function getDefaultHazardRadius(type: HazardType): number {
  return DEFAULT_RADII[type]
}

export function getHazardStorageKey(buildingId: string, floorIndex: number, disaster: HazardDisaster): string {
  return `hazards:${buildingId}:${floorIndex}:${disaster}`
}

export function loadHazardPlan(storageKey: string): HazardPlan | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as HazardPlan
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.hazards)) return null
    return parsed
  } catch {
    return null
  }
}

export function saveHazardPlan(storageKey: string, hazards: PlacedHazard[]): void {
  if (typeof window === 'undefined') return
  const payload: HazardPlan = {
    version: 1,
    hazards,
    updatedAt: new Date().toISOString(),
  }
  window.localStorage.setItem(storageKey, JSON.stringify(payload))
}

// Hazard physics live in `./hazard-physics`. Re-exported here so any
// historical caller that still imports from this module keeps working.
export { hazardGrowthRate, hazardMaxRadius }

export function placedHazardToZone(placed: PlacedHazard, prefix = 'hz'): HazardZone {
  return {
    id: `${prefix}-${placed.id}`,
    type: placed.type,
    x: placed.x,
    y: placed.y,
    radius: placed.radius,
    growthRate: hazardGrowthRate(placed.type),
    appearsAt: 0,
    maxRadius: hazardMaxRadius(placed.type, placed.radius),
  }
}
