export type HazardType = 'fire' | 'smoke' | 'debris'

export function hazardGrowthRate(type: HazardType): number {
  switch (type) {
    case 'fire':
      return 5
    case 'smoke':
      return 8
    case 'debris':
      // Progressive structural failure: debris piles slowly creep outward as
      // weakened ceilings/walls continue to fail during the evacuation. Slow
      // enough that the layout at t=0 is still meaningful, fast enough that
      // routes valid early in the run can become blocked later.
      return 0.4
  }
}

export function hazardMaxRadius(type: HazardType, initial: number): number {
  // Debris grows but only to ~1.7x — collapse halts once the unstable section
  // settles. Smoke (3x) and fire (2.5x) keep their dramatic growth caps.
  const multiplier = type === 'smoke' ? 3 : type === 'fire' ? 2.5 : 1.7
  return Math.max(80, initial * multiplier)
}
