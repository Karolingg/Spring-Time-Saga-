import type { FloorConfig } from '../types'
import { withDenseGraph } from '../dense-graph'

const SOCIAL_SCIENCES_1F: FloorConfig = {
  viewWidth: 1200,
  viewHeight: 675,
  floorLabel: '1st Floor',
  exits: {
    E1: { x: 180, y: 245, label: 'E1', desc: '' },
    E2: { x: 660, y: 335, label: 'E2', desc: '' },
    E3: { x: 383, y: 490, label: 'E3', desc: '' },
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
    tlrc: { label: 'TLRC', x: 245, y: 200, corridorEntryNodes: [''] },
    ug114: { label: 'UG 114', x: 337, y: 200, corridorEntryNodes: [''] },
    asx103: { label: 'ASX 103', x: 560, y: 375, corridorEntryNodes: [''] },
    asx104: { label: 'ASX 104', x: 820, y: 375, corridorEntryNodes: [''] },
  },
  corridorNodes: [
    { label: 'TLRC Exit', x: 214, y: 223, neighbors: ['Corridor 1'] },
    { label: 'TLRC Entrance', x: 280, y: 223, neighbors: ['Corridor 2'] },
    { label: 'TLRC Entry', x: 245, y: 200, neighbors: ['TLRC Exit', 'TLRC Entrance'] },
    { label: 'UG 114 Exit', x: 302, y: 223, neighbors: ['Corridor 3'] },
    { label: 'UG 114 Entrance', x: 373, y: 223, neighbors: ['Corridor 4'] },
    { label: 'UG 114 Entry', x: 337, y: 200, neighbors: ['ASX 102 Exit', 'ASX 102 Entrance'] },
    { label: 'ASX 103 Exit', x: 463, y: 360, neighbors: ['Corridor 1'] },
    { label: 'ASX 103 Entrance', x: 655, y: 360, neighbors: ['Corridor 2'] },
    { label: 'ASX 103 Entry', x: 560, y: 375, neighbors: ['ASX 103 Exit', 'ASX 103 Entrance'] },
    { label: 'ASX 104 Exit', x: 725, y: 360, neighbors: ['Corridor 3'] },
    { label: 'ASX 104 Entrance', x: 915, y: 360, neighbors: ['Corridor 4'] },
    { label: 'ASX 104 Entry', x: 820, y: 375, neighbors: ['ASX 104 Exit', 'ASX 104 Entrance'] },
    { label: 'Near Exit', x: 383, y: 315, neighbors: ['E1', 'Corridor 1'] },
    { label: 'Corridor 1', x: 463, y: 315, neighbors: ['Near Exit', 'Corridor 2'] },
    { label: 'Corridor 2', x: 655, y: 315, neighbors: ['Corridor 1', 'Corridor 3'] },
    { label: 'Corridor 3', x: 725, y: 315, neighbors: ['Corridor 2', 'Corridor 4'] },
    { label: 'Corridor 4', x: 915, y: 315, neighbors: ['Corridor 3'] },
  ],
}

