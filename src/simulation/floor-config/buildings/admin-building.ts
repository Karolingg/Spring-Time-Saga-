import type { FloorConfig } from '../types'
import { makePlaceholderFloor } from '../placeholder'

const ADMIN_1F: FloorConfig = {
  viewWidth: 780,
  viewHeight: 500,
  floorLabel: '1st Floor',
  exits: {
    E1: { x: 390, y: 492, label: 'E1', desc: 'Main Exit \u00B7 South' },
    E2: { x: 18, y: 257, label: 'E2', desc: 'Side Exit \u00B7 West' },
    E3: { x: 762, y: 112, label: 'E3', desc: 'Emergency Exit \u00B7 East' },
  },
  startPos: { x: 390, y: 257 },
  primaryPaths: {
    E1: [{ x: 390, y: 257 }, { x: 390, y: 295 }, { x: 390, y: 370 }, { x: 390, y: 445 }, { x: 390, y: 492 }],
    E2: [{ x: 390, y: 257 }, { x: 280, y: 257 }, { x: 150, y: 257 }, { x: 55, y: 257 }, { x: 18, y: 257 }],
    E3: [{ x: 390, y: 257 }, { x: 530, y: 257 }, { x: 665, y: 257 }, { x: 700, y: 200 }, { x: 700, y: 112 }, { x: 762, y: 112 }],
  },
  reroutes: {
    E2: { to: 'E1', path: [{ x: 150, y: 257 }, { x: 280, y: 257 }, { x: 390, y: 257 }, { x: 390, y: 350 }, { x: 390, y: 445 }, { x: 390, y: 492 }] },
    E3: { to: 'E1', path: [{ x: 665, y: 257 }, { x: 530, y: 257 }, { x: 390, y: 257 }, { x: 390, y: 350 }, { x: 390, y: 445 }, { x: 390, y: 492 }] },
    E1: { to: 'E1', path: [] },
  },
  blockT: { E2: 0.45, E3: 0.5, E1: 1 },
  obstacles: {
    fire: [
      { id: 'fire-accounting', x: 22, y: 345, w: 225, h: 130, type: 'fire', label: 'Fire', blocksExits: ['E2'] },
      { id: 'smoke-west-corridor', x: 22, y: 232, w: 130, h: 55, type: 'smoke', label: 'Smoke', blocksExits: ['E2'] },
      { id: 'smoke-records', x: 248, y: 290, w: 130, h: 80, type: 'smoke', label: 'Smoke', blocksExits: [] },
    ],
    earthquake: [
      { id: 'debris-west-corridor', x: 72, y: 234, w: 95, h: 46, type: 'debris', label: 'Debris', blocksExits: ['E2'] },
      { id: 'debris-east-corridor', x: 524, y: 224, w: 75, h: 66, type: 'debris', label: 'Debris', blocksExits: ['E3'] },
      { id: 'debris-lobby-ceiling', x: 248, y: 22, w: 262, h: 22, type: 'debris', label: 'Structural Damage', blocksExits: [] },
    ],
  },
  efficiency: { E1: 0.95, E2: 0.88, E3: 0.72 },
  rooms: {
    corridor: { label: 'Main Corridor', x: 390, y: 257 },
    chancellors: { label: "Chancellor's Office", x: 134, y: 118 },
    lobby: { label: 'Main Lobby', x: 390, y: 122 },
    registrar: { label: 'Registrar', x: 646, y: 122 },
    accounting: { label: 'Accounting', x: 134, y: 385 },
    records: { label: 'Records Room', x: 390, y: 385 },
    hr: { label: 'HR Department', x: 646, y: 385 },
  },
}

const ADMIN_2F: FloorConfig = {
  viewWidth: 780,
  viewHeight: 500,
  floorLabel: '2nd Floor',
  exits: {
    S1: { x: 90, y: 257, label: 'S1', desc: 'West Stairwell \u00B7 Down' },
    S2: { x: 690, y: 257, label: 'S2', desc: 'East Stairwell \u00B7 Down' },
    E3: { x: 762, y: 112, label: 'E3', desc: 'Fire Escape \u00B7 East' },
  },
  startPos: { x: 390, y: 257 },
  primaryPaths: {
    S1: [{ x: 390, y: 257 }, { x: 280, y: 257 }, { x: 150, y: 257 }, { x: 90, y: 257 }],
    S2: [{ x: 390, y: 257 }, { x: 530, y: 257 }, { x: 690, y: 257 }],
    E3: [{ x: 390, y: 257 }, { x: 530, y: 257 }, { x: 665, y: 257 }, { x: 700, y: 200 }, { x: 700, y: 112 }, { x: 762, y: 112 }],
  },
  reroutes: {
    S1: { to: 'S2', path: [{ x: 150, y: 257 }, { x: 280, y: 257 }, { x: 390, y: 257 }, { x: 530, y: 257 }, { x: 690, y: 257 }] },
    S2: { to: 'S1', path: [{ x: 530, y: 257 }, { x: 390, y: 257 }, { x: 280, y: 257 }, { x: 150, y: 257 }, { x: 90, y: 257 }] },
    E3: { to: 'S1', path: [{ x: 665, y: 257 }, { x: 530, y: 257 }, { x: 390, y: 257 }, { x: 280, y: 257 }, { x: 90, y: 257 }] },
  },
  blockT: { S1: 0.5, S2: 0.5, E3: 0.5 },
  obstacles: {
    fire: [
      { id: 'fire-office-west', x: 22, y: 30, w: 210, h: 190, type: 'fire', label: 'Fire', blocksExits: ['S1'] },
      { id: 'smoke-corridor-west', x: 22, y: 232, w: 140, h: 55, type: 'smoke', label: 'Smoke', blocksExits: ['S1'] },
    ],
    earthquake: [
      { id: 'debris-stair-east', x: 640, y: 230, w: 100, h: 55, type: 'debris', label: 'Debris', blocksExits: ['S2'] },
      { id: 'debris-ceiling', x: 250, y: 100, w: 280, h: 30, type: 'debris', label: 'Structural Damage', blocksExits: [] },
    ],
  },
  efficiency: { S1: 0.9, S2: 0.88, E3: 0.7 },
  rooms: {
    corridor: { label: 'Main Corridor', x: 390, y: 257 },
    conference: { label: 'Conference Room', x: 134, y: 118 },
    openoffice: { label: 'Open Office', x: 390, y: 122 },
    it: { label: 'IT Office', x: 646, y: 122 },
    storage: { label: 'Storage', x: 134, y: 385 },
    meeting: { label: 'Meeting Room', x: 390, y: 385 },
    supply: { label: 'Supply Room', x: 646, y: 385 },
  },
}

export const ADMIN_BUILDING_FLOORS: FloorConfig[] = [
  ADMIN_1F,
  ADMIN_2F,
  makePlaceholderFloor(2),
]
