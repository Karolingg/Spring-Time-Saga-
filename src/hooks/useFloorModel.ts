'use client'

import { useMemo } from 'react'
import { getBuildingById, type BuildingModel, type FloorModel } from '@/src/simulation/building-model'

interface UseFloorModelOptions {
  /**
   * When the run has no floor index, or names one the building doesn't have,
   * fall back to its first floor. Views that render a floor plan want this;
   * views that report per-floor numbers should pass `false` rather than
   * silently attribute data to the wrong floor.
   */
  fallbackToFirstFloor?: boolean
}

/**
 * Resolve a run's building and floor. The fallback rule used to be re-written
 * at each call site, and had already drifted apart between them — keeping it
 * here makes each caller's choice explicit instead of accidental.
 */
export function useFloorModel(
  buildingId: string | null | undefined,
  floorIndex: number | null | undefined,
  { fallbackToFirstFloor = true }: UseFloorModelOptions = {},
): { building: BuildingModel | null; floor: FloorModel | null } {
  const building = useMemo(
    () => (buildingId ? getBuildingById(buildingId) ?? null : null),
    [buildingId],
  )

  const floor = useMemo(() => {
    if (!building) return null
    const first = fallbackToFirstFloor ? building.floors[0] ?? null : null
    if (floorIndex == null) return first
    return building.floors[floorIndex] ?? first
  }, [building, floorIndex, fallbackToFirstFloor])

  return { building, floor }
}
