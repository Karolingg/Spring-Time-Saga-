'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/src/hooks/useAuth'

// ─── Types ────────────────────────────────────────────────────────────────────
type SimPhase = 'planning' | 'running' | 'rerouting' | 'completed'
type DisasterType = 'fire' | 'earthquake'

interface Point { x: number; y: number }

interface ExitDef {
  x: number; y: number; label: string; desc: string;
}

interface ObstacleDef {
  id: string
  x: number; y: number; w: number; h: number
  type: 'fire' | 'smoke' | 'debris'
  label: string
  blocksExits: string[]
}

interface RoomDef {
  label: string
  x: number
  y: number
  // pathToCorridor removed — routing now uses room center and corridor nodes
}

interface CorridorNode {
  label: string
  x: number
  y: number
  neighbors?: string[]
}

interface FloorConfig {
  viewWidth: number
  viewHeight: number
  exits: Record<string, ExitDef>
  startPos: Point
  primaryPaths: Record<string, Point[]>
  reroutes: Record<string, { to: string; path: Point[] }>
  blockT: Record<string, number>
  obstacles: Record<DisasterType, ObstacleDef[]>
  efficiency: Record<string, number>
  floorLabel: string
  rooms: Record<string, RoomDef>
  corridorNodes?: CorridorNode[]
}

type RouteMode = 'fastest' | 'safest' | null

interface SimEvent {
  time: number
  message: string
  type: 'info' | 'warn' | 'danger'
}

interface SimMetrics {
  evacuationTime: number
  rerouted: boolean
  reroutedFrom?: string
  reroutedTo?: string
  hazardExposure: boolean
  pathEfficiency: number
  exitChoice: string
  actualExit: string
  congestionLevel: 'Low' | 'Medium' | 'High'
}

// ─── Admin Building Configs ─────────────────────────────────────────────────

const ADMIN_1F: FloorConfig = {
  viewWidth: 780, viewHeight: 500,
  floorLabel: '1st Floor',
  exits: {
    E1: { x: 390, y: 492, label: 'E1', desc: 'Main Exit \u00B7 South' },
    E2: { x: 18,  y: 257, label: 'E2', desc: 'Side Exit \u00B7 West' },
    E3: { x: 762, y: 112, label: 'E3', desc: 'Emergency Exit \u00B7 East' },
  },
  startPos: { x: 390, y: 257 },
  primaryPaths: {
    E1: [{ x: 390, y: 257 },{ x: 390, y: 295 },{ x: 390, y: 370 },{ x: 390, y: 445 },{ x: 390, y: 492 }],
    E2: [{ x: 390, y: 257 },{ x: 280, y: 257 },{ x: 150, y: 257 },{ x: 55, y: 257 },{ x: 18, y: 257 }],
    E3: [{ x: 390, y: 257 },{ x: 530, y: 257 },{ x: 665, y: 257 },{ x: 700, y: 200 },{ x: 700, y: 112 },{ x: 762, y: 112 }],
  },
  reroutes: {
    E2: { to: 'E1', path: [{ x: 150, y: 257 },{ x: 280, y: 257 },{ x: 390, y: 257 },{ x: 390, y: 350 },{ x: 390, y: 445 },{ x: 390, y: 492 }] },
    E3: { to: 'E1', path: [{ x: 665, y: 257 },{ x: 530, y: 257 },{ x: 390, y: 257 },{ x: 390, y: 350 },{ x: 390, y: 445 },{ x: 390, y: 492 }] },
    E1: { to: 'E1', path: [] },
  },
  blockT: { E2: 0.45, E3: 0.50, E1: 1 },
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
    corridor:   { label: 'Main Corridor',     x: 390, y: 257 },
    chancellors:{ label: "Chancellor's Office",x: 134, y: 118 },
    lobby:      { label: 'Main Lobby',         x: 390, y: 122 },
    registrar:  { label: 'Registrar',          x: 646, y: 122 },
    accounting: { label: 'Accounting',         x: 134, y: 385 },
    records:    { label: 'Records Room',       x: 390, y: 385 },
    hr:         { label: 'HR Department',      x: 646, y: 385 },
  },
}

const ADMIN_2F: FloorConfig = {
  viewWidth: 780, viewHeight: 500,
  floorLabel: '2nd Floor',
  exits: {
    S1: { x: 90,  y: 257, label: 'S1', desc: 'West Stairwell \u00B7 Down' },
    S2: { x: 690, y: 257, label: 'S2', desc: 'East Stairwell \u00B7 Down' },
    E3: { x: 762, y: 112, label: 'E3', desc: 'Fire Escape \u00B7 East' },
  },
  startPos: { x: 390, y: 257 },
  primaryPaths: {
    S1: [{ x: 390, y: 257 },{ x: 280, y: 257 },{ x: 150, y: 257 },{ x: 90, y: 257 }],
    S2: [{ x: 390, y: 257 },{ x: 530, y: 257 },{ x: 690, y: 257 }],
    E3: [{ x: 390, y: 257 },{ x: 530, y: 257 },{ x: 665, y: 257 },{ x: 700, y: 200 },{ x: 700, y: 112 },{ x: 762, y: 112 }],
  },
  reroutes: {
    S1: { to: 'S2', path: [{ x: 150, y: 257 },{ x: 280, y: 257 },{ x: 390, y: 257 },{ x: 530, y: 257 },{ x: 690, y: 257 }] },
    S2: { to: 'S1', path: [{ x: 530, y: 257 },{ x: 390, y: 257 },{ x: 280, y: 257 },{ x: 150, y: 257 },{ x: 90, y: 257 }] },
    E3: { to: 'S1', path: [{ x: 665, y: 257 },{ x: 530, y: 257 },{ x: 390, y: 257 },{ x: 280, y: 257 },{ x: 90, y: 257 }] },
  },
  blockT: { S1: 0.50, S2: 0.50, E3: 0.50 },
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
  efficiency: { S1: 0.90, S2: 0.88, E3: 0.70 },
  rooms: {
    corridor:   { label: 'Main Corridor',    x: 390, y: 257 },
    conference: { label: 'Conference Room',  x: 134, y: 118 },
    openoffice: { label: 'Open Office',      x: 390, y: 122 },
    it:         { label: 'IT Office',        x: 646, y: 122 },
    storage:    { label: 'Storage',          x: 134, y: 385 },
    meeting:    { label: 'Meeting Room',     x: 390, y: 385 },
    supply:     { label: 'Supply Room',      x: 646, y: 385 },
  },
}

// ─── Science Building (CSB) Configs ─────────────────────────────────────────
// Uses actual SVG floor plan as background (viewBox 1200x675)
// Coordinates mapped from csb-2f.svg: Room 204 left, Rooms 201-203 right,
// toilet top-center, stairs center, exits at green markers

const CSB_1F: FloorConfig = {
  viewWidth: 1200, viewHeight: 675,
  floorLabel: '1st Floor',
  exits: {
    E1: { x: 410, y: 52, label: 'E1', desc: 'North Exit · Main' },
    E2: { x: 370, y: 490, label: 'E2', desc: 'SW Exit · Left' },
    E3: { x: 610, y: 490, label: 'E3', desc: 'S· Right' },
  },
  startPos: { x: 0, y: 0 },
  primaryPaths: {
    // Up corridor, go left of stairs, up to Exit 1
    E1: [{ x: 490, y: 350 },{ x: 490, y: 295 },{ x: 420, y: 270 },{ x: 410, y: 210 },{ x: 410, y: 120 },{ x: 410, y: 52 }],
    // Down corridor, fork left to Exit 2
    E2: [{ x: 490, y: 350 },{ x: 490, y: 410 },{ x: 490, y: 455 },{ x: 430, y: 470 },{ x: 370, y: 490 }],
    // Down corridor, fork right to Exit 3
    E3: [{ x: 490, y: 350 },{ x: 490, y: 410 },{ x: 490, y: 455 },{ x: 550, y: 470 },{ x: 610, y: 490 }],
  },
  reroutes: {
    E1: { to: 'E2', path: [{ x: 410, y: 120 },{ x: 410, y: 210 },{ x: 420, y: 270 },{ x: 490, y: 295 },{ x: 490, y: 350 },{ x: 490, y: 410 },{ x: 490, y: 455 },{ x: 430, y: 470 },{ x: 370, y: 490 }] },
    E2: { to: 'E3', path: [{ x: 430, y: 470 },{ x: 490, y: 455 },{ x: 550, y: 470 },{ x: 610, y: 490 }] },
    E3: { to: 'E2', path: [{ x: 550, y: 470 },{ x: 490, y: 455 },{ x: 430, y: 470 },{ x: 370, y: 490 }] },
  },
  blockT: { E1: 0.50, E2: 0.50, E3: 0.55 },
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
    corridor: { label: 'Corridor',     x: 490, y: 350 },
    r204:     { label: 'Room 204',     x: 220, y: 250 },
    r203:     { label: 'Room 203',     x: 730, y: 100 },
    r202:     { label: 'Room 202',     x: 730, y: 250 },
    r201:     { label: 'Room 201',     x: 730, y: 400 },
  },
  corridorNodes: [
    { label: 'Left Corridor',    x: 364, y: 369 },
    { label: 'Near Room 204',    x: 357, y: 255 },
    { label: 'Upper Corridor',   x: 364, y: 175 },
    { label: 'Near Stairs',      x: 482, y: 173 },
    { label: 'Near Toilet',      x: 490, y: 290 },
    { label: 'East Corridor',    x: 613, y: 412 },
  ],
}

