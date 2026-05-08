import type { FloorConfig } from '../types'

type FloorConfigLoader = () => Promise<FloorConfig[]>

const BUILDING_FLOOR_LOADERS: Record<string, FloorConfigLoader> = {
  'admin-building': () => import('./admin-building').then((m) => m.ADMIN_BUILDING_FLOORS),
  'asx': () => import('./asx').then((m) => m.ASX_FLOORS),
  'as-west-wing': () => import('./as-west-wing').then((m) => m.AS_WEST_WING_FLOORS),
  'as-east-wing': () => import('./as-east-wing').then((m) => m.AS_EAST_WING_FLOORS),
  'som-admin': () => import('./som-admin').then((m) => m.SOM_ADMIN_FLOORS),
  'som-building-1': () => import('./som-building-1').then((m) => m.SOM_BUILDING_1_FLOORS),
  'cultural-center': () => import('./cultural-center').then((m) => m.CULTURAL_CENTER_FLOORS),
  'social-sciences': () => import('./social-sciences').then((m) => m.SOCIAL_SCIENCES_FLOORS),
  'science-building': () => import('./science-building').then((m) => m.SCIENCE_BUILDING_FLOORS),
  'liadlaw-hall': () => import('./liadlaw-hall').then((m) => m.LIADLAW_HALL_FLOORS),
  'up-cebu-library': () => import('./up-cebu-library').then((m) => m.UP_CEBU_LIBRARY_FLOORS),
  'up-high-school': () => import('./up-high-school').then((m) => m.UP_HIGH_SCHOOL_FLOORS),
}

export async function loadBuildingFloorConfigs(buildingId: string): Promise<FloorConfig[] | null> {
  const loader = BUILDING_FLOOR_LOADERS[buildingId]
  if (!loader) return null
  return loader()
}
