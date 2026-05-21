import type { FloorConfig } from '../types'
import { withDenseGraph } from '../dense-graph'

const AS_EAST_WING_1F: FloorConfig = {
  viewWidth: 1200,
  viewHeight: 675,
  floorLabel: '1st Floor',
  exits: {
    E1: { x: 370, y: 160, label: 'E1', desc: '' },
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
      { id: 'debris-sw-exit', x: 160, y: 430, w: 80, h: 40, type: 'debris', label: 'Debris', blocksExits: [] },
      { id: 'debris-east-wall', x: 870, y: 400, w: 90, h: 35, type: 'debris', label: 'Structural Damage', blocksExits: [] },
    ],
  },
  efficiency: { E1: 0.92, E2: 0.88, E3: 0.85 },
  rooms: {
    corridor: { label: 'Corridor', x: 490, y: 350 },
    as133: { label: 'AS 133', x: 160, y: 470, corridorEntryNode: '' },
    as134: { label: 'AS 134', x: 160, y: 375, corridorEntryNode: '' },
    as135: { label: 'AS 135', x: 297, y: 450, corridorEntryNode: '' },
    as136: { label: 'AS 136', x: 297, y: 375, corridorEntryNode: '' },
    as138: { label: 'AS 138', x: 374, y: 395, corridorEntryNode: '' },
    ocs: { label: 'Office of the College Secretary', x: 430, y: 445, corridorEntryNode: ' ' },
    dean: { label: 'Office of the Dean', x: 767, y: 445, corridorEntryNode: ' ' },
    as145: { label: 'AS 145', x: 812, y: 395, corridorEntryNode: '' },
    as146: { label: 'AS 146', x: 1033, y: 470, corridorEntryNode: '' },
    as147: { label: 'AS 147', x: 1033, y: 375, corridorEntryNode: '' },
    as148: { label: 'AS 148', x: 897, y: 445, corridorEntryNode: '' },
    as149: { label: 'AS 149', x: 897, y: 375, corridorEntryNode: '' },
  },
  corridorNodes: [
    { label: 'AS 133 Entry', x: 160, y: 470, neighbors: ['AS 133 Exit', 'AS 133 Entrance'] },
    { label: 'AS 133 Exit', x: 122, y: 445, neighbors: ['AS 133 Entry', 'Out 133 & 134'] },
    { label: 'AS 133 Entrance', x: 203, y: 445, neighbors: ['AS 133 Entry', 'Out 136'] },

    { label: 'AS 134 Entry', x: 160, y: 375, neighbors: ['AS 134 Exit', 'AS 134 Entrance'] },
    { label: 'AS 134 Exit', x: 122, y: 395, neighbors: ['AS 134 Entry', 'Out 133 & 134'] },
    { label: 'AS 134 Entrance', x: 203, y: 395, neighbors: ['AS 134 Entry', 'Out 136'] },

    { label: 'AS 136 Entry', x: 297, y: 375, neighbors: ['AS 136 Exit', 'AS 136 Entrance'] },
    { label: 'AS 136 Exit', x: 255, y: 395, neighbors: ['AS 136 Entry'] },
    { label: 'AS 136 Entrance', x: 340, y: 395, neighbors: ['AS 136 Entry', 'Out 138'] },

    { label: 'AS 146 Entry', x: 1033, y: 470, neighbors: ['AS 146 Exit', 'AS 146 Entrance'] },
    { label: 'AS 146 Exit', x: 990, y: 445, neighbors: ['AS 146 Entry', 'Out 147'] },
    { label: 'AS 146 Entrance', x: 1075, y: 445, neighbors: ['AS 146 Entry'] },

    { label: 'AS 147 Entry', x: 1033, y: 375, neighbors: ['AS 147 Exit', 'AS 147 Entrance'] },
    { label: 'AS 147 Exit', x: 990, y: 395, neighbors: ['AS 147 Entry', 'Out 147'] },
    { label: 'AS 147 Entrance', x: 1075, y: 395, neighbors: ['AS 147 Entry'] },

    { label: 'AS 149 Entry', x: 897, y: 375, neighbors: ['AS 149 Exit', 'AS 149 Entrance'] },
    { label: 'AS 149 Exit', x: 857, y: 395, neighbors: ['AS 149 Entry'] },
    { label: 'AS 149 Entrance', x: 940, y: 395, neighbors: ['AS 149 Entry'] },

    { label: 'Out 145', x: 812, y: 420, neighbors: ['Out Office of the Dean', 'Out 148'] },
    { label: 'Out Office of the Dean', x: 767, y: 420, neighbors: ['Out 145'] },
    { label: 'Central Corridor', x: 530, y: 420, neighbors: ['Out Office of the Dean', 'Near Exit 1', 'Out OCS'] },
    { label: 'Out OCS', x: 430, y: 420, neighbors: ['Central Corridor', 'Out 138'] },
    { label: 'Out 138', x: 374, y: 420, neighbors: ['Out OCS'] },
    { label: 'Out 135', x: 297, y: 420, neighbors: ['Out 138', 'Out 136'] },
    { label: 'Out 133 & 134', x: 160, y: 420, neighbors: ['AS 133 Exit', 'AS 134 Exit', 'Out 136'] },
    { label: 'Out 136', x: 255, y: 420, neighbors: ['Out 133 & 134', 'Out 135'] },
    { label: 'Out 148', x: 897, y: 420, neighbors: ['Out 147', 'Out 145'] },
    { label: 'Out 146 & 147', x: 1033, y: 420, neighbors: ['AS 147 Entrance', 'AS 146 Entrance'] },
    { label: 'Out 147', x: 990, y: 420, neighbors: ['Out 146 & 147', 'Out 148'] },
    { label: 'Near Exit 1', x: 530, y: 160, neighbors: ['Central Corridor', 'E1'] },
  ],
}