const CSB_2F: FloorConfig = {
  viewWidth: 1200, viewHeight: 675,
  floorLabel: '2nd Floor',
  exits: {
    S1: { x: 490, y: 266.5, label: 'S1', desc: '' },
    S2: { x: 365, y: 520, label: 'E2', desc: '' },
    S3: { x: 608, y: 520, label: 'E3', desc: '' },
    S4: { x: 364, y: 400, label: 'E4', desc: 'test node' },
    S5: { x: 390, y: 450, label: 'E', desc: 'test node' },
  },
  startPos: { x: 0, y: 0 },
  primaryPaths: {
    // Up corridor, go left of railing, reach center stairwell
    S1: [{ x: 490, y: 180 },{ x: 490, y: 295 },{ x: 420, y: 270 },{ x: 420, y: 240 },{ x: 490, y: 230 }],
    // Down corridor, fork left to SW stairs
    S2: [{ x: 490, y: 350 },{ x: 490, y: 410 },{ x: 490, y: 455 },{ x: 430, y: 470 },{ x: 370, y: 490 }],
    // Down corridor, fork right to SE stairs
    S3: [{ x: 490, y: 350 },{ x: 490, y: 410 },{ x: 490, y: 455 },{ x: 550, y: 470 },{ x: 610, y: 490 }],
  },
  reroutes: {
    S1: { to: 'S2', path: [{ x: 420, y: 240 },{ x: 420, y: 270 },{ x: 490, y: 295 },{ x: 490, y: 350 },{ x: 490, y: 410 },{ x: 490, y: 455 },{ x: 430, y: 470 },{ x: 370, y: 490 }] },
    S2: { to: 'S3', path: [{ x: 430, y: 470 },{ x: 490, y: 455 },{ x: 550, y: 470 },{ x: 610, y: 490 }] },
    S3: { to: 'S2', path: [{ x: 550, y: 470 },{ x: 490, y: 455 },{ x: 430, y: 470 },{ x: 370, y: 490 }] },
  },
  blockT: { S1: 0.55, S2: 0.50, S3: 0.50 },
  obstacles: {
    fire: [
      { id: 'fire-r203', x: 650, y: 45, w: 130, h: 110, type: 'fire', label: 'Room 203 Fire', blocksExits: [] },
      { id: 'smoke-corridor-east', x: 555, y: 280, w: 80, h: 50, type: 'smoke', label: 'Smoke', blocksExits: ['S3'] },
      { id: 'smoke-spreading', x: 590, y: 165, w: 60, h: 50, type: 'smoke', label: 'Smoke', blocksExits: [] },
    ],
    earthquake: [
      { id: 'debris-center-stair', x: 440, y: 215, w: 100, h: 45, type: 'debris', label: 'Stairwell Debris', blocksExits: ['S1'] },
      { id: 'debris-corridor', x: 440, y: 330, w: 100, h: 35, type: 'debris', label: 'Debris', blocksExits: [] },
      { id: 'debris-se-stair', x: 580, y: 470, w: 70, h: 40, type: 'debris', label: 'Debris', blocksExits: ['S3'] },
    ],
  },
  efficiency: { S1: 0.92, S2: 0.85, S3: 0.85 },
  rooms: {
    corridor: { label: 'Corridor',     x: 490, y: 350 },
    r204:     { label: 'Room 204',     x: 220, y: 250 },
    r203:     { label: 'Room 203',     x: 730, y: 100 },
    r202:     { label: 'Room 202',     x: 720, y: 280 },
    r201:     { label: 'Room 201',     x: 730, y: 400 },
  },
  corridorNodes: [
    { label: 'Left Corridor',    x: 365, y: 369 },
    { label: 'Near Room 204',    x: 357, y: 255 },
    { label: 'Upper Corridor',   x: 364, y: 175 },
    { label: 'Near Stairs',      x: 482, y: 173 },
    { label: 'Near Room 202',    x: 613, y: 220 },
    { label: 'Near Room 201',    x: 613, y: 310 },
    { label: 'Near Toilet',      x: 570, y: 173 },
    { label: 'East Corridor',    x: 613, y: 412 },
  ],
}

// ─── Placeholder floor config generator ─────────────────────────────────────
// Uses CSB layout as a placeholder for buildings without custom floor plans
function makePlaceholderFloor(floorIndex: number): FloorConfig {
  const label = floorIndex === 0 ? '1st Floor' : floorIndex === 1 ? '2nd Floor' : floorIndex === 2 ? '3rd Floor' : `${floorIndex + 1}th Floor`
  const isGround = floorIndex === 0
  return {
    viewWidth: 1200, viewHeight: 675,
    floorLabel: label,
    exits: isGround
      ? {
          E1: { x: 410, y: 52, label: 'E1' , desc: ''},
          E2: { x: 365, y: 520, label: 'E2', desc: '' },
          E3: { x: 605, y: 520, label: 'E3', desc: ''},
        }
      : {
          S1: { x: 490, y: 230, label: 'S1', desc: 'Center Stairs · Down' },
          S2: { x: 370, y: 490, label: 'S2', desc: 'SW Stairs · Down' },
          S3: { x: 610, y: 490, label: 'S3', desc: 'SE Stairs · Down' },
        },
    startPos: { x: 490, y: 350 },
    primaryPaths: isGround
      ? {
          E1: [{ x: 490, y: 350 },{ x: 490, y: 295 },{ x: 420, y: 270 },{ x: 410, y: 210 },{ x: 410, y: 120 },{ x: 410, y: 52 }],
          E2: [{ x: 490, y: 350 },{ x: 490, y: 410 },{ x: 490, y: 455 },{ x: 430, y: 470 },{ x: 370, y: 490 }],
          E3: [{ x: 490, y: 350 },{ x: 490, y: 410 },{ x: 490, y: 455 },{ x: 550, y: 470 },{ x: 610, y: 490 }],
        }
      : {
          S1: [{ x: 490, y: 350 },{ x: 490, y: 295 },{ x: 420, y: 270 },{ x: 420, y: 240 },{ x: 490, y: 230 }],
          S2: [{ x: 490, y: 350 },{ x: 490, y: 410 },{ x: 490, y: 455 },{ x: 430, y: 470 },{ x: 370, y: 490 }],
          S3: [{ x: 490, y: 350 },{ x: 490, y: 410 },{ x: 490, y: 455 },{ x: 550, y: 470 },{ x: 610, y: 490 }],
        },
    reroutes: isGround
      ? {
          E1: { to: 'E2', path: [{ x: 410, y: 120 },{ x: 410, y: 210 },{ x: 420, y: 270 },{ x: 490, y: 295 },{ x: 490, y: 350 },{ x: 490, y: 410 },{ x: 490, y: 455 },{ x: 430, y: 470 },{ x: 370, y: 490 }] },
          E2: { to: 'E3', path: [{ x: 430, y: 470 },{ x: 490, y: 455 },{ x: 550, y: 470 },{ x: 610, y: 490 }] },
          E3: { to: 'E2', path: [{ x: 550, y: 470 },{ x: 490, y: 455 },{ x: 430, y: 470 },{ x: 370, y: 490 }] },
        }
      : {
          S1: { to: 'S2', path: [{ x: 420, y: 240 },{ x: 420, y: 270 },{ x: 490, y: 295 },{ x: 490, y: 350 },{ x: 490, y: 410 },{ x: 490, y: 455 },{ x: 430, y: 470 },{ x: 370, y: 490 }] },
          S2: { to: 'S3', path: [{ x: 430, y: 470 },{ x: 490, y: 455 },{ x: 550, y: 470 },{ x: 610, y: 490 }] },
          S3: { to: 'S2', path: [{ x: 550, y: 470 },{ x: 490, y: 455 },{ x: 430, y: 470 },{ x: 370, y: 490 }] },
        },
    blockT: isGround
      ? { E1: 0.50, E2: 0.50, E3: 0.55 }
      : { S1: 0.55, S2: 0.50, S3: 0.50 },
    obstacles: {
      fire: isGround
        ? [
            { id: 'fire-north', x: 375, y: 40, w: 80, h: 70, type: 'fire', label: 'Fire', blocksExits: ['E1'] },
            { id: 'smoke-corridor', x: 450, y: 300, w: 90, h: 45, type: 'smoke', label: 'Smoke', blocksExits: [] },
          ]
        : [
            { id: 'fire-room', x: 650, y: 45, w: 130, h: 110, type: 'fire', label: 'Fire', blocksExits: [] },
            { id: 'smoke-corridor', x: 555, y: 280, w: 80, h: 50, type: 'smoke', label: 'Smoke', blocksExits: ['S3'] },
          ],
      earthquake: isGround
        ? [
            { id: 'debris-sw', x: 340, y: 470, w: 80, h: 40, type: 'debris', label: 'Debris', blocksExits: ['E2'] },
            { id: 'debris-corridor', x: 450, y: 280, w: 90, h: 30, type: 'debris', label: 'Structural Damage', blocksExits: [] },
          ]
        : [
            { id: 'debris-center', x: 440, y: 215, w: 100, h: 45, type: 'debris', label: 'Stairwell Debris', blocksExits: ['S1'] },
            { id: 'debris-se', x: 580, y: 470, w: 70, h: 40, type: 'debris', label: 'Debris', blocksExits: ['S3'] },
          ],
    },
    efficiency: isGround
      ? { E1: 0.92, E2: 0.88, E3: 0.85 }
      : { S1: 0.92, S2: 0.85, S3: 0.85 },
    rooms: {
      corridor: { label: 'Corridor',     x: 490, y: 350 },
      r204:     { label: 'Room 204',     x: 220, y: 250 },
      r203:     { label: 'Room 203',     x: 730, y: 100 },
      r202:     { label: 'Room 202',     x: 720, y: 280 },
      r201:     { label: 'Room 201',     x: 730, y: 400 },
    },
  }
}