const SOCIAL_SCIENCES_2F: FloorConfig = {
  viewWidth: 1200,
  viewHeight: 675,
  floorLabel: '2nd Floor',
  exits: {
    E1: { x: 600, y: 285, label: 'E1', desc: '' },
    E2: { x: 950, y: 285, label: 'E2', desc: '' },
    E3: { x: 383, y: 490, label: 'E3', desc: '' },
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
    ug214: { label: 'UG 214', x: 250, y: 295, corridorEntryNodes: [''] },
    ug215: { label: 'UG 215', x: 250, y: 210, corridorEntryNodes: [''] },
    ug216: { label: 'UG 216', x: 342, y: 295, corridorEntryNodes: [''] },
    ug217: { label: 'UG 217', x: 340, y: 210, corridorEntryNodes: [''] },
    ug218: { label: 'UG 218', x: 432, y: 295, corridorEntryNodes: [''] },
    ug219: { label: 'UG 219', x: 435, y: 210, corridorEntryNodes: [''] },
    ug220: { label: 'UG 220', x: 520, y: 210, corridorEntryNodes: [''] },
    mmr: { label: 'MMR', x: 915, y: 105, corridorEntryNodes: [''] },
    newsroom: { label: 'News Room', x: 915, y: 170, corridorEntryNodes: [''] },
    mmf: { label: 'MMF', x: 915, y: 205, corridorEntryNodes: [''] },
    joyaoffice: { label: 'JOYA Office', x: 915, y: 255, corridorEntryNodes: [''] },
    cme: { label: 'CME', x: 915, y: 365, corridorEntryNodes: [''] },
    ccad: { label: 'CCAD Office', x: 720, y: 268, corridorEntryNodes: [''] },
    matrix: { label: 'Matrix Library', x: 880, y: 502, corridorEntryNodes: [''] },
    des: { label: 'DesComm Room', x: 925, y: 502, corridorEntryNodes: [''] },
    laser: { label: 'Laser Room', x: 935, y: 532, corridorEntryNodes: [''] },
    print: { label: '3D Printing Room', x: 880, y: 535, corridorEntryNodes: [''] },
    idea: { label: 'Idea Room', x: 880, y: 591, corridorEntryNodes: [''] },
    cnc: { label: 'CNC', x: 940, y: 582, corridorEntryNodes: [''] },
    photo: { label: 'Photography Room', x: 910, y: 615, corridorEntryNodes: [''] },
    
    
  },
  corridorNodes: [
    { label: 'UG 214 Entry', x: 250, y: 295, neighbors: ['UG 214 Entrance', 'UG 214 Exit'] },
    { label: 'UG 214 Entrance', x: 280, y: 273, neighbors: ['Out 216 & 217'] },
    { label: 'UG 214 Exit', x: 218, y: 273, neighbors: ['Out 214 & 215'] },
    { label: 'UG 216 Entry', x: 342, y: 295, neighbors: ['UG 216 Entrance', 'UG 216 Exit'] },
    { label: 'UG 216 Entrance', x: 371, y: 273, neighbors: ['Out 218 & 219'] },
    { label: 'UG 216 Exit', x: 310, y: 273, neighbors: ['Out 216 & 217'] },
    { label: 'UG 218 Entry', x: 432, y: 295, neighbors: ['UG 218 Entrance', 'UG 218 Exit'] },
    { label: 'UG 218 Entrance', x: 463, y: 273, neighbors: ['Out 220'] },
    { label: 'UG 218 Exit', x: 402, y: 273, neighbors: ['Out 218 & 219'] },
    { label: 'UG 215 Entry', x: 250, y: 210, neighbors: ['UG 215 Entrance', 'UG 215 Exit'] },
    { label: 'UG 215 Entrance', x: 285, y: 230, neighbors: ['Out 214 & 215'] },
    { label: 'UG 215 Exit', x: 218, y: 230, neighbors: ['Out 214 & 215'] },
    { label: 'UG 217 Entry', x: 340, y: 210, neighbors: ['UG 217 Entrance', 'UG 217 Exit'] },
    { label: 'UG 217 Entrance', x: 375, y: 230, neighbors: ['Out 218 & 219'] },
    { label: 'UG 217 Exit', x: 305, y: 230, neighbors: ['Out 216 & 217'] },
    { label: 'UG 219 Entry', x: 435, y: 210, neighbors: ['UG 219 Entrance', 'UG 219 Exit'] },
    { label: 'UG 219 Entrance', x: 463, y: 230, neighbors: ['Out 220'] },
    { label: 'UG 219 Exit', x: 397, y: 230, neighbors: ['Out 218 & 219'] },
    { label: 'UG 220 Entry', x: 520, y: 210, neighbors: ['UG 220 Entrance', 'UG 220 Exit'] },
    { label: 'UG 220 Entrance', x: 552, y: 230, neighbors: ['JOYA Gallery'] },
    { label: 'UG 220 Exit', x: 493, y: 230, neighbors: ['Out 220'] },
    { label: 'Out MMR', x: 897, y: 105, neighbors: ['MMR', 'Out News Room'] },
    { label: 'Out News Room', x: 897, y: 170, neighbors: ['Out MMR', 'Out MMF'] },
    { label: 'Out MMF', x: 897, y: 205, neighbors: ['Out News Room', 'Out JOYA Office'] },
    { label: 'Out JOYA Office', x: 897, y: 255, neighbors: ['Out MMF', 'Near Exit 2'] },
    { label: 'Near Exit 2', x: 897, y: 285, neighbors: ['Out JOYA Office', 'E2'] },
    { label: 'Out CME', x: 897, y: 365, neighbors: ['CME', 'Near Exit 2'] },
    { label: 'Out CCAD Office', x: 720, y: 285, neighbors: ['CCAD Office', 'Near Exit 2'] },
    { label: 'Near Exit 1', x: 660, y: 285, neighbors: ['Out CCAD Office', 'E1', 'JOYA Gallery'] },
    { label: 'JOYA Gallery', x: 660, y: 250, neighbors: ['CCAD Office', 'Near Exit 1'] },
    { label: 'Out 220', x: 525, y: 250, neighbors: ['Out 220 Exit', 'Out 218 & 219'] },
    { label: 'Out 218 & 219', x: 435, y: 250, neighbors: ['Out 218 Exit', 'Out 218 Exit', 'Out 220'] },
    { label: 'Out 216 & 217', x: 340, y: 250, neighbors: ['Out 218 Exit', 'Out 218 Exit', 'Out 220'] },
    { label: 'Out 214 & 215', x: 250, y: 250, neighbors: ['Out 218 Exit', 'Out 218 Exit', 'Out 220'] },
    { label: 'Out 228', x: 897, y: 420, neighbors: ['Out CME', 'Fablab Corridor'] },
    { label: 'Fablab Corridor', x: 897, y: 520, neighbors: ['Out 228'] },
  ],
}

export const SOCIAL_SCIENCES_FLOORS: FloorConfig[] = [
  SOCIAL_SCIENCES_1F,
  SOCIAL_SCIENCES_2F,
].map(withDenseGraph)
