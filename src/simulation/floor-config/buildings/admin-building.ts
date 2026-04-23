import type { FloorConfig } from '../types'

// ---------- 1st Floor ----------
const N1 = {
  // corridor spine (y=257)
  hub:       { x: 390, y: 257 },
  midWest:   { x: 280, y: 257 },
  westJct:   { x: 150, y: 257 },
  westApp:   { x:  55, y: 257 },
  midEast:   { x: 530, y: 257 },
  eastJct:   { x: 665, y: 257 },
  // exits
  E1: { x: 390, y: 492 },
  E2: { x:  18, y: 257 },
  E3: { x: 762, y: 112 },
  // E3 dog-leg (east wall up to fire escape)
  e3Turn:    { x: 700, y: 200 },
  e3Upper:   { x: 700, y: 112 },
  // E1 descent waypoints
  e1a:       { x: 390, y: 295 },
  e1b:       { x: 390, y: 370 },   // used by primary path
  e1Reroute: { x: 390, y: 350 },   // slightly higher rendezvous used by reroutes
  e1c:       { x: 390, y: 445 },
}

const ADMIN_1F: FloorConfig = {
  viewWidth: 780,
  viewHeight: 500,
  floorLabel: '1st Floor',
  exits: {
    E1: { ...N1.E1, label: 'E1', desc: 'Main Exit \u00B7 South' },
    E2: { ...N1.E2, label: 'E2', desc: 'Side Exit \u00B7 West' },
    E3: { ...N1.E3, label: 'E3', desc: 'Emergency Exit \u00B7 East' },
  },
  startPos: N1.hub,
  primaryPaths: {
    E1: [N1.hub, N1.e1a, N1.e1b, N1.e1c, N1.E1],
    E2: [N1.hub, N1.midWest, N1.westJct, N1.westApp, N1.E2],
    E3: [N1.hub, N1.midEast, N1.eastJct, N1.e3Turn, N1.e3Upper, N1.E3],
  },
  reroutes: {
    E2: { to: 'E1', path: [N1.westJct, N1.midWest, N1.hub, N1.e1Reroute, N1.e1c, N1.E1] },
    E3: { to: 'E1', path: [N1.eastJct, N1.midEast, N1.hub, N1.e1Reroute, N1.e1c, N1.E1] },
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
    corridor: { label: 'Main Corridor', ...N1.hub },
    chancellors: { label: "Chancellor's Office", x: 134, y: 118 },
    lobby: { label: 'Main Lobby', x: 390, y: 122 },
    registrar: { label: 'Registrar', x: 646, y: 122 },
    accounting: { label: 'Accounting', x: 134, y: 385 },
    records: { label: 'Records Room', x: 390, y: 385 },
    hr: { label: 'HR Department', x: 646, y: 385 },
  },
}

// ---------- 2nd Floor ----------
const N2 = {
  hub:     { x: 390, y: 257 },
  midWest: { x: 280, y: 257 },
  westJct: { x: 150, y: 257 },
  S1:      { x:  90, y: 257 },
  midEast: { x: 530, y: 257 },
  eastJct: { x: 665, y: 257 },
  S2:      { x: 690, y: 257 },
  e3Turn:  { x: 700, y: 200 },
  e3Upper: { x: 700, y: 112 },
  E3:      { x: 762, y: 112 },
}

const ADMIN_2F: FloorConfig = {
  viewWidth: 780,
  viewHeight: 500,
  floorLabel: '2nd Floor',
  exits: {
    S1: { ...N2.S1, label: 'S1', desc: 'West Stairwell \u00B7 Down' },
    S2: { ...N2.S2, label: 'S2', desc: 'East Stairwell \u00B7 Down' },
    E3: { ...N2.E3, label: 'E3', desc: 'Fire Escape \u00B7 East' },
  },
  startPos: N2.hub,
  primaryPaths: {
    S1: [N2.hub, N2.midWest, N2.westJct, N2.S1],
    S2: [N2.hub, N2.midEast, N2.S2],
    E3: [N2.hub, N2.midEast, N2.eastJct, N2.e3Turn, N2.e3Upper, N2.E3],
  },
  reroutes: {
    S1: { to: 'S2', path: [N2.westJct, N2.midWest, N2.hub, N2.midEast, N2.S2] },
    S2: { to: 'S1', path: [N2.midEast, N2.hub, N2.midWest, N2.westJct, N2.S1] },
    E3: { to: 'S1', path: [N2.eastJct, N2.midEast, N2.hub, N2.midWest, N2.S1] },
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
    corridor: { label: 'Main Corridor', ...N2.hub },
    conference: { label: 'Conference Room', x: 134, y: 118 },
    openoffice: { label: 'Open Office', x: 390, y: 122 },
    it: { label: 'IT Office', x: 646, y: 122 },
    storage: { label: 'Storage', x: 134, y: 385 },
    meeting: { label: 'Meeting Room', x: 390, y: 385 },
    supply: { label: 'Supply Room', x: 646, y: 385 },
  },
}

// ---------- 3rd Floor ----------
const N3 = {
  hub:     { x: 390, y: 257 },
  midWest: { x: 280, y: 257 },
  westJct: { x: 150, y: 257 },
  S1:      { x:  90, y: 257 },
  midEast: { x: 530, y: 257 },
  eastJct: { x: 665, y: 257 },
  S2:      { x: 690, y: 257 },
  e3Turn:  { x: 700, y: 200 },
  e3Upper: { x: 700, y: 112 },
  E3:      { x: 762, y: 112 },
}

const ADMIN_3F: FloorConfig = {
  viewWidth: 780,
  viewHeight: 500,
  floorLabel: '3rd Floor',
  exits: {
    S1: { ...N3.S1, label: 'S1', desc: 'West Stairwell \u00B7 Down' },
    S2: { ...N3.S2, label: 'S2', desc: 'East Stairwell \u00B7 Down' },
    E3: { ...N3.E3, label: 'E3', desc: 'Fire Escape \u00B7 East' },
  },
  startPos: N3.hub,
  primaryPaths: {
    S1: [N3.hub, N3.midWest, N3.westJct, N3.S1],
    S2: [N3.hub, N3.midEast, N3.S2],
    E3: [N3.hub, N3.midEast, N3.eastJct, N3.e3Turn, N3.e3Upper, N3.E3],
  },
  reroutes: {
    S1: { to: 'S2', path: [N3.westJct, N3.midWest, N3.hub, N3.midEast, N3.S2] },
    S2: { to: 'S1', path: [N3.midEast, N3.hub, N3.midWest, N3.westJct, N3.S1] },
    E3: { to: 'S1', path: [N3.eastJct, N3.midEast, N3.hub, N3.midWest, N3.S1] },
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
    corridor: { label: 'Main Corridor', ...N3.hub },
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
  ADMIN_3F,
]