/* Floor counts for buildings without custom configs */
const BUILDING_FLOOR_COUNT: Record<string, number> = {
  'as-west-wing': 2,
  'as-east-wing': 2,
  'som-admin': 2,
  'som-building-1': 3,
  'cultural-center': 1,
  'social-sciences': 2,
  'liadlaw-hall': 2,
  'up-cebu-library': 2,
  'up-high-school': 2,
}

// ─── Building → Floor Configs ────────────────────────────────────────────────
const BUILDING_FLOORS: Record<string, FloorConfig[]> = {
  'admin-building':   [ADMIN_1F, ADMIN_2F],
  'science-building': [CSB_1F, CSB_2F],
}

function getFloorConfigs(buildingId: string): FloorConfig[] {
  if (BUILDING_FLOORS[buildingId]) return BUILDING_FLOORS[buildingId]
  const count = BUILDING_FLOOR_COUNT[buildingId]
  if (count) return Array.from({ length: count }, (_, i) => makePlaceholderFloor(i))
  // Fallback: 2-floor placeholder
  return [makePlaceholderFloor(0), makePlaceholderFloor(1)]
}

// ─── Path Math ───────────────────────────────────────────────────────────────
function pathLength(path?: Point[] | null): number {
  if (!path || path.length === 0) return 0
  let len = 0
  for (let i = 1; i < path.length; i++) {
    const dx = path[i].x - path[i - 1].x
    const dy = path[i].y - path[i - 1].y
    len += Math.sqrt(dx * dx + dy * dy)
  }
  return len
}

function interpolatePath(path?: Point[] | null, t?: number): Point {
  // Defensive: if path missing or empty, return origin
  if (!path || path.length === 0) return { x: 0, y: 0 }
  const tt = typeof t === 'number' ? t : 0
  if (tt <= 0) return path[0]
  if (tt >= 1) return path[path.length - 1]
  const segs: number[] = []
  let total = 0
  for (let i = 1; i < path.length; i++) {
    const d = Math.sqrt((path[i].x - path[i-1].x)**2 + (path[i].y - path[i-1].y)**2)
    segs.push(d); total += d
  }
  if (total === 0) return path[0]
  const target = tt * total
  let acc = 0
  for (let i = 0; i < segs.length; i++) {
    if (acc + segs[i] >= target) {
      const st = (target - acc) / segs[i]
      return {
        x: path[i].x + st * (path[i+1].x - path[i].x),
        y: path[i].y + st * (path[i+1].y - path[i].y),
      }
    }
    acc += segs[i]
  }
  return path[path.length - 1]
}

// ─── Route Analysis ─────────────────────────────────────────────────────────
interface RouteAnalysis {
  exitKey: string
  totalLength: number
  isBlocked: boolean
  efficiency: number
  hazardExposure: boolean
  estimatedTime: number
}

function analyzeRoutes(
  config: FloorConfig,
  selectedRoom: string | null,
  disaster: DisasterType,
  blockedExits: Set<string>,
): RouteAnalysis[] {
  const roomPrefix = selectedRoom && config.rooms[selectedRoom]
    ? [{ x: config.rooms[selectedRoom].x, y: config.rooms[selectedRoom].y }]
    : []
  const roomPrefixLen = pathLength(roomPrefix)
  const SPEED = 80

  return Object.keys(config.exits).map(key => {
    const exitPath = config.primaryPaths[key]
    const totalLen = roomPrefixLen + pathLength(exitPath)
    const isBlocked = blockedExits.has(key)
    const efficiency = config.efficiency[key] || 0.5
    const hazardExposure = config.obstacles[disaster].some(obs =>
      obs.type !== 'debris' && obs.blocksExits.includes(key)
    )
    return {
      exitKey: key,
      totalLength: totalLen,
      isBlocked,
      efficiency,
      hazardExposure,
      estimatedTime: parseFloat((totalLen / SPEED).toFixed(1)),
    }
  })
}

function getRecommendedExit(routes: RouteAnalysis[], mode: 'fastest' | 'safest'): string {
  if (mode === 'fastest') {
    const sorted = [...routes].sort((a, b) => a.totalLength - b.totalLength)
    return sorted[0].exitKey
  }
  // Safest: prefer unblocked, no hazard exposure, highest efficiency
  const safe = routes.filter(r => !r.isBlocked && !r.hazardExposure)
  if (safe.length > 0) return safe.sort((a, b) => b.efficiency - a.efficiency)[0].exitKey
  const unblocked = routes.filter(r => !r.isBlocked)
  if (unblocked.length > 0) return unblocked.sort((a, b) => b.efficiency - a.efficiency)[0].exitKey
  return routes.sort((a, b) => b.efficiency - a.efficiency)[0].exitKey
}

function buildFullPath(config: FloorConfig, selectedRoom: string | null, exitKey: string, viaLabels?: string[] | null): Point[] {
  const roomPrefix = selectedRoom && config.rooms[selectedRoom]
    ? [{ x: config.rooms[selectedRoom].x, y: config.rooms[selectedRoom].y }]
    : []
    const exitPath = config.primaryPaths[exitKey] || []
    // Strip any out-of-bounds anchor points (for example 490,350)
    const exitPathFiltered = exitPath.filter(p => !(p.x === 490 && p.y === 350))
  if (exitPath.length === 0) return [...roomPrefix]

  // Helper to dedupe consecutive identical points
  const pushIfDifferent = (arr: Point[], p: Point) => { const last = arr[arr.length - 1]; if (!last || last.x !== p.x || last.y !== p.y) arr.push(p) }

  // If explicit via labels provided, map them to corridor nodes in order
  if (viaLabels && viaLabels.length > 0 && config.corridorNodes) {
    const viaPoints: Point[] = []
    for (const label of viaLabels) {
      const node = config.corridorNodes.find(n => n.label === label)
      if (node) viaPoints.push({ x: node.x, y: node.y })
    }
    const parts: Point[] = []
    roomPrefix.forEach(p => pushIfDifferent(parts, p))
    viaPoints.forEach(p => pushIfDifferent(parts, p))
      exitPathFiltered.forEach(p => pushIfDifferent(parts, p))
    return avoidForbiddenZones(parts, config)
  }

  // Otherwise, connect via corridor nodes: nearest node to room -> shortest chain -> nearest node to exit
  if (config.corridorNodes && config.corridorNodes.length > 0) {
    // Filter out forbidden coordinate nodes (out-of-bounds)
    const nodes = config.corridorNodes.filter(n => !(n.x === 490 && n.y === 350))
    const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
    const roomPoint = roomPrefix[roomPrefix.length - 1]
    const exitPoint = exitPath[0]

    const findNearestIndex = (pt: Point) => {
      let best = 0; let bestD = Infinity
      for (let i = 0; i < nodes.length; i++) {
        const d = dist(pt, nodes[i])
        if (d < bestD) { bestD = d; best = i }
      }
      return best
    }

    const s = findNearestIndex(roomPoint)
    const t = findNearestIndex(exitPoint)

    // Simple Dijkstra on fully connected node graph
    const n = nodes.length
    const D = Array(n).fill(Infinity)
    const prev = Array(n).fill(-1)
    const used = Array(n).fill(false)
    D[s] = 0
    for (;;) {
      let u = -1; let best = Infinity
      for (let i = 0; i < n; i++) if (!used[i] && D[i] < best) { best = D[i]; u = i }
      if (u === -1) break
      if (u === t) break
      used[u] = true
      for (let v = 0; v < n; v++) {
        if (used[v]) continue
        const w = Math.hypot(nodes[u].x - nodes[v].x, nodes[u].y - nodes[v].y)
        if (D[u] + w < D[v]) { D[v] = D[u] + w; prev[v] = u }
      }
    }
    const idxChain: number[] = []
    if (prev[t] === -1 && s !== t) { idxChain.push(s); idxChain.push(t) }
    else {
      let cur = t
      while (cur !== -1) { idxChain.push(cur); cur = prev[cur] }
      idxChain.reverse()
    }

    const parts: Point[] = []
    roomPrefix.forEach(p => pushIfDifferent(parts, p))
    for (const i of idxChain) pushIfDifferent(parts, { x: nodes[i].x, y: nodes[i].y })
      exitPathFiltered.forEach(p => pushIfDifferent(parts, p))
    return avoidForbiddenZones(parts, config)
  }

  // Fallback: direct room center -> exit path
  const parts: Point[] = []
  roomPrefix.forEach(p => pushIfDifferent(parts, p))
    exitPathFiltered.forEach(p => pushIfDifferent(parts, p))
  return avoidForbiddenZones(parts, config)
}

// --- Forbidden-zone helpers: avoid simple rectangular "railing/stairs" areas derived from corridorNodes
function buildForbiddenRects(config: FloorConfig) {
  const rects: { x: number; y: number; w: number; h: number }[] = []
  if (!config.corridorNodes) return rects
  for (const n of config.corridorNodes) {
    if (/stair/i.test(n.label) || /stairs/i.test(n.label)) {
      const w = 140
      const h = 80
      rects.push({ x: Math.round(n.x - w / 2), y: Math.round(n.y - h / 2), w, h })
    }
  }
  return rects
}

function pointInRect(p: Point, r: { x: number; y: number; w: number; h: number }) {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h
}