const AS_EAST_WING_2F: FloorConfig = {
  viewWidth: 1200,
  viewHeight: 675,
  floorLabel: '2nd Floor',
  exits: {
    E1: { x: 580, y: 460, label: 'E1', desc: '' },
    E2: { x: 71, y: 300, label: 'E2', desc: '' },
    E3: { x: 71, y: 380, label: 'E3', desc: '' },
    E4: { x: 1127, y: 300, label: 'E4', desc: '' },
    E5: { x: 1127, y: 380, label: 'E5', desc: '' },
  },
  startPos: { x: 0, y: 0 },
  primaryPaths: {
    E1: [{ x: 490, y: 350 }, { x: 490, y: 295 }, { x: 420, y: 270 }, { x: 410, y: 210 }, { x: 410, y: 120 }, { x: 410, y: 52 }],
    E2: [{ x: 490, y: 350 }, { x: 490, y: 410 }, { x: 490, y: 455 }, { x: 430, y: 470 }, { x: 370, y: 490 }],
    E3: [{ x: 490, y: 350 }, { x: 490, y: 410 }, { x: 490, y: 455 }, { x: 550, y: 470 }, { x: 610, y: 490 }],
    E4: [{ x: 490, y: 350 }, { x: 490, y: 410 }, { x: 490, y: 455 }, { x: 550, y: 470 }, { x: 610, y: 490 }],
    E5: [{ x: 490, y: 350 }, { x: 490, y: 410 }, { x: 490, y: 455 }, { x: 550, y: 470 }, { x: 610, y: 490 }],
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
    as231: { label: 'AS 231', x: 1030, y: 390, corridorEntryNode: '' },
    as233: { label: 'AS 233', x: 885, y: 390, corridorEntryNode: '' },
    as235: { label: 'AS 235', x: 735, y: 390, corridorEntryNode: '' },
    as237: { label: 'AS 237', x: 630, y: 370, corridorEntryNode: '' },
    as239: { label: 'AS 239', x: 683, y: 315, corridorEntryNode: '' },
    as240: { label: 'AS 240', x: 385, y: 315, corridorEntryNode: '' },
    as241: { label: 'AS 241', x: 395, y: 390, corridorEntryNode: '' },
    as243: { label: 'AS 243', x: 285, y: 390, corridorEntryNode: '' },
    as244: { label: 'AS 244', x: 155, y: 290, corridorEntryNode: '' },
    as245: { label: 'AS 245', x: 155, y: 390, corridorEntryNode: '' },
    itc: { label: 'ITC', x: 290, y: 290, corridorEntryNode: '' },
    math: { label: 'Math Faculty', x: 920, y: 285, corridorEntryNode: '' },
  },
  corridorNodes: [
    { label: 'Math Entry', x: 920, y: 285, neighbors: ['Math Out 1', 'Math Out 2', 'Math Out 3'] },
    { label: 'Math Out 1', x: 786, y: 310, neighbors: ['Out 235'] },
    { label: 'Math Out 2', x: 920, y: 320, neighbors: ['Out Math Faculty'] },
    { label: 'Math Out 3', x: 1030, y: 310, neighbors: ['Out 231'] },

    { label: 'AS 231 Entry', x: 1030, y: 390, neighbors: ['AS 231 Exit', 'AS 231 Entrance'] },
    { label: 'AS 231 Exit', x: 981, y: 360, neighbors: ['AS 231 Entry', 'Out 231', 'Out Math Faculty'] },
    { label: 'AS 231 Entrance', x: 1080, y: 360, neighbors: ['AS 231 Entry', 'Near E4 & E5'] },

    { label: 'AS 233 Entry', x: 885, y: 390, neighbors: ['AS 233 Exit', 'AS 233 Entrance'] },
    { label: 'AS 233 Exit', x: 842, y: 360, neighbors: ['AS 233 Entry', 'Out 233', 'Out 235'] },
    { label: 'AS 233 Entrance', x: 929, y: 360, neighbors: ['AS 233 Entry', 'Out Math Faculty'] },

    { label: 'AS 235 Entry', x: 735, y: 390, neighbors: ['AS 235 Exit', 'AS 235 Entrance'] },
    { label: 'AS 235 Exit', x: 683, y: 360, neighbors: ['AS 235 Entry', 'Out 239'] },
    { label: 'AS 235 Entrance', x: 786, y: 360, neighbors: ['AS 235 Entry', 'Out 235'] },
    
    { label: 'AS 241 Entry', x: 395, y: 390, neighbors: ['AS 241 Exit', 'AS 241 Entrance'] },
    { label: 'AS 241 Exit', x: 369, y: 360, neighbors: ['AS 241 Entry', 'Out 240'] },
    { label: 'AS 241 Entrance', x: 422, y: 350, neighbors: ['AS 241 Entry', 'Central Corridor'] },

    { label: 'AS 243 Entry', x: 285, y: 390, neighbors: ['AS 243 Exit', 'AS 243 Entrance'] },
    { label: 'AS 243 Exit', x: 256, y: 360, neighbors: ['AS 243 Entry', 'Out ITC'] },
    { label: 'AS 243 Entrance', x: 315, y: 360, neighbors: ['AS 243 Entry'] },

    { label: 'AS 244 Entry', x: 155, y: 290, neighbors: ['AS 244 Exit', 'AS 244 Entrance'] },
    { label: 'AS 244 Exit', x: 115, y: 320, neighbors: ['AS 244 Entry', 'Near E2 & E3'] },
    { label: 'AS 244 Entrance', x: 200, y: 320, neighbors: ['AS 244 Entry', 'Out 244 & 245', 'Out ITC'] },

    { label: 'AS 245 Entry', x: 155, y: 390, neighbors: ['AS 245 Exit', 'AS 245 Entrance'] },
    { label: 'AS 245 Exit', x: 115, y: 360, neighbors: ['AS 245 Entry', 'Near E2 & E3'] },
    { label: 'AS 245 Entrance', x: 200, y: 360, neighbors: ['AS 245 Entry', 'Out 244 & 245', 'Out ITC'] },

    { label: 'ITC Entry', x: 290, y: 290, neighbors: ['ITC Exit', 'ITC Entrance'] },
    { label: 'ITC Exit', x: 250, y: 320, neighbors: ['ITC Entry'] },
    { label: 'ITC Entrance', x: 335, y: 320, neighbors: ['ITC Entry'] },

    { label: 'Out Math Faculty', x: 929, y: 340, neighbors: ['Out 231', 'Out 233'] },
    { label: 'Out 231', x: 1030, y: 340, neighbors: ['Near E4 & E5'] },
    { label: 'Out 233', x: 885, y: 340, neighbors: ['AS 233 Exit', 'Out 235', 'Out Math Faculty', 'Math Out 2'] },
    { label: 'Out 235', x: 786, y: 340, neighbors: ['AS 233 Exit', 'Out 239'] },
    { label: 'Out 239', x: 683, y: 340, neighbors: ['Central Corridor', 'Near Exit 1', 'Out 235', 'AS 235 Exit'] },
    { label: 'Out 240', x: 385, y: 340, neighbors: ['Central Corridor', 'ITC Entrance'] },
    { label: 'Out 244 & 245', x: 155, y: 340, neighbors: ['Near E2 & E3', 'AS 245 Entrance', 'AS 244 Entrance', 'ITC Exit', 'AS 244 Exit', 'AS 245 Exit'] },
    { label: 'Out ITC', x: 250, y: 340, neighbors: ['Out 244 & 245', 'Out 243', 'ITC Exit', 'AS 244 Entrance', 'AS 243 Exit'] },
    { label: 'Out 243', x: 315, y: 340, neighbors: ['AS 243 Entrance', 'Out ITC', 'Out 240', 'ITC Entrance'] },

    { label: 'Near E2 & E3', x: 71, y: 340, neighbors: ['E2', 'E3', 'AS 244 Exit', 'AS 245 Exit'] },
    { label: 'Near E4 & E5', x: 1127, y: 340, neighbors: ['Out 231', 'E4', 'E5'] },


    { label: 'Central Corridor', x: 580, y: 340, neighbors: ['Near Exit 1'] },
    { label: 'Near Exit 1', x: 580, y: 370, neighbors: ['Central Corridor', 'E1'] },
  ],
}

