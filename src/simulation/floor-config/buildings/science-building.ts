import type { FloorConfig } from '../types'
import { makePlaceholderFloor } from '../placeholder'

const SCIENCE_1F: FloorConfig = {
  viewWidth: 1200,
  viewHeight: 675,
  floorLabel: '1st Floor',
  exits: {
    E1: { x: 410, y: 52, label: 'E1', desc: 'North Exit \u00B7 Main' },
    E2: { x: 370, y: 490, label: 'E2', desc: 'SW Exit \u00B7 Left' },
    E3: { x: 610, y: 490, label: 'E3', desc: 'SE Exit \u00B7 Right' },
  },
  startPos: { x: 0, y: 0 },
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
      { id: 'debris-sw-exit', x: 340, y: 470, w: 80, h: 40, type: 'debris', label: 'Debris', blocksExits: ['E2'] },
      { id: 'debris-corridor', x: 450, y: 280, w: 90, h: 30, type: 'debris', label: 'Structural Damage', blocksExits: [] },
    ],
  },
  efficiency: { E1: 0.92, E2: 0.88, E3: 0.85 },
  rooms: {
    corridor: { label: 'Corridor', x: 490, y: 350 },
    r204: { label: 'Room 204', x: 220, y: 250, corridorEntryNode: 'Left Corridor' },
    r203: { label: 'Room 203', x: 730, y: 330, corridorEntryNode: 'Near Toilet' },
    r202: { label: 'Room 202', x: 730, y: 250, corridorEntryNode: 'Near Room 202' },
    r201: { label: 'Room 201', x: 730, y: 400, corridorEntryNode: 'East Corridor' },
  },
  corridorNodes: [
    { label: 'Left Corridor', x: 364, y: 369, neighbors: ['Near Room 204'] },
    { label: 'Near Room 204', x: 364, y: 255, neighbors: ['Left Corridor', 'Upper Corridor'] },
    { label: 'Upper Corridor', x: 364, y: 173, neighbors: ['Near Room 204', 'Near Stairs'] },
    { label: 'Near Stairs', x: 485, y: 173, neighbors: ['Upper Corridor', 'Near Toilet'] },
    { label: 'Near Toilet', x: 613, y: 173, neighbors: ['Near Stairs', 'Near Room 202'] },
    { label: 'Near Room 202', x: 613, y: 220, neighbors: ['Near Toilet', 'Near Room 201'] },
    { label: 'Near Room 201', x: 613, y: 310, neighbors: ['Near Room 202', 'East Corridor'] },
    { label: 'East Corridor', x: 613, y: 412, neighbors: ['Near Room 201'] },
  ],
}

const SCIENCE_2F: FloorConfig = {
  viewWidth: 1200,
  viewHeight: 675,
  floorLabel: '2nd Floor',
  exits: {
    S1: { x: 490, y: 266.5, label: 'S1', desc: 'Center Stairs \u00B7 Down' },
    S2: { x: 360, y: 520, label: 'S2', desc: 'SW Stairs \u00B7 Down' },
    S3: { x: 613, y: 520, label: 'S3', desc: 'SE Stairs \u00B7 Down' },
  },
  startPos: { x: 0, y: 0 },
  primaryPaths: {
    S1: [{ x: 482, y: 173 }, { x: 490, y: 220 }, { x: 490, y: 266.5 }],
    S2: [{ x: 365, y: 360 }, { x: 365, y: 420 }, { x: 365, y: 490 }, { x: 365, y: 520 }],
    S3: [{ x: 613, y: 420 }, { x: 613, y: 490 }, { x: 608, y: 520 }],
  },
  reroutes: {
    S1: { to: 'S2', path: [{ x: 482, y: 220 }, { x: 482, y: 300 }, { x: 430, y: 360 }, { x: 365, y: 420 }, { x: 365, y: 490 }, { x: 365, y: 520 }] },
    S2: { to: 'S3', path: [{ x: 365, y: 490 }, { x: 430, y: 490 }, { x: 490, y: 490 }, { x: 550, y: 490 }, { x: 608, y: 520 }] },
    S3: { to: 'S2', path: [{ x: 608, y: 520 }, { x: 550, y: 490 }, { x: 490, y: 490 }, { x: 430, y: 490 }, { x: 365, y: 490 }, { x: 365, y: 520 }] },
  },
  blockT: { S1: 0.55, S2: 0.5, S3: 0.5 },
  obstacles: {
    fire: [
      { id: 'fire-west-wing', x: 165, y: 235, w: 120, h: 95, type: 'fire', label: 'Electrical Fire', blocksExits: ['S2'] },
      { id: 'smoke-corridor-east', x: 555, y: 280, w: 80, h: 50, type: 'smoke', label: 'Smoke', blocksExits: ['S3'] },
      { id: 'smoke-spreading', x: 590, y: 165, w: 60, h: 50, type: 'smoke', label: 'Smoke', blocksExits: [] },
    ],
    earthquake: [
      { id: 'debris-center-stair', x: 440, y: 215, w: 100, h: 45, type: 'debris', label: 'Stairwell Debris', blocksExits: ['S1'] },
      { id: 'debris-corridor', x: 440, y: 330, w: 100, h: 35, type: 'debris', label: 'Debris', blocksExits: [] },
      { id: 'debris-se-stair', x: 580, y: 470, w: 70, h: 40, type: 'debris', label: 'Debris', blocksExits: ['S3'] },
    ],
  },
  efficiency: { S1: 0.92, S2: 0.85, S3: 0.85 },
  rooms: {
    corridor: { label: 'Corridor', x: 490, y: 350 },
    r204: { label: 'Room 204', x: 220, y: 360, corridorEntryNode: 'Left Corridor' },
    r203: { label: 'Room 203', x: 730, y: 173, corridorEntryNode: 'Near Toilet' },
    r202: { label: 'Room 202', x: 720, y: 310, corridorEntryNode: 'Near Room 201' },
    r201: { label: 'Room 201', x: 730, y: 420, corridorEntryNode: 'East Corridor' },
  },
  corridorNodes: [
    { label: 'Left Corridor', x: 360, y: 360, neighbors: ['Near Room 204'] },
    { label: 'Near Room 204', x: 360, y: 255, neighbors: ['Left Corridor', 'Upper Corridor'] },
    { label: 'Upper Corridor', x: 360, y: 173, neighbors: ['Near Room 204', 'Near Stairs'] },
    { label: 'Near Stairs', x: 490, y: 173, neighbors: ['Upper Corridor', 'Near Toilet', 'S1 Exit'] },
    { label: 'S1 Exit', x: 490, y: 266.5, neighbors: ['Near Stairs'] },
    { label: 'Near Toilet', x: 613, y: 173, neighbors: ['Near Stairs', 'Near Room 202'] },
    { label: 'Near Room 202', x: 613, y: 220, neighbors: ['Near Toilet', 'Near Room 201'] },
    { label: 'Near Room 201', x: 613, y: 310, neighbors: ['Near Room 202', 'East Corridor'] },
    { label: 'East Corridor', x: 613, y: 420, neighbors: ['Near Room 201'] },
  ],
}

export const SCIENCE_BUILDING_FLOORS: FloorConfig[] = [
  SCIENCE_1F,
  SCIENCE_2F,
  
  makePlaceholderFloor(2),
]