function segmentIntersectsRect(a: Point, b: Point, r: { x: number; y: number; w: number; h: number }) {
  if ((a.x < r.x && b.x < r.x) || (a.x > r.x + r.w && b.x > r.x + r.w) || (a.y < r.y && b.y < r.y) || (a.y > r.y + r.h && b.y > r.y + r.h)) return false
  if (pointInRect(a, r) || pointInRect(b, r)) return true
  const rectEdges = [
    [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }],
    [{ x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }],
    [{ x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }],
    [{ x: r.x, y: r.y + r.h }, { x: r.x, y: r.y }],
  ]
  const intersects = (p1: Point, p2: Point, p3: Point, p4: Point) => {
    const orient = (p: Point, q: Point, r: Point) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)
    const o1 = orient(p1, p2, p3)
    const o2 = orient(p1, p2, p4)
    const o3 = orient(p3, p4, p1)
    const o4 = orient(p3, p4, p2)
    return o1 * o2 < 0 && o3 * o4 < 0
  }
  for (const [e1, e2] of rectEdges) if (intersects(a, b, e1, e2)) return true
  return false
}

function avoidForbiddenZones(path: Point[], config: FloorConfig): Point[] {
  if (!path || path.length < 2) return path
  // filter out accidental origin points first
  const filtered = path.filter(p => !(p.x === 0 && p.y === 0))
  const rects = buildForbiddenRects(config)
  if (rects.length === 0) return filtered
  const out: Point[] = []
  const pushIfDifferent = (p: Point) => {
    const last = out[out.length - 1]
    if (!last || last.x !== p.x || last.y !== p.y) out.push(p)
  }
  for (let i = 0; i < filtered.length - 1; i++) {
    const a = filtered[i]
    const b = filtered[i + 1]
    let handled = false
    for (const r of rects) {
      if (segmentIntersectsRect(a, b, r)) {
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
        const left = { x: r.x - 12, y: mid.y }
        const right = { x: r.x + r.w + 12, y: mid.y }
        const top = { x: mid.x, y: r.y - 12 }
        const bottom = { x: mid.x, y: r.y + r.h + 12 }
        const candidates = [left, right, top, bottom]
        const valid = candidates.filter(c => !rects.some(rr => pointInRect(c, rr)))
        if (valid.length === 0) continue
        const dist = (p: Point, q: Point) => Math.hypot(p.x - q.x, p.y - q.y)
        valid.sort((p, q) => (dist(a, p) + dist(p, b)) - (dist(a, q) + dist(q, b)))
        const detour = valid[0]
        pushIfDifferent(a)
        pushIfDifferent(detour)
        handled = true
        break
      }
    }
    if (!handled) pushIfDifferent(a)
  }
  pushIfDifferent(filtered[filtered.length - 1])
  return out
}

// ─── Shared SVG Sub-components ───────────────────────────────────────────────

interface FloorPlanProps {
  config: FloorConfig
  disaster: DisasterType
  selectedExit: string | null
  selectedRoom: string | null
  agentPos: Point
  phase: SimPhase
  blockedExits: Set<string>
  onExitClick: (e: string) => void
  selectedVias?: string[]
  onViaClick?: (label: string) => void
  // Active corridor node for neighbor choices
  activeNode?: string | null
  neighborOptions?: string[] | null
  onRequestNeighbors?: (label: string) => void
  onChooseNeighbor?: (label: string) => void
}

function ObstacleLayer({ obstacles }: { obstacles: ObstacleDef[] }) {
  return (
    <>
      {obstacles.map(obs => {
        if (obs.type === 'fire') return (
          <g key={obs.id}>
            <rect x={obs.x} y={obs.y} width={obs.w} height={obs.h}
              fill="url(#rg-fire)" rx="6">
              <animate attributeName="opacity" values="0.75;1;0.75" dur="1.4s" repeatCount="indefinite" />
            </rect>
            <text x={obs.x + obs.w / 2} y={obs.y + obs.h / 2 + 5}
              textAnchor="middle" fill="#ff8c00" fontSize="11"
              fontFamily="system-ui, sans-serif" fontWeight="700">
              {'\uD83D\uDD25'} {obs.label}
            </text>
          </g>
        )
        if (obs.type === 'smoke') return (
          <g key={obs.id}>
            <rect x={obs.x} y={obs.y} width={obs.w} height={obs.h}
              fill="url(#rg-smoke)" rx="4">
              <animate attributeName="opacity" values="0.5;0.85;0.5" dur="2.2s" repeatCount="indefinite" />
            </rect>
            <text x={obs.x + obs.w / 2} y={obs.y + obs.h / 2 + 4}
              textAnchor="middle" fill="#9ca3af" fontSize="10"
              fontFamily="system-ui, sans-serif">
              {'\u2601'} Smoke
            </text>
          </g>
        )
        if (obs.type === 'debris') return (
          <g key={obs.id}>
            <rect x={obs.x} y={obs.y} width={obs.w} height={obs.h}
              fill="#78350f" rx="3" />
            <rect x={obs.x} y={obs.y} width={obs.w} height={obs.h}
              fill="url(#hatch)" rx="3" />
            <text x={obs.x + obs.w / 2} y={obs.y + obs.h / 2 + 4}
              textAnchor="middle" fill="#fbbf24" fontSize="9.5"
              fontFamily="system-ui, sans-serif" fontWeight="700">
              {'\u26A0'} {obs.label}
            </text>
          </g>
        )
        return null
      })}
    </>
  )
}

function SimOverlay({ config, disaster, selectedExit, selectedRoom, agentPos, phase, blockedExits, onExitClick, selectedVias, onViaClick, activeNode, neighborOptions, onRequestNeighbors, onChooseNeighbor }: FloorPlanProps) {
  const obstacles = config.obstacles[disaster]
  const isPlanning = phase === 'planning'
  const showHazards = phase !== 'planning'
  const pathD = (points: Point[]) => points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')

  return (
    <>
      <defs>
        <radialGradient id="rg-fire" cx="50%" cy="60%">
          <stop offset="0%" stopColor="#ff4500" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#ff8c00" stopOpacity="0.35" />
        </radialGradient>
        <radialGradient id="rg-smoke">
          <stop offset="0%" stopColor="#6b7280" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#4b5563" stopOpacity="0.20" />
        </radialGradient>
        <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#92400e" strokeWidth="1.5" opacity="0.6" />
        </pattern>
      </defs>

      {/* Hazards only visible during simulation, not planning */}
      {showHazards && <ObstacleLayer obstacles={obstacles} />}

      {/* Planning phase: show ALL exit paths as clickable previews so user can plan */}
      {isPlanning && selectedRoom && Object.keys(config.primaryPaths).map(exitKey => {
        const fullPath = buildFullPath(config, selectedRoom, exitKey, selectedVias)
        const isSelected = selectedExit === exitKey
        const isBlocked = blockedExits.has(exitKey)
        if (isSelected) return null // drawn separately below with stronger style
        return (
          <g key={`preview-${exitKey}`}
            onClick={() => onExitClick(exitKey)}
            style={{ cursor: 'pointer' }}>
            {/* Invisible thick hitbox for easy clicking */}
            <path d={pathD(fullPath)} fill="none" stroke="transparent" strokeWidth="18" />
            {/* Visible dashed preview line */}
            <path d={pathD(fullPath)} fill="none"
              stroke={isBlocked ? '#ef444460' : '#4a608060'}
              strokeWidth="2" strokeDasharray="5 5" strokeLinecap="round" opacity="0.6"
            />
            {/* Exit label along path */}
            <text x={config.exits[exitKey].x} y={config.exits[exitKey].y - 20}
              textAnchor="middle" fill={isBlocked ? '#ef444488' : '#4a608088'}
              fontSize="9" fontFamily="system-ui, sans-serif" fontWeight="600">
              {exitKey} {isBlocked ? '(blocked)' : ''}
            </text>
          </g>
        )
      })}

      {/* Selected route — stronger highlight */}
      {selectedExit && isPlanning && config.primaryPaths[selectedExit] && (() => {
        const fullPath = buildFullPath(config, selectedRoom, selectedExit, selectedVias)
        return (
          <path
            d={pathD(fullPath)}
            fill="none"
            stroke={blockedExits.has(selectedExit) ? '#ef4444' : '#2db8b0'}
            strokeWidth="2.5" strokeDasharray="7 4" strokeLinecap="round" opacity="0.75"
          />
        )
      })()}

      {/* Exits */}
      {Object.keys(config.exits).map(key => {
        const ex = config.exits[key]
        const blocked = blockedExits.has(key)
        const selected = selectedExit === key
        const color = blocked ? '#ef4444' : '#22c55e'
        const isStair = key.startsWith('S')
        return (
          <g key={key}
            onClick={isPlanning ? () => onExitClick(key) : undefined}
            style={{ cursor: isPlanning ? 'pointer' : 'default' }}>
            {selected && (
              <circle cx={ex.x} cy={ex.y} r="22"
                fill="none" stroke={color} strokeWidth="1.5" opacity="0.3">
                <animate attributeName="r" values="18;24;18" dur="1.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.3;0.1;0.3" dur="1.5s" repeatCount="indefinite" />
              </circle>
            )}
            {isStair ? (
              <rect
                x={ex.x - (selected ? 15 : 11)} y={ex.y - (selected ? 15 : 11)}
                width={selected ? 30 : 22} height={selected ? 30 : 22} rx="5"
                fill={selected ? color : `${color}22`}
                stroke={color} strokeWidth={selected ? 2.5 : 1.8}
                style={{ transition: 'all 0.2s' }} />
            ) : (
              <circle cx={ex.x} cy={ex.y} r={selected ? 17 : 13}
                fill={selected ? color : `${color}22`}
                stroke={color} strokeWidth={selected ? 2.5 : 1.8}
                style={{ transition: 'all 0.2s' }} />
            )}
            <text x={ex.x} y={ex.y + 4}
              textAnchor="middle" fill={selected ? '#fff' : color}
              fontSize="10" fontFamily="system-ui, sans-serif" fontWeight="700">
              {key}
            </text>
            {blocked && (
              <>
                <line x1={ex.x - 8} y1={ex.y - 8} x2={ex.x + 8} y2={ex.y + 8}
                  stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
                <line x1={ex.x + 8} y1={ex.y - 8} x2={ex.x - 8} y2={ex.y + 8}
                  stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
              </>
            )}
          </g>
        )
      })}

      {/* Corridor nodes (clickable) */}
      {isPlanning && selectedRoom && config.corridorNodes && (
        <g>
          {config.corridorNodes.filter(n => !(n.x === 490 && n.y === 350)).map(node => {
            const index = selectedVias ? selectedVias.indexOf(node.label) : -1
            const selected = index !== -1
            const isActive = activeNode === node.label
            return (
              <g key={`node-${node.label}`} style={{ cursor: 'pointer' }}>
                <g onClick={() => onRequestNeighbors ? onRequestNeighbors(node.label) : onViaClick?.(node.label)}>
                  <circle cx={node.x} cy={node.y} r={selected ? 8 : 5}
                    fill={selected ? '#f59e0b' : '#334155'} stroke={selected ? '#fff' : '#1e2f46'} strokeWidth={1.5} />
                  {selected && (
                    <text x={node.x} y={node.y + 4} textAnchor="middle" fill="#fff" fontSize="8" fontFamily="system-ui, sans-serif" fontWeight={700}>{index + 1}</text>
                  )}
                  {!selected && (
                    <text x={node.x} y={node.y - 10} textAnchor="middle" fill="#64748b" fontSize="9" fontFamily="system-ui, sans-serif">{node.label}</text>
                  )}
                </g>
                {/* Neighbor choices overlay */}
                {isActive && neighborOptions && neighborOptions.length > 0 && (
                  <g>
                    {neighborOptions.map((nl, i) => {
                      const nnode = config.corridorNodes!.filter(n => !(n.x === 490 && n.y === 350)).find(n => n.label === nl)
                      if (!nnode) return null
                      // Place small rect directionally between node and neighbor
                      const mx = (node.x + nnode.x) / 2
                      const my = (node.y + nnode.y) / 2
                      return (
                        <g key={`choice-${nl}`} onClick={() => onChooseNeighbor && onChooseNeighbor(nl)} style={{ cursor: 'pointer' }}>
                          <rect x={mx - 28} y={my - 12} width={56} height={24} rx={6} fill="#ffffff" stroke="#c9dae6" />
                          <text x={mx} y={my + 5} textAnchor="middle" fill="#0f172a" fontSize="10" fontFamily="system-ui, sans-serif" fontWeight={700}>{nl}</text>
                        </g>
                      )
                    })}
                  </g>
                )}
              </g>
            )
          })}
        </g>
      )}

      {/* Agent */}
      {phase !== 'planning' && (
        <g>
          <circle cx={agentPos.x} cy={agentPos.y + 3} r="11" fill="#000" opacity="0.18" />
          <circle cx={agentPos.x} cy={agentPos.y} r="11" fill="#2db8b0" stroke="#fff" strokeWidth="2" />
          <circle cx={agentPos.x} cy={agentPos.y - 4} r="3.5" fill="#fff" />
          <path d={`M${agentPos.x - 5},${agentPos.y + 4} Q${agentPos.x},${agentPos.y + 9} ${agentPos.x + 5},${agentPos.y + 4}`}
            stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        </g>
      )}

      {/* Start marker — small dot only, no YOU label (room position may be out of bounds on floorplan) */}
      {phase === 'planning' && selectedRoom && (
        <g>
          <circle cx={agentPos.x} cy={agentPos.y} r="6"
            fill="#2db8b0" stroke="#fff" strokeWidth="1.5" opacity="0.9" />
        </g>
      )}

      {/* Exit labels */}
      {Object.keys(config.exits).map(key => {
        const ex = config.exits[key]
        const blocked = blockedExits.has(key)
        const lx = ex.x < 100 ? ex.x + 38 : ex.x > config.viewWidth - 100 ? ex.x - 38 : ex.x
        const ly = ex.y > config.viewHeight - 60 ? ex.y - 22 : ex.y + 28
        return (
          <text key={`lbl-${key}`} x={lx} y={ly}
            textAnchor="middle" fill={blocked ? '#ef444488' : '#22c55e88'}
            fontSize="9" fontFamily="system-ui, sans-serif">
            {ex.desc}
          </text>
        )
      })}
    </>
  )
}

