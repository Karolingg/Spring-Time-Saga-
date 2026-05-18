import type { FloorConfig } from '../types'
import { withDenseGraph } from '../dense-graph'

const AS_WEST_WING_1F: FloorConfig = {
  viewWidth: 1200,
  viewHeight: 675,
  floorLabel: '1st Floor',
  exits: {
    E1: { x: 370 , y: 515, label: 'E1', desc: '' },
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
    as150: { label: 'AS 150', x: 895, y: 320, corridorEntryNode: '' },
    as151: { label: 'AS 151', x: 1030, y: 320, corridorEntryNode: '' },
    as152: { label: 'AS 152', x: 1030, y: 200, corridorEntryNode: '' },
    as160: { label: 'AS 160', x: 373, y: 280, corridorEntryNode: '' },
    as161: { label: 'AS 161', x: 430, y: 235, corridorEntryNode: '' },
    as162: { label: 'AS 162', x: 245, y: 200, corridorEntryNode: '' },
    as163: { label: 'AS 163', x: 1030, y: 200, corridorEntryNode: '' },
    as164: { label: 'AS 164', x: 295, y: 310, corridorEntryNode: '' },
    as165: { label: 'AS 165', x: 160  , y: 310, corridorEntryNode: '' },
    ugnayan: { label: 'Ugnayan sa Pahinungod Office', x: 895, y: 210, corridorEntryNode: '' },
    scr: { label: 'Student Council Room', x: 765, y: 220, corridorEntryNode: '' },
    tugani: { label: 'Tug-Ani', x: 620, y: 350, corridorEntryNode: '' },
  },
  corridorNodes: [
    { label: '150 Entry', x: 895, y: 320, neighbors: ['150 Exit', '150 Entrance'] },
    { label: '150 Exit', x: 935, y: 280, neighbors: ['150 Entry'] },
    { label: '150 Entrance', x: 853, y: 280, neighbors: ['150 Entry'] },
    { label: '151 Entry', x: 1030, y: 320, neighbors: ['151 Exit', '151 Entrance'] },
    { label: '151 Exit', x: 985, y: 280, neighbors: ['151 Entry'] },
    { label: '151 Entrance', x: 1070, y: 280, neighbors: ['151 Entry'] },
    { label: '152 Entry', x: 1030, y: 200, neighbors: ['152 Exit', '152 Entrance'] },
    { label: '152 Exit', x: 985, y: 235, neighbors: ['152 Entry'] },
    { label: '152 Entrance', x: 1070, y: 235, neighbors: ['152 Entry'] },
    { label: 'Out AS 151 & 152', x: 1030, y: 255, neighbors: ['152 Entrance', '151 Entrance'] },
    { label: 'Out AS 150', x: 910, y: 255, neighbors: ['152 Exit', '151 Exit', 'Out Storage Room'] },
    { label: 'Out Storage Room', x: 810, y: 255, neighbors: ['152 Entrance', '150 Entrance', 'Out Student Council Room'] },
    { label: 'Out Student Council Room', x: 760, y: 255, neighbors: ['Out Storage Room', 'Central Corridor'] },

    { label: '162 Entry', x: 245, y: 200, neighbors: ['162 Exit', '162 Entrance'] },
    { label: '162 Exit', x: 161, y: 235, neighbors: ['162 Entry'] },
    { label: '162 Entrance', x: 315, y: 235, neighbors: ['162 Entry'] },
    { label: '165 Entry', x: 160, y: 310, neighbors: ['165 Exit', '165 Entrance'] },
    { label: '165 Entrance', x: 205, y: 280, neighbors: ['165 Entry'] },
    { label: '165 Exit', x: 120, y: 280, neighbors: ['165 Entry'] },
    { label: '164 Entry', x: 295, y: 310, neighbors: ['164 Exit', '164 Entrance'] },
    { label: '164 Entrance', x: 337, y: 280, neighbors: ['164 Entry'] },
    { label: '164 Exit', x: 252, y: 280, neighbors: ['164 Entry'] },
    { label: 'Out AS 162 & 164', x: 161, y: 255, neighbors: ['Out AS 162 & 165', '162 Exit', '165 Exit'] },
    { label: 'Out AS 162 & 165', x: 252, y: 255, neighbors: ['Out AS 160', 'Out AS 162 & 164', '165 Entrance', '164 Exit'] },
    { label: 'Out AS 160', x: 373, y: 255, neighbors: ['Out AS 162 & 165', '162 Entrance', '164 Entrance'] },
    { label: 'Out AS 161', x: 430, y: 255, neighbors: ['Out AS 160', 'Central Corridor'] },
    { label: 'Out Tug-Ani', x: 530, y: 350, neighbors: ['Central Corridor', 'Near Exit 1'] },

    { label: 'Central Corridor', x: 530, y: 255, neighbors: ['Out Tug-Ani', 'Out AS 161', 'Out Student Council Room'] },
    { label: 'Out AS West Wing', x: 530, y: 440, neighbors: ['Out Tug-Ani', 'Near Exit 1'] },
    { label: 'Near Exit 1', x: 530, y: 515, neighbors: ['Out AS West Wing'] },
  ],
}

