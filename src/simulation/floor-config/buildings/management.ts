import type { FloorConfig } from '../types'
import { withDenseGraph } from '../dense-graph'

const MANAGEMENT_1F: FloorConfig = {
  viewWidth: 1200,
  viewHeight: 675,
  floorLabel: '1st Floor',
  exits: {
    E1: { x: 925, y: 350, label: 'E1', desc: '' },
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
    som103: { label: 'Management 103', x: 450, y: 330, corridorEntryNode: ''},
    som104: { label: 'Management 104', x: 705, y: 330, corridorEntryNode: '' },

  },
  corridorNodes: [
    { label: 'Management 104 Entry', x: 450, y: 330, neighbors: ['Management 104 Exit', 'Management 104 Entrance'] },
    { label: 'Management 104 Exit', x: 355, y: 375, neighbors: ['Management 104 Entry', 'Near Toilet'] },
    { label: 'Management 104 Entrance', x: 538, y: 375, neighbors: ['Management 104 Entry', 'Out Management 104'] },
    { label: 'Management 103 Entry', x: 705, y: 330, neighbors: ['Management 103 Exit', 'Management 103 Entrance'] },
    { label: 'Management 103 Exit', x: 613, y: 375, neighbors: ['Out Management 103 Exit', 'Management 103 Entry'] },
    { label: 'Management 103 Entrance', x: 797, y: 375, neighbors: ['Out Management 103 Entrance', 'Management 103 Entry'] },
    { label: 'Near Toilet ', x: 355, y: 430, neighbors: ['Management 104 Exit', 'Out Management 104'] },
    { label: 'Out Management 104', x: 538, y: 430, neighbors: ['Near Toilet', 'Management 104 Entrance'] },
    { label: 'Out Management 103 Exit', x: 613, y: 430, neighbors: ['Out Management 103 Entrance', 'Out Management 104'] },
    { label: 'Out Management 103 Entrance', x: 797, y: 430, neighbors: ['Out Management 103 Exit', 'Near Stairs'] },
    { label: 'Near Stairs', x: 925, y: 430, neighbors: ['Out Management 103 Entrance', 'E1'] },
  ],
}

const MANAGEMENT_2F: FloorConfig = {
  viewWidth: 1200,
  viewHeight: 675,
  floorLabel: '2nd Floor',
  exits: {
    E1: { x: 930, y: 355, label: 'E1', desc: '' },
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
    som203: { label: 'Management 203', x: 705, y: 330, corridorEntryNode: ''},
    som204: { label: 'Management 204', x: 450, y: 330, corridorEntryNode: '' },
  },
  corridorNodes: [
    { label: 'Management 204 Entry', x: 450, y: 330, neighbors: ['Management 204 Exit', 'Management 204 Entrance'] },
    { label: 'Management 204 Exit', x: 355, y: 375, neighbors: ['Management 204 Entry', 'Near Toilet'] },
    { label: 'Management 204 Entrance', x: 538, y: 375, neighbors: ['Management 204 Entry', 'Out Management 204'] },
    { label: 'Management 203 Entry', x: 705, y: 330, neighbors: ['Management 203 Exit', 'Management 203 Entrance'] },
    { label: 'Management 203 Exit', x: 613, y: 375, neighbors: ['Out Management 203 Exit', 'Management 203 Entry'] },
    { label: 'Management 203 Entrance', x: 797, y: 375, neighbors: ['Out Management 203 Entrance', 'Management 203 Entry'] },
    { label: 'Near Toilet ', x: 355, y: 430, neighbors: ['Management 204 Exit', 'Out Management 204'] },
    { label: 'Out Management 204', x: 538, y: 430, neighbors: ['Near Toilet', 'Management 204 Entrance'] },
    { label: 'Out Management 203 Exit', x: 613, y: 430, neighbors: ['Out Management 203 Entrance', 'Out Management 204'] },
    { label: 'Out Management 203 Entrance', x: 797, y: 430, neighbors: ['Out Management 203 Exit', 'Near Stairs'] },
    { label: 'Near Stairs', x: 930, y: 430, neighbors: ['Out Management 203 Entrance', 'E1'] },
  ],
}

export const MANAGEMENT_FLOORS: FloorConfig[] = [
  MANAGEMENT_1F,
  MANAGEMENT_2F,
].map(withDenseGraph)
