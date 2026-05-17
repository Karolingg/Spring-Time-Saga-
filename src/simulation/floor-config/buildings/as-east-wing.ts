import type { FloorConfig } from '../types'
import { withDenseGraph } from '../dense-graph'

function createGroundFloorConfig(floorLabel: string): FloorConfig {
  return {
    viewWidth: 1200,
    viewHeight: 675,
    floorLabel,
    exits: {
      E1: { x: 410, y: 52, label: 'E1', desc: 'North Exit - Main' },
      E2: { x: 365, y: 520, label: 'E2', desc: 'Southwest Exit - Left' },
      E3: { x: 605, y: 520, label: 'E3', desc: 'Southeast Exit - Right' },
    },
    startPos: { x: 490, y: 350 },
    primaryPaths: {
      E1: [{ x: 490, y: 350 }, { x: 490, y: 295 }, { x: 420, y: 270 }, { x: 410, y: 210 }, { x: 410, y: 120 }, { x: 410, y: 52 }],
      E2: [{ x: 490, y: 350 }, { x: 490, y: 410 }, { x: 490, y: 455 }, { x: 430, y: 470 }, { x: 370, y: 490 }],
      E3: [{ x: 490, y: 350 }, { x: 490, y: 410 }, { x: 490, y: 455 }, { x: 550, y: 470 }, { x: 610, y: 490 }],
    },
    reroutes: {
      E1: { to: 'E2', path: [{ x: 410, y: 120 }, { x: 410, y: 210 }, { x: 420, y: 270 }, { x: 490, y: 295 }, { x: 490, y: 350 }, { x: 490, y: 410 }, { x: 490, y: 455 }, { x: 430, y: 470 }, { x: 370, y: 490 }] },
      E2: { to: 'E3', path: [{ x: 430, y: 470 }, { x: 490, y: 455 }, { x: 550, y: 470 }, { x: 610, y: 490 }] },
      E3: { to: 'E2', path: [{ x: 550, y: 470 }, { x: 490, y: 455 }, { x: 430, y: 470 }, { x: 370, y: 490 }] },
    },
    blockT: { E1: 0.5, E2: 0.5, E3: 0.55 },
    obstacles: {
      fire: [
        { id: 'fire-north', x: 375, y: 40, w: 80, h: 70, type: 'fire', label: 'Fire', blocksExits: ['E1'] },
        { id: 'smoke-corridor', x: 450, y: 300, w: 90, h: 45, type: 'smoke', label: 'Smoke', blocksExits: [] },
      ],
      earthquake: [
        { id: 'debris-sw', x: 340, y: 470, w: 80, h: 40, type: 'debris', label: 'Debris', blocksExits: ['E2'] },
        { id: 'debris-corridor', x: 450, y: 280, w: 90, h: 30, type: 'debris', label: 'Structural Damage', blocksExits: [] },
      ],
    },
    efficiency: { E1: 0.92, E2: 0.88, E3: 0.85 },
    rooms: {
      corridor: { label: 'Corridor', x: 490, y: 350 },
      r204: { label: 'Room 204', x: 220, y: 250 },
      r203: { label: 'Room 203', x: 730, y: 300 },
      r202: { label: 'Room 202', x: 720, y: 280 },
      r201: { label: 'Room 201', x: 730, y: 400 },
    },
  }
}

function createUpperFloorConfig(floorLabel: string): FloorConfig {
  return {
    viewWidth: 1200,
    viewHeight: 675,
    floorLabel,
    exits: {
      S1: { x: 490, y: 230, label: 'S1', desc: 'Center Stairs - Down' },
      S2: { x: 370, y: 490, label: 'S2', desc: 'Southwest Stairs - Down' },
      S3: { x: 610, y: 490, label: 'S3', desc: 'Southeast Stairs - Down' },
    },
    startPos: { x: 490, y: 350 },
    primaryPaths: {
      S1: [{ x: 490, y: 350 }, { x: 490, y: 295 }, { x: 420, y: 270 }, { x: 420, y: 240 }, { x: 490, y: 230 }],
      S2: [{ x: 490, y: 350 }, { x: 490, y: 410 }, { x: 490, y: 455 }, { x: 430, y: 470 }, { x: 370, y: 490 }],
      S3: [{ x: 490, y: 350 }, { x: 490, y: 410 }, { x: 490, y: 455 }, { x: 550, y: 470 }, { x: 610, y: 490 }],
    },
    reroutes: {
      S1: { to: 'S2', path: [{ x: 420, y: 240 }, { x: 420, y: 270 }, { x: 490, y: 295 }, { x: 490, y: 350 }, { x: 490, y: 410 }, { x: 490, y: 455 }, { x: 430, y: 470 }, { x: 370, y: 490 }] },
      S2: { to: 'S3', path: [{ x: 430, y: 470 }, { x: 490, y: 455 }, { x: 550, y: 470 }, { x: 610, y: 490 }] },
      S3: { to: 'S2', path: [{ x: 550, y: 470 }, { x: 490, y: 455 }, { x: 430, y: 470 }, { x: 370, y: 490 }] },
    },
    blockT: { S1: 0.55, S2: 0.5, S3: 0.5 },
    obstacles: {
      fire: [
        { id: 'fire-west-wing', x: 165, y: 235, w: 120, h: 95, type: 'fire', label: 'Electrical Fire', blocksExits: ['S2'] },
        { id: 'smoke-corridor', x: 555, y: 280, w: 80, h: 50, type: 'smoke', label: 'Smoke', blocksExits: ['S3'] },
      ],
      earthquake: [
        { id: 'debris-center', x: 440, y: 215, w: 100, h: 45, type: 'debris', label: 'Stairwell Debris', blocksExits: ['S1'] },
        { id: 'debris-se', x: 580, y: 470, w: 70, h: 40, type: 'debris', label: 'Debris', blocksExits: ['S3'] },
      ],
    },
    efficiency: { S1: 0.92, S2: 0.85, S3: 0.85 },
    rooms: {
      corridor: { label: 'Corridor', x: 490, y: 350 },
      r204: { label: 'Room 204', x: 220, y: 250 },
      r203: { label: 'Room 203', x: 730, y: 300 },
      r202: { label: 'Room 202', x: 720, y: 280 },
      r201: { label: 'Room 201', x: 730, y: 400 },
    },
  }
}

const AS_EAST_WING_1F: FloorConfig = createGroundFloorConfig('1st Floor')
const AS_EAST_WING_2F: FloorConfig = createUpperFloorConfig('2nd Floor')

export const AS_EAST_WING_FLOORS: FloorConfig[] = [
  AS_EAST_WING_1F,
  AS_EAST_WING_2F,
].map(withDenseGraph)
