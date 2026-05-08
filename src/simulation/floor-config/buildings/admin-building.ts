import type { FloorConfig } from '../types'

const ADMIN_1F: FloorConfig = {
  viewWidth: 1200,
  viewHeight: 675,
  floorLabel: '1st Floor',
  exits: {
    E1: { x: 626.5, y: 200, label: 'E1', desc: '' },
    E2: { x: 590, y: 555, label: 'E2', desc: '' },
    E3: { x: 1000, y: 357, label: 'E3', desc: '' },
  },
  startPos: { x: 0, y: 0 },
  primaryPaths: {
    E1: [{ x: 590, y: 357 }, { x: 626.5, y: 357 }, { x: 626.5, y: 200 }],
    E2: [{ x: 590, y: 357 }, { x: 590, y: 470 }, { x: 590, y: 555 }],
    E3: [{ x: 590, y: 357 }, { x: 626.5, y: 357 }, { x: 723, y: 357 }, { x: 855, y: 357 }, { x: 930, y: 357 }, { x: 1000, y: 357 }],
  },
  reroutes: {
    E2: { to: 'E1', path: [{ x: 590, y: 470 }, { x: 590, y: 357 }, { x: 626.5, y: 357 }, { x: 626.5, y: 200 }] },
    E3: { to: 'E1', path: [{ x: 930, y: 357 }, { x: 855, y: 357 }, { x: 723, y: 357 }, { x: 626.5, y: 357 }, { x: 626.5, y: 200 }] },
    E1: { to: 'E1', path: [] },
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
  efficiency: { E1: 0.95, E2: 0.93, E3: 0.75 },
  rooms: {
    corridor: { label: 'Corridor', x: 490, y: 350 },
    oc: { label: 'Office of Chancellor', x: 403, y: 357, corridorEntryNode: 'Out Chancy' },
    ovca: { label: 'OVCA', x: 855, y: 330, corridorEntryNode: 'Corridor 2' },
    mindscape: { label: 'Mindscape', x: 938, y: 330, corridorEntryNode: 'Corridor 3' },
    oac: { label: 'Old Accounting Office', x: 723, y: 385, corridorEntryNode: 'Corridor 1' },
    pe: { label: 'PE Office', x: 460, y: 385, corridorEntryNode: 'Out Chancy' },
    myths: { label: 'Myths Cafe', x: 930, y: 385, corridorEntryNode: 'Corridor 3' },
  },
  corridorNodes: [
    { label: 'Out Chancy', x: 460, y: 357, neighbors: ['Central Corridor'] },
    { label: 'Central Corridor', x: 590, y: 357, neighbors: ['Out Chancy', 'Near Stairs', 'Near Exit 2'] },
    { label: 'Near Exit 2', x: 590, y: 470 , neighbors: ['Central Corridor', 'E2'] },
    { label: 'Near Stairs', x: 626.5, y: 357, neighbors: ['Central Corridor', 'Corridor 1', 'Near Exit 2', 'E1'] },
    { label: 'Corridor 1', x: 723, y: 357, neighbors: ['Near Stairs', 'Corridor 2'] },
    { label: 'Corridor 2', x: 855, y: 357, neighbors: ['Corridor 1', 'Corridor 3'] },
    { label: 'Corridor 3', x: 930, y: 357, neighbors: ['Corridor 2', 'E3'] },
  ],
}

const ADMIN_2F: FloorConfig = {
  viewWidth: 1200,
  viewHeight: 675,
  floorLabel: '2nd Floor',
  exits: {
    E1: { x: 626.5, y: 200, label: 'E1', desc: '' },

  },
  startPos: { x: 0, y: 0 },
  primaryPaths: {
    E1: [{ x: 626.5, y: 355 }, { x: 626.5, y: 200 }],
  },
  reroutes: {
    E1: { to: 'E1', path: [] },
  },
  blockT: { E1: 0.5 },
  obstacles: {
    fire: [
      { id: 'fire-north', x: 375, y: 40, w: 80, h: 70, type: 'fire', label: 'Fire', blocksExits: ['E1'] },
      { id: 'smoke-corridor', x: 450, y: 300, w: 90, h: 45, type: 'smoke', label: 'Smoke', blocksExits: [] },
    ],
    earthquake: [
      { id: 'debris-sw-exit', x: 340, y: 470, w: 80, h: 40, type: 'debris', label: 'Debris', blocksExits: [] },
      { id: 'debris-corridor', x: 450, y: 280, w: 90, h: 30, type: 'debris', label: 'Structural Damage', blocksExits: [] },
    ],
  },
  efficiency: { E1: 0.95 },
  rooms: {
    corridor: { label: 'Corridor', x: 490, y: 350 },
    board: { label: 'Board Room', x: 471, y: 330, corridorEntryNode: 'Out Board Room' },
    ilc: { label: 'ILC-AVR', x: 819, y: 330, corridorEntryNode: 'Near Toilet' },
    osa: { label: 'Office of Student Affairs', x: 637, y: 385, corridorEntryNode: 'Near Stairs' },
    oica: { label: 'Office for the Initiatives in Culture and Arts', x: 405, y: 385, corridorEntryNode: 'East Corridor' },
    oca: { label: 'Office of the Campus Architect', x: 975, y: 355, corridorEntryNode: 'Out ILC' },
  },
  corridorNodes: [
    { label: 'Out Board Room', x: 471, y: 355, neighbors: ['Near Stairs', 'Left Corridor'] },
    { label: 'Out ILC', x: 819, y: 355, neighbors: ['Near Stairs'] },
    { label: 'Left Corridor', x: 312, y: 355, neighbors: ['Out OICA'] },
    { label: 'Near Stairs', x: 626.5, y: 355,  neighbors: ['E1', 'Out Board Room', 'Out ILC' ] },
    { label: 'Out OICA', x: 405, y: 355, neighbors: ['Left Corridor' , 'Out Board Room'] },
  ],
}

export const ADMIN_BUILDING_FLOORS: FloorConfig[] = [
  ADMIN_1F,
  ADMIN_2F,
]
