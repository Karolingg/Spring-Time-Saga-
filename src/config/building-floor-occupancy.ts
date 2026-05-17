export const BUILDING_FLOOR_OCCUPANCY: Record<string, number[]> = {
  'admin-building':  [75, 50],
  'asx':             [60, 60],
  'as-west-wing':    [70, 70, 60],
  'as-east-wing':    [75, 75, 70],
  'management':      [60, 60],
  'som-building-1':  [60, 60, 60],
  'cultural-center': [0],
  'social-sciences': [90, 90],
  'science-building':[60, 60, 55, 50, 50, 45],
  'liadlaw-hall':    [70, 70],
  'up-cebu-library': [50, 50],
  'up-high-school':  [175, 175],
}

export function getBuildingTotalCapacity(buildingId: string): number {
  const floors = BUILDING_FLOOR_OCCUPANCY[buildingId]
  if (!floors) return 0
  return floors.reduce((sum, n) => sum + n, 0)
}
