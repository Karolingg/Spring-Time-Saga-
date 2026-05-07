export type HazardType = 'fire' | 'smoke' | 'debris'

export function hazardGrowthRate(type: HazardType): number {
  switch (type) {
    case 'fire':
      return 5
    case 'smoke':
      return 8
    case 'debris':
      return 0
  }
}

export function hazardMaxRadius(type: HazardType, initial: number): number {
  const multiplier = type === 'smoke' ? 3 : type === 'fire' ? 2.5 : 1
  return Math.max(80, initial * multiplier)
}
