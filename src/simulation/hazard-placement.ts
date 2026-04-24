import type { HazardZone } from './building-model'

export type HazardDisaster = 'fire' | 'earthquake'
export type HazardType = 'fire' | 'smoke' | 'debris'

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

export function hazardGrowthRate(type: HazardType): number {
  switch (type) {
    case 'fire':
      return 5
    case 'smoke':
      return 8
    case 'debris':
      return 2
  }
}

export function hazardMaxRadius(type: HazardType, initial: number): number {
  const multiplier = type === 'smoke' ? 3 : type === 'fire' ? 2.5 : 2
  return Math.max(80, initial * multiplier)
}

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