const AS_EAST_WING_3F: FloorConfig = {
  viewWidth: 1200,
  viewHeight: 675,
  floorLabel: '3rd Floor',
  exits: {
    E1: { x: 580, y: 460, label: 'E1', desc: '' },
    E2: { x: 71, y: 300, label: 'E2', desc: '' },
    E3: { x: 71, y: 380, label: 'E3', desc: '' },
    E4: { x: 1131, y: 300, label: 'E4', desc: '' },
    E5: { x: 1131, y: 380, label: 'E5', desc: '' },

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
    as301: { label: 'AS 301', x: 1032, y: 315, corridorEntryNode: '' },
    as302to306: { label: 'AS 302-306', x: 923, y: 400, corridorEntryNode: '' },
    as310: { label: 'AS 310', x: 1030, y: 390, corridorEntryNode: '' },
    as312: { label: 'AS 312', x: 355, y: 400, corridorEntryNode: '' },
    as313: { label: 'AS 313', x: 385, y: 315, corridorEntryNode: '' },
    as314: { label: 'AS 314', x: 155, y: 400, corridorEntryNode: '' },
    as315: { label: 'AS 315', x: 295, y: 290, corridorEntryNode: '' },
    as317: { label: 'AS 317', x: 160, y: 315, corridorEntryNode: '' },
    dcs: { label: 'DCS', x: 860, y: 280, corridorEntryNode: '' },
    
  },
  corridorNodes: [
    { label: '302-306 Entry', x: 923, y: 400, neighbors: ['Near Room 204', 'Near Exit 2'] },
    { label: 'Out 301', x: 1032, y: 340, neighbors: ['Out DCS', 'Near E4 & E5'] },
    { label: 'Out 313', x: 385, y: 340, neighbors: ['Near E2 & E3', 'AS 314 Entrance'] },
    { label: 'Out 312', x: 295, y: 340, neighbors: ['AS 312 Exit'] },
    { label: 'Out 307', x: 160, y: 340, neighbors: ['Near E2 & E3', 'AS 314 Entrance'] },
    { label: 'Out 315', x: 250, y: 340, neighbors: ['Near E2 & E3', 'AS 314 Entrance'] },
    { label: 'Near Room 202', x: 613, y: 220, neighbors: ['Near Toilet', 'Near Room 201'] },
    { label: 'Near Room 201', x: 613, y: 310, neighbors: ['Near Room 202', 'East Corridor'] },

    { label: 'AS 312 Entry', x: 355, y: 400, neighbors: ['AS 312 Exit', 'AS 312 Entrance'] },
    { label: 'AS 312 Exit', x: 295, y: 360, neighbors: ['AS 312 Entry', 'Near E2 & E3'] },
    { label: 'AS 312 Entrance', x: 427, y: 360, neighbors: ['AS 312 Entry', 'Out 307'] },

    { label: 'AS 314 Entry', x: 155, y: 400, neighbors: ['AS 314 Exit', 'AS 314 Entrance'] },
    { label: 'AS 314 Exit', x: 115, y: 360, neighbors: ['AS 314 Entry', 'Out 312'] },
    { label: 'AS 314 Entrance', x: 200, y: 360, neighbors: ['AS 314 Entry', 'Out 307'] },

    { label: 'AS 315 Entry', x: 295, y: 290, neighbors: ['AS 315 Exit', 'AS 315 Entrance'] },
    { label: 'AS 315 Exit', x: 250, y: 315, neighbors: ['AS 315 Entry', 'Out 315'] },
    { label: 'AS 315 Entrance', x: 335, y: 315, neighbors: ['AS 315 Entry', 'Out 307'] },


    { label: 'Out DCS', x: 923, y: 340, neighbors: [''] },
    { label: 'Central Corridor', x: 580, y: 340, neighbors: ['Near Room 201', 'Near Exit 3', 'E1'] },
    { label: 'Near E2 & E3', x: 71, y: 340, neighbors: ['E2', 'E3', 'Out 317', 'AS 314 Exit'] },
    { label: 'Near E4 & E5', x: 1127, y: 340, neighbors: ['Out 301', 'E4', 'E5'] },

  ],
}

export const AS_EAST_WING_FLOORS: FloorConfig[] = [
  AS_EAST_WING_1F,
  AS_EAST_WING_2F,
  AS_EAST_WING_3F,
  
].map(withDenseGraph)