const AS_WEST_WING_2F: FloorConfig = {
  viewWidth: 1200,
  viewHeight: 675,
  floorLabel: '2nd Floor',
  exits: {
    E1: { x: 523, y: 205, label: 'E1', desc: '' },
    E2: { x: 68, y: 300, label: 'E2', desc: '' },
    E3: { x: 68, y: 375, label: 'E3', desc: '' },
    E4: { x: 1132, y: 300, label: 'E4', desc: '' },
    E5: { x: 1132, y: 375, label: 'E5', desc: '' },
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
    as245: { label: 'AS 245', x: 470, y: 300, corridorEntryNode: '' },
    as246: { label: 'AS 246', x: 633, y: 300, corridorEntryNode: '' },
    as247: { label: 'AS 247', x: 220, y: 250, corridorEntryNode: '' },
    as248: { label: 'AS 248', x: 220, y: 250, corridorEntryNode: '' },
    as249: { label: 'AS 249', x: 220, y: 250, corridorEntryNode: '' },
    as250: { label: 'AS 250', x: 220, y: 250, corridorEntryNode: '' },
    as259: { label: 'AS 259', x: 155, y: 390, corridorEntryNode: '' },
    as260: { label: 'AS 260', x: 220, y: 250, corridorEntryNode: '' },
    as261: { label: 'AS 261', x: 220, y: 250, corridorEntryNode: '' },
    gdo: { label: 'Gender & Development Office', x: 220, y: 250, corridorEntryNode: '' },
    oar: { label: 'Office of Alumni Relations', x: 427, y: 310, corridorEntryNode: '' },
    clco: { label: 'Cebuano Language & Culture Office', x: 225, y: 280, corridorEntryNode: '' },
    nstp: { label: 'NSTP Office', x: 290, y: 380, corridorEntryNode: '' },
    
  },
  corridorNodes: [
    { label: 'Left Corridor', x: 364, y: 369, neighbors: ['Near Room 204', 'Near Exit 2'] },
    { label: 'Out OAR', x: 427, y: 335, neighbors: ['Office of Alumni Relations'] },
    { label: 'CLCO Entry', x: 225, y: 280, neighbors: ['CLCO Exit', 'CLCO Entrance'] },
    { label: 'CLCO Exit', x: 155, y: 310, neighbors: ['CLCO Entry', 'Out 259'] },
    { label: 'CLCO Entrance', x: 293, y: 310, neighbors: ['CLCO Entry', 'Out NSTP Office'] },
    { label: '259 Entry', x: 155, y: 390, neighbors: ['259 Exit', '259 Entrance'] },
    { label: '259 Exit', x: 112, y: 355, neighbors: ['259 Entry', 'Out 259', 'Near E2 & E3'] },
    { label: '259 Entrance', x: 200, y: 355, neighbors: ['259 Entry'] },
    { label: 'Out 259', x: 155, y: 335, neighbors: ['259 Entry', 'Out NSTP Office', 'Near E2 & E3'] },
    { label: 'Out NSTP Office', x: 295, y: 335, neighbors: ['Out 259'] },
    { label: 'Near E2 & E3', x: 68, y: 335, neighbors: ['Out 259', '259 Exit', 'E2', 'E3'] },

    { label: 'Near Exit 1', x: 410, y: 120, neighbors: ['Upper Corridor', 'E1'] },
    { label: 'Near Exit 2', x: 410, y: 470, neighbors: ['Left Corridor', 'E2'] },
    { label: 'Near Exit 3', x: 580, y: 470, neighbors: ['East Corridor', 'E3'] },
  ],
}

const AS_WEST_WING_3F: FloorConfig = {
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

export const AS_WEST_WING_FLOORS: FloorConfig[] = [
  AS_WEST_WING_1F,
  AS_WEST_WING_2F,
  AS_WEST_WING_3F,

].map(withDenseGraph)
