import type { FloorConfig } from '../types'
import { ADMIN_BUILDING_FLOORS } from './admin-building'
import { ASX_FLOORS } from './asx'
import { AS_EAST_WING_FLOORS } from './as-east-wing'
import { AS_WEST_WING_FLOORS } from './as-west-wing'
import { CULTURAL_CENTER_FLOORS } from './cultural-center'
import { LIADLAW_HALL_FLOORS } from './liadlaw-hall'
import { SCIENCE_BUILDING_FLOORS } from './science-building'
import { SOCIAL_SCIENCES_FLOORS } from './social-sciences'
import { MANAGEMENT_FLOORS } from './management'
import { SOM_BUILDING_1_FLOORS } from './som-building-1'
import { UP_CEBU_LIBRARY_FLOORS } from './up-cebu-library'
import { UP_HIGH_SCHOOL_FLOORS } from './up-high-school'

export const BUILDING_FLOORS: Record<string, FloorConfig[]> = {
  'admin-building': ADMIN_BUILDING_FLOORS,
  'asx': ASX_FLOORS,
  'as-west-wing': AS_WEST_WING_FLOORS,
  'as-east-wing': AS_EAST_WING_FLOORS,
  'management': MANAGEMENT_FLOORS,
  'som-building-1': SOM_BUILDING_1_FLOORS,
  'cultural-center': CULTURAL_CENTER_FLOORS,
  'social-sciences': SOCIAL_SCIENCES_FLOORS,
  'science-building': SCIENCE_BUILDING_FLOORS,
  'liadlaw-hall': LIADLAW_HALL_FLOORS,
  'up-cebu-library': UP_CEBU_LIBRARY_FLOORS,
  'up-high-school': UP_HIGH_SCHOOL_FLOORS,
}