// Stairwell visual helper
function StairwellSymbol({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const steps = Math.floor(w / 11)
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#0a1020" stroke="#2d3f5a" strokeWidth="1.2" rx="3" />
      {Array.from({ length: steps }, (_, i) => (
        <line key={i} x1={x + 5 + i * 11} y1={y + 4} x2={x + 5 + i * 11} y2={y + h - 4}
          stroke="#2d3f5a" strokeWidth="0.8" />
      ))}
      <text x={x + w / 2} y={y + h / 2 + 3} textAnchor="middle" fill="#4a6080" fontSize="7"
        fontFamily="system-ui, sans-serif">STAIRS</text>
    </g>
  )
}

// ─── Admin Building Floor Plan ───────────────────────────────────────────────
function AdminFloorPlan(props: FloorPlanProps) {
  const { config } = props
  const is2F = config.floorLabel === '2nd Floor'

  return (
    <svg viewBox={`0 0 ${config.viewWidth} ${config.viewHeight}`} preserveAspectRatio="xMidYMid meet"
      style={{ width: '100%', height: '100%', display: 'block' }}>

      <rect x="20" y="20" width="740" height="460" rx="6" fill="#131c2e" stroke="#2d3f5a" strokeWidth="2.5" />

      {/* Top rooms */}
      <rect x="20" y="20" width="228" height="210" fill="#18253a" stroke="#2d3f5a" strokeWidth="1.5" />
      <text x="134" y="118" textAnchor="middle" fill="#4a6080" fontSize="11" fontFamily="system-ui, sans-serif">
        {is2F ? 'Conference Room' : "Chancellor's"}
      </text>
      <text x="134" y="132" textAnchor="middle" fill="#4a6080" fontSize="11" fontFamily="system-ui, sans-serif">
        {is2F ? '' : 'Office'}
      </text>

      <rect x="248" y="20" width="284" height="210" fill="#1a2b42" stroke="#2d3f5a" strokeWidth="1.5" />
      <text x="390" y="122" textAnchor="middle" fill="#4a6080" fontSize="11" fontFamily="system-ui, sans-serif">
        {is2F ? 'Open Office' : 'Main Lobby'}
      </text>
      {!is2F && <text x="390" y="136" textAnchor="middle" fill="#3a5070" fontSize="9" fontFamily="system-ui, sans-serif">/ Reception</text>}

      <rect x="532" y="20" width="228" height="210" fill="#18253a" stroke="#2d3f5a" strokeWidth="1.5" />
      <text x="646" y="122" textAnchor="middle" fill="#4a6080" fontSize="11" fontFamily="system-ui, sans-serif">
        {is2F ? 'IT Office' : 'Registrar'}
      </text>

      {/* Main corridor */}
      <rect x="20" y="230" width="740" height="55" fill="#0f1824" stroke="#2d3f5a" strokeWidth="1.5" />
      <text x="390" y="261" textAnchor="middle" fill="#334e6a" fontSize="9.5"
        fontFamily="system-ui, sans-serif" letterSpacing="2">MAIN CORRIDOR</text>

      {/* Doorways */}
      <rect x="100" y="229" width="58" height="57" fill="#0f1824" />
      <rect x="310" y="229" width="160" height="57" fill="#0f1824" />
      <rect x="590" y="229" width="58" height="57" fill="#0f1824" />
      <rect x="100" y="228" width="58" height="4" fill="#2d3f5a" />
      <rect x="310" y="228" width="160" height="4" fill="#2d3f5a" />
      <rect x="590" y="228" width="58" height="4" fill="#2d3f5a" />

      {/* Bottom rooms */}
      <rect x="20" y="285" width="228" height="195" fill="#18253a" stroke="#2d3f5a" strokeWidth="1.5" />
      <text x="134" y="385" textAnchor="middle" fill="#4a6080" fontSize="11" fontFamily="system-ui, sans-serif">
        {is2F ? 'Storage' : 'Accounting'}
      </text>

      <rect x="248" y="285" width="284" height="195" fill="#1a2b42" stroke="#2d3f5a" strokeWidth="1.5" />
      <text x="390" y="385" textAnchor="middle" fill="#4a6080" fontSize="11" fontFamily="system-ui, sans-serif">
        {is2F ? 'Meeting Room' : 'Records Room'}
      </text>

      <rect x="532" y="285" width="228" height="195" fill="#18253a" stroke="#2d3f5a" strokeWidth="1.5" />
      <text x="646" y="385" textAnchor="middle" fill="#4a6080" fontSize="11" fontFamily="system-ui, sans-serif">
        {is2F ? 'Supply Room' : 'HR Dept'}
      </text>

      <rect x="100" y="283" width="58" height="4" fill="#2d3f5a" />
      <rect x="310" y="283" width="160" height="4" fill="#2d3f5a" />
      <rect x="590" y="283" width="58" height="4" fill="#2d3f5a" />

      {/* Exit wall gaps */}
      {!is2F && <rect x="350" y="478" width="80" height="4" fill="#131c2e" />}
      {!is2F && <rect x="18" y="232" width="4" height="51" fill="#131c2e" />}
      <rect x="758" y="92" width="4" height="42" fill="#131c2e" />

      {/* Stairwells for 2F */}
      {is2F && (
        <>
          <StairwellSymbol x={60} y={240} w={55} h={35} />
          <StairwellSymbol x={665} y={240} w={55} h={35} />
        </>
      )}

      {/* Floor label */}
      <text x="740" y="470" textAnchor="end" fill="#1e2f46" fontSize="11"
        fontFamily="system-ui, sans-serif" fontWeight="700" letterSpacing="0.05em">
        {config.floorLabel.toUpperCase()}
      </text>

      <SimOverlay {...props} />
    </svg>
  )
}

