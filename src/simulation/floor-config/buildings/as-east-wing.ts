import type { FloorConfig } from '../types'
import { withDenseGraph } from '../dense-graph'

const AS_EAST_WING_1F: FloorConfig = {
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
    { label: 'Left Corridor', x: 364, y: 369, neighbors: ['Near Room 204', 'Near Exit 2'] },
    { label: 'Near Room 204', x: 364, y: 255, neighbors: ['Left Corridor', 'Upper Corridor'] },
    { label: 'Upper Corridor', x: 364, y: 173, neighbors: ['Near Room 204', 'Near Stairs', 'Near Exit 1'] },
    { label: 'Near Stairs', x: 485, y: 173, neighbors: ['Upper Corridor', 'Near Toilet'] },
    { label: 'Near Toilet', x: 613, y: 173, neighbors: ['Near Stairs', 'Near Room 202'] },
    { label: 'Near Room 202', x: 613, y: 220, neighbors: ['Near Toilet', 'Near Room 201'] },
    { label: 'Near Room 201', x: 613, y: 310, neighbors: ['Near Room 202', 'East Corridor'] },
    { label: 'East Corridor', x: 613, y: 412, neighbors: ['Near Room 201', 'Near Exit 3'] },
    // Exit-adjacent waypoints. Without these, the labeled corridor graph
    // never reaches an exit and every agent gets trapped at run start.
    { label: 'Near Exit 1', x: 410, y: 120, neighbors: ['Upper Corridor', 'E1'] },
    { label: 'Near Exit 2', x: 410, y: 470, neighbors: ['Left Corridor', 'E2'] },
    { label: 'Near Exit 3', x: 580, y: 470, neighbors: ['East Corridor', 'E3'] },
  ],
}

const AS_EAST_WING_2F: FloorConfig = {
  viewWidth: 1200,
  viewHeight: 675,
  floorLabel: '2nd Floor',
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
    { label: 'Left Corridor', x: 364, y: 369, neighbors: ['Near Room 204', 'Near Exit 2'] },
    { label: 'Near Room 204', x: 364, y: 255, neighbors: ['Left Corridor', 'Upper Corridor'] },
    { label: 'Upper Corridor', x: 364, y: 173, neighbors: ['Near Room 204', 'Near Stairs', 'Near Exit 1'] },
    { label: 'Near Stairs', x: 485, y: 173, neighbors: ['Upper Corridor', 'Near Toilet'] },
    { label: 'Near Toilet', x: 613, y: 173, neighbors: ['Near Stairs', 'Near Room 202'] },
    { label: 'Near Room 202', x: 613, y: 220, neighbors: ['Near Toilet', 'Near Room 201'] },
    { label: 'Near Room 201', x: 613, y: 310, neighbors: ['Near Room 202', 'East Corridor'] },
    { label: 'East Corridor', x: 613, y: 412, neighbors: ['Near Room 201', 'Near Exit 3'] },
    // Exit-adjacent waypoints. Without these, the labeled corridor graph
    // never reaches an exit and every agent gets trapped at run start.
    { label: 'Near Exit 1', x: 410, y: 120, neighbors: ['Upper Corridor', 'E1'] },
    { label: 'Near Exit 2', x: 410, y: 470, neighbors: ['Left Corridor', 'E2'] },
    { label: 'Near Exit 3', x: 580, y: 470, neighbors: ['East Corridor', 'E3'] },
  ],
}

const AS_EAST_WING_3F: FloorConfig = {
  viewWidth: 1200,
  viewHeight: 675,
  floorLabel: '3rd Floor',
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
    { label: 'Left Corridor', x: 364, y: 369, neighbors: ['Near Room 204', 'Near Exit 2'] },
    { label: 'Near Room 204', x: 364, y: 255, neighbors: ['Left Corridor', 'Upper Corridor'] },
    { label: 'Upper Corridor', x: 364, y: 173, neighbors: ['Near Room 204', 'Near Stairs', 'Near Exit 1'] },
    { label: 'Near Stairs', x: 485, y: 173, neighbors: ['Upper Corridor', 'Near Toilet'] },
    { label: 'Near Toilet', x: 613, y: 173, neighbors: ['Near Stairs', 'Near Room 202'] },
    { label: 'Near Room 202', x: 613, y: 220, neighbors: ['Near Toilet', 'Near Room 201'] },
    { label: 'Near Room 201', x: 613, y: 310, neighbors: ['Near Room 202', 'East Corridor'] },
    { label: 'East Corridor', x: 613, y: 412, neighbors: ['Near Room 201', 'Near Exit 3'] },
    // Exit-adjacent waypoints. Without these, the labeled corridor graph
    // never reaches an exit and every agent gets trapped at run start.
    { label: 'Near Exit 1', x: 410, y: 120, neighbors: ['Upper Corridor', 'E1'] },
    { label: 'Near Exit 2', x: 410, y: 470, neighbors: ['Left Corridor', 'E2'] },
    { label: 'Near Exit 3', x: 580, y: 470, neighbors: ['East Corridor', 'E3'] },
  ],
}

export const AS_EAST_WING_FLOORS: FloorConfig[] = [
  AS_EAST_WING_1F,
  AS_EAST_WING_2F,
  AS_EAST_WING_3F,
  
].map(withDenseGraph)
