import type { FloorConfig } from '../types'
import { withDenseGraph } from '../dense-graph'

const ADMIN_1F: FloorConfig = {
  viewWidth: 1200,
  viewHeight: 675,
  floorLabel: '1st Floor',
  exits: {
    E1: { x: 668, y: 220, label: 'E1', desc: '' },
    E2: { x: 635, y: 570, label: 'E2', desc: '' },
    E3: { x: 1065, y: 343, label: 'E3', desc: '' },
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
    oc: { label: 'Office of Chancellor', x: 430, y: 343, corridorEntryNode: '' },
    ovca: { label: 'OVCA', x: 883, y: 305, corridorEntryNode: '' },
    mindscape: { label: 'Mindscape', x: 993, y: 305, corridorEntryNode: '' },
    oac: { label: 'Old Accounting Office', x: 723, y: 385, corridorEntryNode: '' },
    pe: { label: 'PE Office', x: 477, y: 380, corridorEntryNode: '' },
    myths: { label: 'Myths Cafe', x: 993, y: 385, corridorEntryNode: '' },
  },
  corridorNodes: [
    { label: 'Out Chancy', x: 477, y: 343, neighbors: ['Central Corridor'] },
    { label: 'Central Corridor', x: 635, y: 343, neighbors: ['Out Chancy', 'Near Stairs', 'Near Exit 2'] },
    { label: 'Near Exit 2', x: 635, y: 470 , neighbors: ['Central Corridor', 'E2'] },
    { label: 'Near Stairs', x: 668 , y: 300, neighbors: ['Central Corridor', 'Corridor 1', 'Near Exit 2', 'E1'] },
    { label: 'Corridor 1', x: 723, y: 343, neighbors: ['Near Stairs', 'Corridor 2', 'Central Corridor'] },
    { label: 'Corridor 2', x: 855, y: 343, neighbors: ['Corridor 1', 'Corridor 3'] },
    { label: 'Corridor 3', x: 930, y: 343, neighbors: ['Corridor 2', 'E3'] },
    { label: 'Out Mindscape', x: 993, y: 343, neighbors: ['E3'] },

  ],
}

const ADMIN_2F: FloorConfig = {
  viewWidth: 1200,
  viewHeight: 675,
  floorLabel: '2nd Floor',
  exits: {
    E1: { x: 657, y: 175, label: 'E1', desc: '' },

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
    board: { label: 'Board Room', x: 387, y: 310, corridorEntryNode: '' },
    ilc: { label: 'ILC-AVR', x: 865, y: 310, corridorEntryNode: '' },
    osa: { label: 'New TLRC', x: 630, y: 385, corridorEntryNode: '' },
    oica: { label: 'Office for the Initiatives in Culture and Arts', x: 387, y: 385, corridorEntryNode: '' },
    oca: { label: 'Office of the Campus Architect', x: 1020, y: 305, corridorEntryNode: '' },
    old: { label: 'Old Laboratory', x: 995, y: 270, corridorEntryNode: '' },
  },
  corridorNodes: [
    { label: 'Out Board Room', x: 387, y: 350, neighbors: ['Near Stairs', 'Left Corridor'] },
    { label: 'Out OCA', x: 995, y: 350, neighbors: ['Out ILC'] },
    { label: 'Left Corridor', x: 270, y: 350, neighbors: [''] },
    { label: 'Near Stairs', x: 657, y: 350,  neighbors: ['E1', 'Out Board Room', 'Out ILC' ] },
    { label: 'Out ILC', x: 810, y: 350, neighbors: ['Near Stairs' , 'Out ILC'] },
  ],
}

export const ADMIN_BUILDING_FLOORS: FloorConfig[] = [
  ADMIN_1F,
  ADMIN_2F,
].map(withDenseGraph)
