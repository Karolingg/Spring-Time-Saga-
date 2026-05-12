/**
 * Stakeholder demo presets for autonomous runs.
 *
 * Source recipes: docs/stakeholder-autonomous-scenarios.md.
 *
 * Each preset is bound to a specific (building, floor, disaster) so the
 * hazard coordinates line up with a known floorplan. The autonomous page
 * filters this list to the active route before showing the preset chips.
 *
 * Coordinates are in the floor's SVG viewbox space (1200 x 675), matching
 * the radii used by the hazard drag/drop tools in the autonomous page.
 */

import type { HazardType } from '../hazard-physics'
import { getDefaultHazardRadius } from '../hazard-placement'

export type OccupancyPreset = 'Low' | 'Medium' | 'High' | 'Full'
export type DisasterType = 'fire' | 'earthquake'
/** Visual emphasis for the preset chip — lets stakeholders see at a glance
 *  whether a preset is a calm baseline or a deliberate stress test. */
export type PresetSeverity = 'baseline' | 'stress' | 'critical' | 'fail'

export interface PresetHazard {
  type: HazardType
  x: number
  y: number
  radius?: number
}

export interface DemoPreset {
  id: string
  label: string
  description: string
  /** One-line description of what stakeholders should watch for. Shown on the
   *  results card after the preset is run. */
  expectedOutcome: string
  disaster: DisasterType
  occupancyPreset: OccupancyPreset
  buildingId: string
  floorIndex: number
  severity: PresetSeverity
  hazards: PresetHazard[]
}

/**
 * Resolve missing radius defaults at the call site so individual preset
 * entries can stay terse — just type + coordinates.
 */
export function resolvePresetHazardRadius(hazard: PresetHazard): number {
  return hazard.radius ?? getDefaultHazardRadius(hazard.type)
}

/* ---------------------------------------------------------------------------
 * Science Building — 1st Floor (floorIndex 0)
 *
 * Exit coordinates: E1=410,52 (north) · E2=370,490 (SW) · E3=610,490 (SE)
 * Center corridor hub: 490,350
 * ------------------------------------------------------------------------ */

const SCIENCE_F0_FIRE: DemoPreset[] = [
  {
    id: 'science-1f-fire-single-exit',
    label: 'Single Exit Compromise',
    description: 'Fire blocks the north exit approach; smoke seeps into the corridor.',
    expectedOutcome: 'Occupants redirect to E2/E3. Watch for uneven exit usage.',
    disaster: 'fire',
    occupancyPreset: 'Medium',
    buildingId: 'science-building',
    floorIndex: 0,
    severity: 'stress',
    hazards: [
      { type: 'fire', x: 410, y: 110 },
      { type: 'smoke', x: 470, y: 280 },
    ],
  },
  {
    id: 'science-1f-fire-smoke-corridor',
    label: 'Smoke-Filled Corridor',
    description: 'Three smoke pockets along the central corridor with all exits still reachable.',
    expectedOutcome: 'Slower evacuation and elevated exposure, but no trapped agents.',
    disaster: 'fire',
    occupancyPreset: 'High',
    buildingId: 'science-building',
    floorIndex: 0,
    severity: 'stress',
    hazards: [
      { type: 'smoke', x: 420, y: 260 },
      { type: 'smoke', x: 490, y: 350 },
      { type: 'smoke', x: 490, y: 430 },
    ],
  },
  {
    id: 'science-1f-fire-room-cluster',
    label: 'Fire Near Room Cluster',
    description: 'Fire between the east room cluster and its nearest exit; smoke covers the detour.',
    expectedOutcome: 'East rooms reroute toward E3 or E1. Bottleneck at SE landing.',
    disaster: 'fire',
    occupancyPreset: 'High',
    buildingId: 'science-building',
    floorIndex: 0,
    severity: 'critical',
    hazards: [
      { type: 'fire', x: 613, y: 320 },
      { type: 'smoke', x: 550, y: 440 },
    ],
  },
  {
    id: 'science-1f-fire-fail',
    label: 'Fire Fail Scenario',
    description: 'Fire on every exit approach — egress-unreachable stress test.',
    expectedOutcome: 'Nonzero trapped count. Highlights single-route corridors.',
    disaster: 'fire',
    occupancyPreset: 'Medium',
    buildingId: 'science-building',
    floorIndex: 0,
    severity: 'fail',
    hazards: [
      { type: 'fire', x: 410, y: 110 },
      { type: 'fire', x: 410, y: 470 },
      { type: 'fire', x: 580, y: 470 },
    ],
  },
]

