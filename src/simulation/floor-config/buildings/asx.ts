import type { FloorConfig } from '../types'

const ASX_1F: FloorConfig = {
  viewWidth: 1200,
  viewHeight: 675,
  floorLabel: '1st Floor',
  exits: {
    E1: { x: 383, y: 490, label: 'E1', desc: '' },
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
    asx101: { label: 'ASX 101', x: 610, y: 250, corridorEntryNode: ''},
    asx102: { label: 'ASX 102', x: 730, y: 330, corridorEntryNode: 'Near Toilet' },
    asx103: { label: 'ASX 103', x: 730, y: 250, corridorEntryNode: 'Near Room 202' },
    asx104: { label: 'ASX 104', x: 730, y: 400, corridorEntryNode: 'East Corridor' },
  },
  corridorNodes: [
    { label: 'ASX 101 Exit', x: 493, y: 280, neighbors: ['Near Room 204'] },
    { label: 'ASX 101 Entrance', x: 692, y: 280, neighbors: ['Left Corridor', 'Upper Corridor'] },
    { label: 'ASX 101 Exit', x: 493, y: 280, neighbors: ['Near Room 204'] },
    { label: 'Upper Corridor', x: 364, y: 173, neighbors: ['Near Room 204', 'Near Stairs'] },
    { label: 'Near Stairs', x: 485, y: 173, neighbors: ['Upper Corridor', 'Near Toilet'] },
    { label: 'Near Toilet', x: 613, y: 173, neighbors: ['Near Stairs', 'Near Room 202'] },
    { label: 'Near Room 202', x: 613, y: 220, neighbors: ['Near Toilet', 'Near Room 201'] },
    { label: 'Near Room 201', x: 613, y: 310, neighbors: ['Near Room 202', 'East Corridor'] },
    { label: 'East Corridor', x: 613, y: 412, neighbors: ['Near Room 201'] },
  ],
}
export const ASX_FLOORS: FloorConfig[] = [
  ASX_1F,
]
