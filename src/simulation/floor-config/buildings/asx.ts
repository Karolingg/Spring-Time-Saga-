import type { FloorConfig } from '../types'
import { withDenseGraph } from '../dense-graph'

const ASX_1F: FloorConfig = {
  viewWidth: 1200,
  viewHeight: 675,
  floorLabel: '1st Floor',
  exits: {
    E1: { x: 340, y: 520, label: 'E1', desc: '' },
  },
  startPos: { x: 0, y: 0 },
  primaryPaths: {
    E1: [{ x: 490, y: 350 }, { x: 490, y: 295 }, { x: 420, y: 270 }, { x: 410, y: 210 }, { x: 410, y: 120 }, { x: 410, y: 52 }],
  },
  reroutes: {
    E1: { to: 'E2', path: [{ x: 410, y: 120 }, { x: 410, y: 210 }, { x: 420, y: 270 }, { x: 490, y: 295 }, { x: 490, y: 350 }, { x: 490, y: 410 }, { x: 490, y: 455 }, { x: 430, y: 470 }, { x: 370, y: 490 }] },

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
    asx101: { label: 'ASX 101', x: 610, y: 220, corridorEntryNodes: [''] },
    asx102: { label: 'ASX 102', x: 960, y: 220, corridorEntryNodes: [''] },
    asx103: { label: 'ASX 103', x: 575, y: 410, corridorEntryNodes: [''] },
    asx104: { label: 'ASX 104', x: 885, y: 410, corridorEntryNodes: [''] },
  },
  corridorNodes: [
    { label: 'ASX 101 Exit', x: 493, y: 270, neighbors: ['Corridor 1'] },
    { label: 'ASX 101 Entrance', x: 730, y: 270, neighbors: ['Corridor 2'] },
    { label: 'ASX 101 Entry', x: 610, y: 220, neighbors: ['ASX 101 Exit', 'ASX 101 Entrance'] },
    { label: 'ASX 102 Exit', x: 830, y: 270, neighbors: ['Corridor 3'] },
    { label: 'ASX 102 Entrance', x: 1075, y: 270, neighbors: ['Corridor 4'] },
    { label: 'ASX 102 Entry', x: 960, y: 220, neighbors: ['ASX 102 Exit', 'ASX 102 Entrance'] },
    { label: 'ASX 103 Exit', x: 470, y: 355, neighbors: ['Corridor 1'] },
    { label: 'ASX 103 Entrance', x: 690, y: 355, neighbors: ['Corridor 2'] },
    { label: 'ASX 103 Entry', x: 575, y: 410, neighbors: ['ASX 103 Exit', 'ASX 103 Entrance'] },
    { label: 'ASX 104 Exit', x: 772, y: 355, neighbors: ['Corridor 3'] },
    { label: 'ASX 104 Entrance', x: 1002, y: 355, neighbors: ['Corridor 4'] },
    { label: 'ASX 104 Entry', x: 885, y: 410, neighbors: ['ASX 104 Exit', 'ASX 104 Entrance'] },
    { label: 'Near Exit', x: 340, y: 315, neighbors: ['E1', 'Corridor 1'] },
    { label: 'Corridor 1', x: 470, y: 315, neighbors: ['Near Exit', 'Corridor 2'] },
    { label: 'Corridor 2', x: 690, y: 315, neighbors: ['Corridor 1', 'Corridor 3'] },
    { label: 'Corridor 3', x: 770, y: 315, neighbors: ['Corridor 2', 'Corridor 4'] },
    { label: 'Corridor 4', x: 1002, y: 315, neighbors: ['Corridor 3'] },
  ],
}

const ASX_2F: FloorConfig = {
  viewWidth: 1200,
  viewHeight: 675,
  floorLabel: '2nd Floor',
  exits: {
    E1: { x: 340, y: 520, label: 'E1', desc: '' },
  },
  startPos: { x: 0, y: 0 },
  primaryPaths: {
    E1: [{ x: 490, y: 350 }, { x: 490, y: 295 }, { x: 420, y: 270 }, { x: 410, y: 210 }, { x: 410, y: 120 }, { x: 410, y: 52 }],
  },
  reroutes: {
    E1: { to: 'E2', path: [{ x: 410, y: 120 }, { x: 410, y: 210 }, { x: 420, y: 270 }, { x: 490, y: 295 }, { x: 490, y: 350 }, { x: 490, y: 410 }, { x: 490, y: 455 }, { x: 430, y: 470 }, { x: 370, y: 490 }] },

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
    asx205: { label: 'ASX 205', x: 610, y: 220, corridorEntryNodes: [''] },
    asx206: { label: 'ASX 206', x: 960, y: 220, corridorEntryNodes: [''] },
    asx207: { label: 'ASX 207', x: 885, y: 410, corridorEntryNodes: [''] },
    asx208: { label: 'ASX 208', x: 575, y: 410, corridorEntryNodes: [''] },
    faculty: { label: 'Faculty Lounge', x: 225, y: 297, corridorEntryNodes: [''] },
  },
  corridorNodes: [
    { label: 'ASX 205 Exit', x: 493, y: 270, neighbors: ['Corridor 1'] },
    { label: 'ASX 205 Entrance', x: 730, y: 270, neighbors: ['Corridor 2'] },
    { label: 'ASX 205 Entry', x: 610, y: 220, neighbors: ['ASX 205 Exit', 'ASX 205 Entrance'] },
    { label: 'ASX 206 Exit', x: 830, y: 270, neighbors: ['Corridor 3'] },
    { label: 'ASX 206 Entrance', x: 1075, y: 270, neighbors: ['Corridor 4'] },
    { label: 'ASX 206 Entry', x: 960, y: 220, neighbors: ['ASX 206 Exit', 'ASX 206 Entrance'] },
    { label: 'ASX 208 Exit', x: 455, y: 350, neighbors: ['Corridor 1'] },
    { label: 'ASX 208 Entrance', x: 685, y: 350, neighbors: ['Corridor 2'] },
    { label: 'ASX 208 Entry', x: 575, y: 410, neighbors: ['ASX 208 Exit', 'ASX 208 Entrance'] },
    { label: 'ASX 207 Exit', x: 766, y: 350, neighbors: ['Corridor 3'] },
    { label: 'ASX 207 Entrance', x: 996, y: 350, neighbors: ['Corridor 4'] },
    { label: 'ASX 207 Entry', x: 885, y: 410, neighbors: ['ASX 207 Exit', 'ASX 207 Entrance'] },
    { label: 'Near Exit', x: 340, y: 315, neighbors: ['E1', 'Corridor 1'] },
    { label: 'Corridor 1', x: 470, y: 315, neighbors: ['Near Exit', 'Corridor 2'] },
    { label: 'Corridor 2', x: 690, y: 315, neighbors: ['Corridor 1', 'Corridor 3'] },
    { label: 'Corridor 3', x: 770, y: 315, neighbors: ['Corridor 2', 'Corridor 4'] },
    { label: 'Corridor 4', x: 1002, y: 315, neighbors: ['Corridor 3'] },
  ],
}

export const ASX_FLOORS: FloorConfig[] = [
  ASX_1F,
  ASX_2F,
].map(withDenseGraph)