// ─── Science Building (CSB) Floor Plan ───────────────────────────────────────
// Uses actual SVG floor plan as background image with simulation overlay on top
function CSBFloorPlan(props: FloorPlanProps) {
  const { config } = props

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Actual floor plan SVG — untouched */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/floorplans/csb-2f.svg"
        alt="CSB Floor Plan"
        style={{ width: '100%', height: '100%', display: 'block', position: 'absolute', top: 0, left: 0, objectFit: 'contain', objectPosition: 'center' }}
      />
      {/* Simulation overlay — exits, agent, routes, obstacles */}
      <svg
        viewBox={`0 0 ${config.viewWidth} ${config.viewHeight}`} preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: '100%', display: 'block', position: 'absolute', top: 0, left: 0 }}
      >
        <SimOverlay {...props} />
      </svg>
    </div>
  )
}

// ── Floor plan selector ──
function FloorPlanView(props: FloorPlanProps & { buildingId: string }) {
  const { buildingId, ...rest } = props
  if (buildingId === 'admin-building') return <AdminFloorPlan {...rest} />
  if (buildingId === 'science-building') return <CSBFloorPlan {...rest} />
  // All other buildings use CSB floor plan as placeholder
  return <CSBFloorPlan {...rest} />
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const DISASTER_META: Record<string, { label: string; color: string }> = {
  fire:       { label: 'Fire Simulation',       color: '#ff6b35' },
  earthquake: { label: 'Earthquake Simulation', color: '#f59e0b' },
}

export default function SimulationRunPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const params  = useParams()
  const search  = useSearchParams()

  const regionId = params.id as string
  const disaster = (search.get('disaster') || 'fire') as DisasterType
  const initialFloor = parseInt(search.get('floor') || '0', 10)
  const meta     = DISASTER_META[disaster] || DISASTER_META.fire

  const floors    = useMemo(() => getFloorConfigs(regionId), [regionId])
  const hasFloors = floors.length > 0

  const [floorIdx,      setFloorIdx]      = useState(Math.min(initialFloor, Math.max(floors.length - 1, 0)))
  const [phase,         setPhase]         = useState<SimPhase>('planning')
  const [selectedRoom,  setSelectedRoom]  = useState<string | null>(null)
  const [routeMode,     setRouteMode]     = useState<RouteMode>(null)
  const [selectedExit,  setSelectedExit]  = useState<string | null>(null)
  const [selectedVias,  setSelectedVias]   = useState<string[]>([])
  const [activeNode,    setActiveNode]     = useState<string | null>(null)
  const [neighborOptions, setNeighborOptions] = useState<string[] | null>(null)
  const [agentPos,      setAgentPos]      = useState<Point>({ x: 0, y: 0 })
  const [metrics,       setMetrics]       = useState<SimMetrics | null>(null)
  const [events,        setEvents]        = useState<SimEvent[]>([])
  const [elapsedSec,    setElapsedSec]    = useState(0)

  const animRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const phase2Ref = useRef<SimPhase>('planning')

  const config = hasFloors ? floors[floorIdx] : null

  useEffect(() => {
    if (!config) return
    if (selectedRoom && config.rooms[selectedRoom]) {
      const room = config.rooms[selectedRoom]
      setAgentPos({ x: room.x, y: room.y })
    } else {
      // Do not default to corridor/startPos — require user to select a room.
      // Reset position to origin (off-map) so no implicit starting point is used.
      setAgentPos({ x: 0, y: 0 })
    }
  }, [config, selectedRoom])
  useEffect(() => { if (!isLoading && !isAuthenticated) window.location.href = '/auth' }, [isLoading, isAuthenticated])
  useEffect(() => { phase2Ref.current = phase }, [phase])
  useEffect(() => () => { if (animRef.current) clearInterval(animRef.current) }, [])

  // Clear any selected corridor via nodes when the room is cleared
  useEffect(() => {
    if (!selectedRoom) setSelectedVias([])
    // clear active node when room changes
    setActiveNode(null)
    setNeighborOptions(null)
  }, [selectedRoom])

  const blockedExits = config
    ? new Set(config.obstacles[disaster].flatMap(o => o.blocksExits))
    : new Set<string>()

  const routes = config ? analyzeRoutes(config, selectedRoom, disaster, blockedExits) : []
  const fastestExit = routes.length > 0 ? getRecommendedExit(routes, 'fastest') : null
  const safestExit = routes.length > 0 ? getRecommendedExit(routes, 'safest') : null
  const fastestRoute = routes.find(r => r.exitKey === fastestExit)
  const safestRoute = routes.find(r => r.exitKey === safestExit)

  const pushEvent = useCallback((message: string, type: SimEvent['type'] = 'info') => {
    setEvents(prev => [...prev, { time: Date.now(), message, type }])
  }, [])

  const requestNeighbors = (label: string) => {
    if (!config || !config.corridorNodes) return
    const node = config.corridorNodes.find(n => n.label === label)
    if (!node) return
    // find two nearest other nodes, ignoring forbidden coordinate
    const others = config.corridorNodes.filter(n => n.label !== label && !(n.x === 490 && n.y === 350))
    others.sort((a, b) => Math.hypot(a.x - node.x, a.y - node.y) - Math.hypot(b.x - node.x, b.y - node.y))
    const options = others.slice(0, 2).map(n => n.label)
    setActiveNode(label)
    setNeighborOptions(options)
  }

  const chooseNeighbor = (label: string) => {
    // append neighbor to selected vias preserving order
    setSelectedVias(prev => prev.includes(label) ? prev : [...prev, label])
    setActiveNode(null)
    setNeighborOptions(null)
  }

  const finishSimulation = useCallback((chosen: string, actual: string, rerouted: boolean, time: number) => {
    if (!config) return
    setPhase('completed')
    phase2Ref.current = 'completed'

    const hazardExposure = config.obstacles[disaster].some(obs =>
      obs.type !== 'debris' && obs.blocksExits.includes(chosen)
    )
    const congestion: SimMetrics['congestionLevel'] = rerouted ? 'High' : 'Medium'

    setMetrics({
      evacuationTime: parseFloat(time.toFixed(1)),
      rerouted,
      reroutedFrom: rerouted ? chosen : undefined,
      reroutedTo: rerouted ? actual : undefined,
      hazardExposure,
      pathEfficiency: rerouted ? 0.58 : (config.efficiency[chosen] || 0.80),
      exitChoice: chosen,
      actualExit: actual,
      congestionLevel: congestion,
    })

    pushEvent(
      rerouted
        ? `Evacuated via ${actual} after reroute \u2014 ${time.toFixed(1)}s total`
        : `Successfully evacuated via ${actual} in ${time.toFixed(1)}s`,
      'info'
    )
  }, [config, disaster, pushEvent])

  const startSimulation = useCallback(() => {
    if (!selectedExit || !config) return
    setPhase('running')
    setEvents([])

    const primaryPath     = buildFullPath(config, selectedRoom, selectedExit, selectedVias)
    const isBlocked       = blockedExits.has(selectedExit)
    const totalPrimary    = pathLength(primaryPath)
    const SPEED           = 80

    // Adjust blockT to account for room prefix — original blockT was calibrated
    // for corridor-to-exit only, so we need to rescale for the full path
    const exitPathLen     = pathLength(config.primaryPaths[selectedExit])
    const roomPrefixLen   = totalPrimary - exitPathLen
    const originalBlockT  = config.blockT[selectedExit] || 1
    const blockT          = totalPrimary > 0
      ? (roomPrefixLen + originalBlockT * exitPathLen) / totalPrimary
      : originalBlockT

    const primaryDuration = isBlocked
      ? (totalPrimary * blockT / SPEED) * 1000
      : (totalPrimary / SPEED) * 1000

    let hasRerouted = false
    const TICK = 50
    let elapsed = 0
    setElapsedSec(0)

    pushEvent(`Evacuation started \u2014 heading to ${selectedExit}`, 'info')
    if (isBlocked) {
      const obs = config.obstacles[disaster].find(o => o.blocksExits.includes(selectedExit))
      pushEvent(`${obs?.type === 'fire' ? 'Fire/smoke' : 'Debris'} detected ahead`, 'warn')
    }

    animRef.current = setInterval(() => {
      elapsed += TICK
      setElapsedSec(Math.floor(elapsed / 1000))

      if (phase2Ref.current !== 'running') return

      const t = Math.min(elapsed / primaryDuration, isBlocked ? blockT : 1)
      setAgentPos(interpolatePath(primaryPath, t))

      if (isBlocked && t >= blockT && !hasRerouted) {
        hasRerouted = true
        setPhase('rerouting')
        phase2Ref.current = 'rerouting'

        const reroute = config.reroutes[selectedExit]
        pushEvent(`Route to ${selectedExit} is BLOCKED \u2014 rerouting to ${reroute.to}`, 'danger')

        setTimeout(() => {
          const reroutePath  = reroute.path
          const rerouteDur   = (pathLength(reroutePath) / SPEED) * 1000
          let rerouteElapsed = 0

          pushEvent(`Now heading to ${reroute.to}`, 'info')
          setPhase('running')
          phase2Ref.current = 'running'

          if (animRef.current) clearInterval(animRef.current)
          animRef.current = setInterval(() => {
            rerouteElapsed += TICK
            elapsed += TICK
            setElapsedSec(Math.floor(elapsed / 1000))

            const rt = Math.min(rerouteElapsed / rerouteDur, 1)
            setAgentPos(interpolatePath(reroutePath, rt))

            if (rt >= 1) {
              if (animRef.current) clearInterval(animRef.current)
              finishSimulation(selectedExit, reroute.to, true, elapsed / 1000)
            }
          }, TICK)
        }, 1800)
      }

      if (!isBlocked && t >= 1) {
        if (animRef.current) clearInterval(animRef.current)
        finishSimulation(selectedExit, selectedExit, false, elapsed / 1000)
      }
    }, TICK)
  }, [selectedExit, selectedRoom, config, disaster, blockedExits, pushEvent, finishSimulation])

  const reset = () => {
    if (animRef.current) clearInterval(animRef.current)
    setPhase('planning')
    setSelectedExit(null)
    setRouteMode(null)
    if (config) {
      if (selectedRoom && config.rooms[selectedRoom]) {
        const room = config.rooms[selectedRoom]
        setAgentPos({ x: room.x, y: room.y })
      } else {
        setAgentPos(config.startPos)
      }
    }
    setMetrics(null)
    setEvents([])
    setElapsedSec(0)
  }

  // Undo last planning action: removes last via, or clears manual exit/routeMode if none
  const undoLast = () => {
    if (selectedVias.length > 0) {
      setSelectedVias(prev => prev.slice(0, -1))
      return
    }
    if (selectedExit && routeMode === null) {
      setSelectedExit(null)
      return
    }
    if (routeMode) {
      setRouteMode(null)
      setSelectedExit(null)
      return
    }
  }

  // Reset planning selections but keep chosen room (helps iterate on routes quickly)
  const resetPlan = () => {
    setSelectedVias([])
    setSelectedExit(null)
    setRouteMode(null)
    setMetrics(null)
    setEvents([])
    setElapsedSec(0)
    if (config) {
      if (selectedRoom && config.rooms[selectedRoom]) {
        const room = config.rooms[selectedRoom]
        setAgentPos({ x: room.x, y: room.y })
      } else {
        setAgentPos({ x: 0, y: 0 })
      }
    }
  }

  const switchFloor = (idx: number) => {
    if (idx === floorIdx) return
    reset()
    setSelectedRoom(null)
    setSelectedVias([])
    setFloorIdx(idx)
  }

  if (isLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading...</div>
    </div>
  )

  const displayName = regionId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  if (!hasFloors) return (
    <div style={{ minHeight: '100vh', padding: '88px 40px 56px', maxWidth: '1280px', margin: '0 auto' }}>
      <button onClick={() => router.push(`/simulate/${encodeURIComponent(regionId)}/disaster`)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', padding: 0, marginBottom: '28px' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        Change disaster type
      </button>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', gap: '16px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #c9dae6', padding: '18px', boxShadow: '0 1px 0 rgba(0,0,0,0.02), 0 6px 18px rgba(15,23,42,0.04)' }}>
        <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{displayName}</div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Floor plan for this building is coming soon.</div>
      </div>
    </div>
  )

  // Feedback
  const feedbackLines: string[] = []
  if (metrics) {
    if (metrics.rerouted) {
      feedbackLines.push(`You chose ${metrics.exitChoice} but it was blocked by ${disaster === 'fire' ? 'fire/smoke' : 'debris'}.`)
      feedbackLines.push(`The simulation rerouted you to ${metrics.reroutedTo}, adding significant delay.`)
    } else if (metrics.exitChoice.startsWith('S')) {
      feedbackLines.push(`You chose stairwell ${metrics.exitChoice} \u2014 the route was clear.`)
    } else {
      feedbackLines.push(`You chose exit ${metrics.exitChoice} \u2014 a direct route for this scenario.`)
    }
    if (metrics.hazardExposure) feedbackLines.push('Your initial route passed through a hazard zone \u2014 awareness of obstacle positions is critical.')
    if (metrics.pathEfficiency >= 0.9) feedbackLines.push('Route efficiency: Excellent. You took near-optimal path given conditions.')
    else if (metrics.pathEfficiency >= 0.7) feedbackLines.push('Route efficiency: Good. A better exit choice could reduce your time by ~20%.')
    else feedbackLines.push('Route efficiency: Poor. Review the floor plan and obstacle positions before the next drill.')
  }

  const congestionColor = (level: SimMetrics['congestionLevel']) =>
    level === 'High' ? '#ef4444' : level === 'Medium' ? '#f59e0b' : '#22c55e'

  return (
    <div style={{ minHeight: '100vh', padding: '80px 32px 48px', maxWidth: '1600px', margin: '0 auto' }}>

      <button
        onClick={() => router.push(`/simulate/${encodeURIComponent(regionId)}/disaster`)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', padding: 0, marginBottom: '24px', transition: 'color 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        Change disaster type
      </button>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: `${meta.color}12`, border: `1px solid ${meta.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={meta.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {disaster === 'fire'
              ? <><path d="M12 2c.5 2.5 2 4.5 2 7a4 4 0 1 1-8 0c0-2.5 2-4.5 2-7 1.5 1.5 2.5 3 4 0z" /><path d="M12 12c.5 1 1 2 1 3a2 2 0 1 1-4 0c0-1 .5-2 1-3 .5.5 1 1 2 0z" /></>
              : <path d="M2 12h4l2-5 3 10 3-10 2 5h4" />}
          </svg>
        </div>
        <div>
          <h1 style={{ margin: '0 0 3px', fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{meta.label}</h1>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
            {displayName} {'\u00B7'} {config?.floorLabel}
          </p>
        </div>

        {/* Floor picker */}
        {floors.length > 1 && (
          <div style={{ display: 'flex', gap: '4px', marginLeft: '12px', background: '#f1f5f9', borderRadius: '10px', padding: '3px', border: '1px solid #c9dae6' }}>
            {floors.map((f, i) => (
              <button key={i} onClick={() => switchFloor(i)} disabled={phase !== 'planning'}
                style={{
                  padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                  border: floorIdx === i ? '1px solid rgba(0,0,0,0.06)' : '1px solid transparent', cursor: phase !== 'planning' ? 'not-allowed' : 'pointer',
                  background: floorIdx === i ? '#2db8b0' : '#f1f5f9',
                  color: floorIdx === i ? '#fff' : '#0f172a',
                  transition: 'all 0.15s',
                  opacity: phase !== 'planning' && floorIdx !== i ? 0.4 : 1,
                }}>
                {f.floorLabel}
              </button>
            ))}
          </div>
        )}

        <div style={{ marginLeft: 'auto', padding: '5px 14px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', background: phase === 'planning' ? '#2db8b015' : phase === 'completed' ? '#22c55e15' : `${meta.color}15`, color: phase === 'planning' ? '#2db8b0' : phase === 'completed' ? '#22c55e' : meta.color, border: `1px solid ${phase === 'planning' ? '#2db8b030' : phase === 'completed' ? '#22c55e30' : `${meta.color}30`}` }}>
          {phase === 'planning' ? 'Planning' : phase === 'rerouting' ? 'Rerouting\u2026' : phase === 'running' ? `Running \u00B7 ${elapsedSec}s` : 'Completed'}
        </div>
      </div>

      {/* Main layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '28px', alignItems: 'start' }}>

        <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e6edf2', overflow: 'hidden', aspectRatio: `${config!.viewWidth}/${config!.viewHeight}`, boxShadow: '0 6px 20px rgba(15,23,42,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FloorPlanView
            buildingId={regionId} config={config!} disaster={disaster}
            selectedExit={selectedExit} selectedRoom={selectedRoom}
            selectedVias={selectedVias}
            agentPos={agentPos} phase={phase}
            blockedExits={blockedExits}
            onExitClick={key => phase === 'planning' && setSelectedExit(key)}
            onViaClick={label => phase === 'planning' && setSelectedVias(prev => {
              // If already included, remove it (toggle off). Otherwise append to preserve order clicked.
              if (prev.includes(label)) return prev.filter(l => l !== label)
              return [...prev, label]
            })}
            activeNode={activeNode} neighborOptions={neighborOptions}
            onRequestNeighbors={label => phase === 'planning' && requestNeighbors(label)}
            onChooseNeighbor={label => phase === 'planning' && chooseNeighbor(label)}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {phase === 'planning' && config && (
            <>
              {/* Step 1: Room Selection */}
              <div style={{ background: '#f8fafc', border: '1px solid #c9dae6', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 0 rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: selectedRoom ? '#2db8b0' : '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: selectedRoom ? '#fff' : '#64748b', flexShrink: 0 }}>1</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Where Are You?</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  {Object.entries(config.rooms).filter(([key]) => key !== 'corridor').map(([key, room]) => (
                    <button key={key} onClick={() => { setSelectedRoom(key); setSelectedExit(null); setRouteMode(null); setSelectedVias([]) }}
                      style={{
                        padding: '8px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 600,
                        background: selectedRoom === key ? '#2db8b015' : '#f1f5f9',
                        border: `1.5px solid ${selectedRoom === key ? '#2db8b0' : '#c9dae6'}`,
                        color: selectedRoom === key ? '#2db8b0' : '#0f172a',
                        cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                      }}>
                      {room.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 2: Route Strategy */}
              {selectedRoom && (
                <div style={{ background: '#f8fafc', border: '1px solid #c9dae6', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 0 rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: routeMode ? '#2db8b0' : '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: routeMode ? '#fff' : '#64748b', flexShrink: 0 }}>2</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Choose Route</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* Safest Route */}
                    <button
                      onClick={() => { setRouteMode('safest'); setSelectedExit(safestExit) }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '12px 14px', borderRadius: '10px',
                        background: routeMode === 'safest' ? '#22c55e10' : '#f1f5f9',
                        border: `1.5px solid ${routeMode === 'safest' ? '#22c55e' : '#c9dae6'}`,
                        cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                      }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#22c55e15', border: '1px solid #22c55e30', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                        </svg>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>Safest Route</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          Exit {safestExit} {'\u00B7'} {safestRoute ? `~${safestRoute.estimatedTime}s` : ''} {'\u00B7'} Avoids hazards
                        </div>
                      </div>
                      {routeMode === 'safest' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                    </button>

                    {/* Fastest Route */}
                    <button
                      onClick={() => { setRouteMode('fastest'); setSelectedExit(fastestExit) }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '12px 14px', borderRadius: '10px',
                        background: routeMode === 'fastest' ? '#3b82f610' : '#f1f5f9',
                        border: `1.5px solid ${routeMode === 'fastest' ? '#3b82f6' : '#c9dae6'}`,
                        cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                      }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#3b82f615', border: '1px solid #3b82f630', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                        </svg>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>Fastest Route</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          Exit {fastestExit} {'\u00B7'} {fastestRoute ? `~${fastestRoute.estimatedTime}s` : ''} {'\u00B7'} Shortest path
                          {fastestRoute?.isBlocked ? ' \u00B7 May be blocked' : ''}
                        </div>
                      </div>
                      {routeMode === 'fastest' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                    </button>

                    {/* Manual exit selection */}
                    <div style={{ marginTop: '4px' }}>
                      <div style={{ fontSize: '10px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Or choose exit manually</div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {Object.keys(config.exits).map(key => {
                          const blocked = blockedExits.has(key)
                          const selected = selectedExit === key && routeMode === null
                          const color = blocked ? '#ef4444' : '#64748b'
                          return (
                            <button key={key} onClick={() => { setRouteMode(null); setSelectedExit(key) }}
                              style={{
                                padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                                background: selected ? `${color}15` : '#f1f5f9',
                                border: `1.5px solid ${selected ? color : '#c9dae6'}`,
                                color: selected ? (blocked ? '#ef4444' : 'var(--text-primary)') : '#0f172a',
                                cursor: 'pointer', transition: 'all 0.15s',
                              }}>
                              {key} {'\u00B7'} {config.exits[key].desc.split('\u00B7')[0].trim()}
                              {blocked && ' (blocked)'}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Disaster Alert */}
              <div style={{ background: `${meta.color}08`, border: `1px solid ${meta.color}20`, borderRadius: '10px', padding: '12px 14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: meta.color, marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {disaster === 'fire' ? 'Active Fire' : 'Earthquake Alert'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                  {disaster === 'fire'
                    ? 'Fire detected in the building. Smoke may be spreading \u2014 exits near the fire source may be hazardous.'
                    : 'Structural damage reported. Debris may block corridors and stairwells. Assess your exit options carefully.'}
                </div>
              </div>

              {/* Start button */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
                  <button onClick={undoLast} disabled={selectedVias.length === 0 && !selectedExit && !routeMode}
                    style={{ padding: '10px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, background: selectedVias.length === 0 && !selectedExit && !routeMode ? '#f1f5f9' : '#ffffff', border: '1px solid #c9dae6', color: selectedVias.length === 0 && !selectedExit && !routeMode ? '#94a3b8' : '#0f172a', cursor: selectedVias.length === 0 && !selectedExit && !routeMode ? 'not-allowed' : 'pointer' }}>
                    Undo
                  </button>
                  <button onClick={resetPlan}
                    style={{ padding: '10px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, background: '#ffffff', border: '1px solid #c9dae6', color: '#0f172a', cursor: 'pointer' }}>
                    Reset Plan
                  </button>
                </div>
                <div style={{ flex: '0 0 auto' }}>
                  <button onClick={startSimulation} disabled={!selectedExit || !selectedRoom}
                    style={{
                      padding: '13px', borderRadius: '10px', fontSize: '13px', fontWeight: 700,
                      background: selectedExit && selectedRoom ? '#2db8b0' : '#f1f5f9',
                      color: selectedExit && selectedRoom ? '#fff' : '#94a3b8',
                      border: selectedExit && selectedRoom ? 'none' : '1px solid #c9dae6', cursor: selectedExit && selectedRoom ? 'pointer' : 'not-allowed', transition: 'all 0.15s',
                      boxShadow: selectedExit && selectedRoom ? '0 4px 16px rgba(45,184,176,0.3)' : 'none',
                    }}>
                    {!selectedRoom ? 'Select your location first' : !selectedExit ? 'Choose a route' : `Start Simulation \u2192 ${selectedExit}`}
                  </button>
                </div>
              </div>
            </>
          )}

          {(phase === 'running' || phase === 'rerouting') && (
            <>
              <div style={{ background: '#f8fafc', border: '1px solid #c9dae6', borderRadius: '12px', padding: '18px', boxShadow: '0 1px 0 rgba(0,0,0,0.02)' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '14px' }}>Live Metrics</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {[
                    { label: 'Elapsed', value: `${elapsedSec}s` },
                    { label: 'Target', value: selectedExit ?? '\u2014' },
                    { label: 'Status', value: phase === 'rerouting' ? 'Rerouting' : 'Moving', color: phase === 'rerouting' ? '#f59e0b' : '#2db8b0' },
                    { label: 'Floor', value: config?.floorLabel || '1F' },
                  ].map(m => (
                    <div key={m.label} style={{ background: '#ffffff', border: '1px solid #e6edf2', borderRadius: '8px', padding: '10px 12px' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.label}</div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: (m as { color?: string }).color ?? 'var(--text-primary)' }}>{m.value}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: '#f8fafc', border: '1px solid #c9dae6', borderRadius: '12px', padding: '14px', maxHeight: '180px', overflowY: 'auto', boxShadow: '0 1px 0 rgba(0,0,0,0.02)' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Event Log</div>
                {events.length === 0 && <div style={{ fontSize: '12px', color: '#334155' }}>No events yet{'\u2026'}</div>}
                {events.map((ev, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'flex-start' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', marginTop: '4px', flexShrink: 0, background: ev.type === 'danger' ? '#ef4444' : ev.type === 'warn' ? '#f59e0b' : '#2db8b0' }} />
                    <div style={{ fontSize: '11px', color: ev.type === 'danger' ? '#ef4444' : ev.type === 'warn' ? '#f59e0b' : 'var(--text-secondary)', lineHeight: 1.4 }}>{ev.message}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {phase === 'completed' && metrics && (
            <>
              {/* Result Summary */}
              <div style={{ background: '#f8fafc', border: '1px solid #c9dae6', borderRadius: '12px', padding: '18px', boxShadow: '0 1px 0 rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#22c55e18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#22c55e' }}>Drill Complete</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {selectedRoom && config?.rooms[selectedRoom] ? `From ${config.rooms[selectedRoom].label}` : 'Evacuation finished'}
                    </div>
                  </div>
                </div>

                {/* Key metric */}
                <div style={{ background: '#ffffff', border: '1px solid #e6edf2', borderRadius: '10px', padding: '14px', marginBottom: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '32px', fontWeight: 800, color: metrics.evacuationTime > 20 ? '#ef4444' : '#22c55e', lineHeight: 1 }}>{metrics.evacuationTime}s</div>
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Evacuation Time</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                  {[
                    { label: 'Exit', value: metrics.actualExit, color: '#2db8b0' },
                    { label: 'Rerouted', value: metrics.rerouted ? 'Yes' : 'No', color: metrics.rerouted ? '#f59e0b' : '#22c55e' },
                    { label: 'Efficiency', value: `${Math.round(metrics.pathEfficiency * 100)}%`, color: metrics.pathEfficiency >= 0.85 ? '#22c55e' : '#f59e0b' },
                  ].map(m => (
                    <div key={m.label} style={{ background: '#ffffff', border: '1px solid #e6edf2', borderRadius: '8px', padding: '8px 10px', textAlign: 'center' }}>
                      <div style={{ fontSize: '9px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>{m.label}</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: m.color }}>{m.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Detailed metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <div style={{ background: '#ffffff', border: '1px solid #c9dae6', borderRadius: '8px', padding: '10px 12px', boxShadow: '0 1px 0 rgba(0,0,0,0.02)' }}>
                  <div style={{ fontSize: '9px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>Congestion</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: congestionColor(metrics.congestionLevel) }}>{metrics.congestionLevel}</div>
                </div>
                <div style={{ background: '#ffffff', border: '1px solid #c9dae6', borderRadius: '8px', padding: '10px 12px', boxShadow: '0 1px 0 rgba(0,0,0,0.02)' }}>
                  <div style={{ fontSize: '9px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>Hazard Exposure</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: metrics.hazardExposure ? '#ef4444' : '#22c55e' }}>{metrics.hazardExposure ? 'Exposed' : 'None'}</div>
                </div>
              </div>

              {/* Evaluator */}
              <div style={{ background: '#f8fafc', border: '1px solid #e6edf2', borderRadius: '10px', padding: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Drill Evaluator</div>
                {feedbackLines.map((line, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'flex-start' }}>
                    <div style={{ width: '5px', height: '5px', borderRadius: '50%', marginTop: '5px', flexShrink: 0, background: '#2db8b0' }} />
                    <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{line}</div>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button onClick={reset}
                  style={{ padding: '11px', borderRadius: '10px', fontSize: '12px', fontWeight: 600, background: '#f8fafc', border: '1px solid #e6edf2', color: 'var(--text-primary)', cursor: 'pointer', transition: 'all 0.15s' }}>
                  Run Again
                </button>
                <button onClick={() => router.push('/simulate')}
                  style={{ padding: '11px', borderRadius: '10px', fontSize: '12px', fontWeight: 600, background: '#2db8b0', border: 'none', color: '#fff', cursor: 'pointer', transition: 'all 0.15s', boxShadow: '0 2px 12px rgba(45,184,176,0.3)' }}>
                  Back to Map
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