const SCIENCE_F0_EARTHQUAKE: DemoPreset[] = [
  {
    id: 'science-1f-quake-blocked-stair',
    label: 'Blocked Stairwell',
    description: 'Debris falls on the SW stair approach; dust drifts through the corridor.',
    expectedOutcome: 'Agents avoid E2 and redistribute to E1/E3.',
    disaster: 'earthquake',
    occupancyPreset: 'Medium',
    buildingId: 'science-building',
    floorIndex: 0,
    severity: 'stress',
    hazards: [
      { type: 'debris', x: 370, y: 480 },
      { type: 'smoke', x: 480, y: 360 },
    ],
  },
  {
    id: 'science-1f-quake-central-collapse',
    label: 'Central Corridor Collapse',
    description: 'Debris severs the central corridor, isolating the east wing from the north exit.',
    expectedOutcome: 'East side commits to E3. West side uses E1/E2. Watch each half evacuate independently.',
    disaster: 'earthquake',
    occupancyPreset: 'High',
    buildingId: 'science-building',
    floorIndex: 0,
    severity: 'critical',
    hazards: [
      { type: 'debris', x: 490, y: 350 },
      { type: 'smoke', x: 490, y: 270 },
    ],
  },
  {
    id: 'science-1f-quake-aftershock',
    label: 'Aftershock Cascade',
    description: 'Primary stair blocked, alternate route also compromised, dust on the detour.',
    expectedOutcome: 'Reroutes spike. Evacuation time should rise meaningfully.',
    disaster: 'earthquake',
    occupancyPreset: 'High',
    buildingId: 'science-building',
    floorIndex: 0,
    severity: 'critical',
    hazards: [
      { type: 'debris', x: 410, y: 180 },
      { type: 'debris', x: 490, y: 440 },
      { type: 'smoke', x: 490, y: 350 },
    ],
  },
  {
    id: 'science-1f-quake-fail',
    label: 'Earthquake Fail Scenario',
    description: 'Debris on every stair/exit connector — every route severed.',
    expectedOutcome: 'Nonzero trapped count. Use to identify rooms with no independent egress.',
    disaster: 'earthquake',
    occupancyPreset: 'Medium',
    buildingId: 'science-building',
    floorIndex: 0,
    severity: 'fail',
    hazards: [
      { type: 'debris', x: 410, y: 130 },
      { type: 'debris', x: 380, y: 470 },
      { type: 'debris', x: 600, y: 470 },
    ],
  },
]

/* ---------------------------------------------------------------------------
 * Science Building — 2nd Floor (floorIndex 1)
 *
 * Exit coordinates: S1=460,55 (N stair) · S2=445,550 (SW) · S3=740,550 (SE) · S4=592,260
 * ------------------------------------------------------------------------ */

const SCIENCE_F1_FIRE: DemoPreset[] = [
  {
    id: 'science-2f-fire-single-exit',
    label: 'Single Exit Compromise',
    description: 'Fire blocks the north stairwell; smoke spreads through the upper corridor.',
    expectedOutcome: 'Occupants redirect to S2/S3.',
    disaster: 'fire',
    occupancyPreset: 'Medium',
    buildingId: 'science-building',
    floorIndex: 1,
    severity: 'stress',
    hazards: [
      { type: 'fire', x: 480, y: 130 },
      { type: 'smoke', x: 560, y: 200 },
    ],
  },
  {
    id: 'science-2f-fire-fail',
    label: 'Fire Fail Scenario',
    description: 'Fire on every stair landing — all exits compromised.',
    expectedOutcome: 'Trapped count rises. Indicates structural single-point dependence on the central corridor.',
    disaster: 'fire',
    occupancyPreset: 'High',
    buildingId: 'science-building',
    floorIndex: 1,
    severity: 'fail',
    hazards: [
      { type: 'fire', x: 480, y: 130 },
      { type: 'fire', x: 445, y: 470 },
      { type: 'fire', x: 740, y: 470 },
    ],
  },
]

const SCIENCE_F1_EARTHQUAKE: DemoPreset[] = [
  {
    id: 'science-2f-quake-blocked-stair',
    label: 'Blocked Stairwell',
    description: 'Debris caps the north stair; dust drifts through the central corridor.',
    expectedOutcome: 'S1 is abandoned; S2 and S3 absorb the load.',
    disaster: 'earthquake',
    occupancyPreset: 'Medium',
    buildingId: 'science-building',
    floorIndex: 1,
    severity: 'stress',
    hazards: [
      { type: 'debris', x: 480, y: 130 },
      { type: 'smoke', x: 480, y: 330 },
    ],
  },
  {
    id: 'science-2f-quake-aftershock',
    label: 'Aftershock Cascade',
    description: 'Two debris drops — primary north stair and SE secondary route both blocked.',
    expectedOutcome: 'Reroute count spikes. SW stair (S2) becomes the dominant exit.',
    disaster: 'earthquake',
    occupancyPreset: 'High',
    buildingId: 'science-building',
    floorIndex: 1,
    severity: 'critical',
    hazards: [
      { type: 'debris', x: 480, y: 200 },
      { type: 'debris', x: 740, y: 470 },
      { type: 'smoke', x: 480, y: 380 },
    ],
  },
]

/* ---------------------------------------------------------------------------
 * Registry
 * ------------------------------------------------------------------------ */

const ALL_PRESETS: DemoPreset[] = [
  ...SCIENCE_F0_FIRE,
  ...SCIENCE_F0_EARTHQUAKE,
  ...SCIENCE_F1_FIRE,
  ...SCIENCE_F1_EARTHQUAKE,
]

export function getPresetsFor(buildingId: string, floorIndex: number, disaster: DisasterType): DemoPreset[] {
  return ALL_PRESETS.filter(
    (preset) =>
      preset.buildingId === buildingId &&
      preset.floorIndex === floorIndex &&
      preset.disaster === disaster,
  )
}

export function getOccupancyRatio(preset: OccupancyPreset): number {
  switch (preset) {
    case 'Low':
      return 0.35
    case 'Medium':
      return 0.6
    case 'High':
      return 0.8
    case 'Full':
      return 1
  }
}

export function getSeverityAccent(severity: PresetSeverity): string {
  switch (severity) {
    case 'baseline':
      return '#22c55e'
    case 'stress':
      return '#f59e0b'
    case 'critical':
      return '#f97316'
    case 'fail':
      return '#ef4444'
  }
}
