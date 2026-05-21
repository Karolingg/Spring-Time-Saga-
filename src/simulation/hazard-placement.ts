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

/**
 * Classify a fire-disaster run's severity from the hazards placed on the floor.
 *
 * Used by the Evacuation Readiness Score to weight a run's contribution and
 * to enforce the mandatory-coverage cap (see `building-analytics.service.ts`).
 * Fire severity comes from how many sources are present and what type:
 *
 *   • fire zones count double — an active fire blocks hard, escalates fast
 *   • smoke zones count single — soft block, slow agents but rarely trap
 *
 * Buckets (matching the earthquake scenario tiers):
 *   • score ≤ 1  → minor       (no hazards, or one smoke zone)
 *   • score ≤ 3  → moderate    (one fire, or two smokes, or fire + smoke)
 *   • score ≥ 4  → severe      (two+ fires, or large mixed hazard set)
 *
 * An empty placement is classified as 'minor' rather than null so we never
 * lose track of an actual completed run — the cap mechanic treats "minor"
 * and "unclassified legacy" the same way (max grade C).
 */
export function computeFireSeverity(hazards: PlacedHazard[]): 'minor' | 'moderate' | 'severe' {
  if (hazards.length === 0) return 'minor'
  let score = 0
  for (const h of hazards) {
    score += h.type === 'fire' ? 2 : 1
  }
  if (score <= 1) return 'minor'
  if (score <= 3) return 'moderate'
  return 'severe'
}

export function getHazardStorageKey(buildingId: string, floorIndex: number, disaster: HazardDisaster): string {
  return `sim:planning:hazards:${buildingId}:${floorIndex}:${disaster}`
}

export function isHazardStorageAvailable(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const probe = '__sim_planning_probe__'
    window.localStorage.setItem(probe, '1')
    window.localStorage.removeItem(probe)
    return true
  } catch {
    return false
  }
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
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(payload))
  } catch {
    // Storage unavailable (private mode, quota, disabled) — silently keep
    // working from in-memory state. Callers may surface a warning via
    // `isHazardStorageAvailable`.
  }
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
