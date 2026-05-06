import type { FloorConfig } from '../types'

const UP_CEBU_LIBRARY_1F: FloorConfig = {
  viewWidth: 1200,
  viewHeight: 675,
  floorLabel: '1st Floor',
  exits: {
    E1: { x: 465, y: 555, label: 'E1', desc: '' },
    E2: { x: 735, y: 555, label: 'E2', desc: '' },
  },
  startPos: { x: 0, y: 0 },
  primaryPaths: {
    E1: [{ x: 490, y: 350 }, { x: 490, y: 295 }, { x: 420, y: 270 }, { x: 410, y: 210 }, { x: 410, y: 120 }, { x: 410, y: 52 }],
    E2: [{ x: 490, y: 350 }, { x: 490, y: 410 }, { x: 490, y: 455 }, { x: 430, y: 470 }, { x: 370, y: 490 }],
  },
  reroutes: {
    E1: { to: 'E2', path: [{ x: 410, y: 120 }, { x: 410, y: 210 }, { x: 420, y: 270 }, { x: 490, y: 295 }, { x: 490, y: 350 }, { x: 490, y: 410 }, { x: 490, y: 455 }, { x: 430, y: 470 }, { x: 370, y: 490 }] },
    E2: { to: 'E1', path: [{ x: 430, y: 470 }, { x: 490, y: 455 }, { x: 550, y: 470 }, { x: 610, y: 490 }] },
  },
  blockT: { E1: 0.5, E2: 0.5 },
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
  efficiency: { E1: 0.92, E2: 0.88 },
  rooms: {
    corridor: { label: 'Corridor', x: 490, y: 350 },
    lib_ent: { label: 'Library (Entrance)', x: 792, y: 365, corridorEntryNode: 'Right Corridor' },
    lib_exit: { label: 'Library (Exit)', x: 400, y: 365, corridorEntryNode: 'Left Corridor' },
  },
  corridorNodes: [
    { label: 'Right Corridor', x: 735, y: 460, neighbors: ['Library (Entrance)', 'E2'] },
    { label: 'Central Corridor', x: 600, y: 460, neighbors: ['Left Corridor', 'Right Corridor '] },
    { label: 'Left Corridor', x: 465, y: 460, neighbors: ['Library (Exit)', 'E1'] },
  ],
}

const UP_CEBU_LIBRARY_2F: FloorConfig = {
  viewWidth: 1200,
  viewHeight: 675,
  floorLabel: '2nd Floor',
  exits: {
    E1: { x: 300, y: 450, label: 'E1', desc: '' },
    E2: { x: 880, y: 450, label: 'E2', desc: '' },
  },
  startPos: { x: 0, y: 0 },
  primaryPaths: {
    E1: [{ x: 490, y: 350 }, { x: 490, y: 295 }, { x: 420, y: 270 }, { x: 410, y: 210 }, { x: 410, y: 120 }, { x: 410, y: 52 }],
    E2: [{ x: 490, y: 350 }, { x: 490, y: 410 }, { x: 490, y: 455 }, { x: 430, y: 470 }, { x: 370, y: 490 }], 
  },
  reroutes: {
    E1: { to: 'E2', path: [{ x: 410, y: 120 }, { x: 410, y: 210 }, { x: 420, y: 270 }, { x: 490, y: 295 }, { x: 490, y: 350 }, { x: 490, y: 410 }, { x: 490, y: 455 }, { x: 430, y: 470 }, { x: 370, y: 490 }] },
    E2: { to: 'E1', path: [{ x: 430, y: 470 }, { x: 490, y: 455 }, { x: 550, y: 470 }, { x: 610, y: 490 }] },
  },
  blockT: { E1: 0.5, E2: 0.5 },
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
  efficiency: { E1: 0.92, E2: 0.88 },
  rooms: {
    corridor: { label: 'Corridor', x: 490, y: 350 },
    avr: { label: 'AVR', x: 758, y: 355, corridorEntryNode: 'Near Stairs Exit 2' },
    pah_ent: { label: 'PAH (Entrance)', x: 400, y: 355, corridorEntryNode: 'Near Stairs Exit 1' },
    pah_exit: { label: 'PAH (Exit)', x: 590, y: 355, corridorEntryNode: 'Central Corridor' },
  },
  corridorNodes: [
    { label: 'Near Stairs Exit 1', x: 400, y: 450, neighbors: ['S1', 'PAH (Entrance)'] },
    { label: 'Near Stairs Exit 2', x: 758, y: 450, neighbors: ['S2', 'AVR'] },
    { label: 'Central Corridor', x: 590, y: 450, neighbors: ['Near Stairs Exit 1', 'Near Stairs Exit 2'] },
  ],
}

export const UP_CEBU_LIBRARY_FLOORS: FloorConfig[] = [
  UP_CEBU_LIBRARY_1F,
  UP_CEBU_LIBRARY_2F,
]
