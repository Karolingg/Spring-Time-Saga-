'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/src/hooks/useAuth'

// ─── Types ────────────────────────────────────────────────────────────────────
type SimPhase = 'planning' | 'running' | 'rerouting' | 'completed'
type DisasterType = 'fire' | 'earthquake'

interface Point { x: number; y: number }

interface ExitDef {
  x: number; y: number; label: string; desc: string
}

interface ObstacleDef {
  id: string
  x: number; y: number; w: number; h: number
  type: 'fire' | 'smoke' | 'debris'
  label: string
  blocksExits: string[]
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
}

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
}

// ─── Science Building (CSB) Configs ─────────────────────────────────────────
// Layout: Left rooms — Vertical corridor — Horizontal hallway — Right labs/lecture
// Agent paths route through corridor/hallway doors, never through walls

const CSB_1F: FloorConfig = {
  viewWidth: 900, viewHeight: 600,
  floorLabel: '1st Floor',
  exits: {
    E1: { x: 258, y: 590, label: 'E1', desc: 'South Exit \u00B7 Main' },
    E2: { x: 888, y: 280, label: 'E2', desc: 'East Exit \u00B7 Side' },
    S1: { x: 165, y: 565, label: 'S1', desc: 'SW Stairwell \u00B7 Up' },
    S2: { x: 545, y: 565, label: 'S2', desc: 'SE Stairwell \u00B7 Up' },
  },
  startPos: { x: 258, y: 280 },
  primaryPaths: {
    // corridor south to main exit
    E1: [{ x: 258, y: 280 },{ x: 258, y: 380 },{ x: 258, y: 480 },{ x: 258, y: 590 }],
    // corridor → hallway east → east exit
    E2: [{ x: 258, y: 280 },{ x: 322, y: 280 },{ x: 500, y: 280 },{ x: 710, y: 280 },{ x: 888, y: 280 }],
    // corridor south → SW stair
    S1: [{ x: 258, y: 280 },{ x: 258, y: 380 },{ x: 258, y: 500 },{ x: 200, y: 540 },{ x: 165, y: 565 }],
    // corridor → hallway → SE stair
    S2: [{ x: 258, y: 280 },{ x: 322, y: 280 },{ x: 500, y: 280 },{ x: 545, y: 400 },{ x: 545, y: 500 },{ x: 545, y: 565 }],
  },
  reroutes: {
    E1: { to: 'E2', path: [{ x: 258, y: 380 },{ x: 258, y: 280 },{ x: 322, y: 280 },{ x: 500, y: 280 },{ x: 710, y: 280 },{ x: 888, y: 280 }] },
    E2: { to: 'E1', path: [{ x: 500, y: 280 },{ x: 322, y: 280 },{ x: 258, y: 280 },{ x: 258, y: 480 },{ x: 258, y: 590 }] },
    S1: { to: 'E1', path: [{ x: 200, y: 540 },{ x: 258, y: 500 },{ x: 258, y: 590 }] },
    S2: { to: 'E2', path: [{ x: 545, y: 400 },{ x: 545, y: 280 },{ x: 710, y: 280 },{ x: 888, y: 280 }] },
  },
  blockT: { E1: 0.50, E2: 0.55, S1: 0.55, S2: 0.55 },
  obstacles: {
    fire: [
      { id: 'fire-lab', x: 530, y: 35, w: 180, h: 150, type: 'fire', label: 'Lab Fire', blocksExits: [] },
      { id: 'smoke-corridor-s', x: 215, y: 440, w: 90, h: 60, type: 'smoke', label: 'Smoke', blocksExits: ['E1'] },
    ],
    earthquake: [
      { id: 'debris-corridor-s', x: 220, y: 430, w: 80, h: 50, type: 'debris', label: 'Debris', blocksExits: ['E1'] },
      { id: 'debris-hallway-e', x: 680, y: 255, w: 100, h: 50, type: 'debris', label: 'Debris', blocksExits: ['E2'] },
    ],
  },
  efficiency: { E1: 0.95, E2: 0.82, S1: 0.78, S2: 0.72 },
}

const CSB_2F: FloorConfig = {
  viewWidth: 900, viewHeight: 600,
  floorLabel: '2nd Floor',
  exits: {
    S1: { x: 165, y: 565, label: 'S1', desc: 'SW Stairwell \u00B7 Down' },
    S2: { x: 545, y: 565, label: 'S2', desc: 'SE Stairwell \u00B7 Down' },
    E3: { x: 888, y: 120, label: 'E3', desc: 'Fire Escape \u00B7 East' },
  },
  startPos: { x: 258, y: 280 },
  primaryPaths: {
    S1: [{ x: 258, y: 280 },{ x: 258, y: 380 },{ x: 258, y: 500 },{ x: 200, y: 540 },{ x: 165, y: 565 }],
    S2: [{ x: 258, y: 280 },{ x: 322, y: 280 },{ x: 500, y: 280 },{ x: 545, y: 400 },{ x: 545, y: 500 },{ x: 545, y: 565 }],
    E3: [{ x: 258, y: 280 },{ x: 322, y: 280 },{ x: 500, y: 280 },{ x: 700, y: 200 },{ x: 800, y: 140 },{ x: 888, y: 120 }],
  },
  reroutes: {
    S1: { to: 'S2', path: [{ x: 200, y: 540 },{ x: 258, y: 500 },{ x: 258, y: 280 },{ x: 322, y: 280 },{ x: 500, y: 280 },{ x: 545, y: 400 },{ x: 545, y: 565 }] },
    S2: { to: 'S1', path: [{ x: 545, y: 400 },{ x: 500, y: 280 },{ x: 322, y: 280 },{ x: 258, y: 280 },{ x: 258, y: 500 },{ x: 200, y: 540 },{ x: 165, y: 565 }] },
    E3: { to: 'S1', path: [{ x: 700, y: 200 },{ x: 500, y: 280 },{ x: 322, y: 280 },{ x: 258, y: 280 },{ x: 258, y: 500 },{ x: 165, y: 565 }] },
  },
  blockT: { S1: 0.50, S2: 0.50, E3: 0.45 },
  obstacles: {
    fire: [
      { id: 'fire-chem-lab', x: 530, y: 35, w: 190, h: 155, type: 'fire', label: 'Lab Fire', blocksExits: ['E3'] },
      { id: 'smoke-hallway', x: 600, y: 190, w: 100, h: 50, type: 'smoke', label: 'Smoke', blocksExits: ['E3'] },
    ],
    earthquake: [
      { id: 'debris-sw-stair', x: 135, y: 530, w: 65, h: 55, type: 'debris', label: 'Debris', blocksExits: ['S1'] },
      { id: 'debris-ceiling', x: 350, y: 250, w: 120, h: 40, type: 'debris', label: 'Structural Damage', blocksExits: [] },
    ],
  },
  efficiency: { S1: 0.90, S2: 0.85, E3: 0.72 },
}

// ─── Building → Floor Configs ────────────────────────────────────────────────
const BUILDING_FLOORS: Record<string, FloorConfig[]> = {
  'admin-building':   [ADMIN_1F, ADMIN_2F],
  'science-building': [CSB_1F, CSB_2F],
}

function getFloorConfigs(buildingId: string): FloorConfig[] {
  return BUILDING_FLOORS[buildingId] || []
}

// ─── Path Math ───────────────────────────────────────────────────────────────
function pathLength(path: Point[]): number {
  let len = 0
  for (let i = 1; i < path.length; i++) {
    const dx = path[i].x - path[i - 1].x
    const dy = path[i].y - path[i - 1].y
    len += Math.sqrt(dx * dx + dy * dy)
  }
  return len
}

function interpolatePath(path: Point[], t: number): Point {
  if (t <= 0) return path[0]
  if (t >= 1) return path[path.length - 1]
  const segs: number[] = []
  let total = 0
  for (let i = 1; i < path.length; i++) {
    const d = Math.sqrt((path[i].x - path[i-1].x)**2 + (path[i].y - path[i-1].y)**2)
    segs.push(d); total += d
  }
  const target = t * total
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

// ─── Shared SVG Sub-components ───────────────────────────────────────────────

interface FloorPlanProps {
  config: FloorConfig
  disaster: DisasterType
  selectedExit: string | null
  agentPos: Point
  phase: SimPhase
  blockedExits: Set<string>
  onExitClick: (e: string) => void
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

function SimOverlay({ config, disaster, selectedExit, agentPos, phase, blockedExits, onExitClick }: FloorPlanProps) {
  const obstacles = config.obstacles[disaster]
  const isPlanning = phase === 'planning'
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

      <ObstacleLayer obstacles={obstacles} />

      {/* Planned route */}
      {selectedExit && isPlanning && config.primaryPaths[selectedExit] && (
        <path
          d={pathD(config.primaryPaths[selectedExit])}
          fill="none"
          stroke={blockedExits.has(selectedExit) ? '#ef4444' : '#2db8b0'}
          strokeWidth="2.5" strokeDasharray="7 4" strokeLinecap="round" opacity="0.65"
        />
      )}

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

      {/* Start marker */}
      {phase === 'planning' && (
        <g>
          <circle cx={config.startPos.x} cy={config.startPos.y} r="8"
            fill="#2db8b033" stroke="#2db8b0" strokeWidth="1.5" strokeDasharray="3 2" />
          <text x={config.startPos.x} y={config.startPos.y + 4}
            textAnchor="middle" fill="#2db8b0" fontSize="9" fontFamily="system-ui, sans-serif">YOU</text>
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
    <svg viewBox={`0 0 ${config.viewWidth} ${config.viewHeight}`}
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
function CSBFloorPlan(props: FloorPlanProps) {
  const { config } = props
  const is2F = config.floorLabel === '2nd Floor'

  return (
    <svg viewBox={`0 0 ${config.viewWidth} ${config.viewHeight}`}
      style={{ width: '100%', height: '100%', display: 'block' }}>

      {/* Outer shell */}
      <rect x="20" y="20" width="860" height="560" rx="6" fill="#131c2e" stroke="#2d3f5a" strokeWidth="2.5" />

      {/* ── Vertical main corridor (left spine) ── */}
      <rect x="200" y="30" width="120" height="540" fill="#0f1824" stroke="#2d3f5a" strokeWidth="1.5" />
      <text x="260" y="300" textAnchor="middle" fill="#334e6a" fontSize="8"
        fontFamily="system-ui, sans-serif" letterSpacing="2"
        transform="rotate(-90, 260, 300)">MAIN CORRIDOR</text>

      {/* ── Left wing rooms ── */}
      <rect x="25" y="35" width="175" height="120" fill="#18253a" stroke="#2d3f5a" strokeWidth="1.5" />
      <text x="112" y="95" textAnchor="middle" fill="#4a6080" fontSize="10" fontFamily="system-ui, sans-serif">
        {is2F ? 'Room 201' : 'Room 101'}
      </text>
      <rect x="198" y="75" width="4" height="35" fill="#0f1824" />

      <rect x="25" y="155" width="175" height="120" fill="#18253a" stroke="#2d3f5a" strokeWidth="1.5" />
      <text x="112" y="215" textAnchor="middle" fill="#4a6080" fontSize="10" fontFamily="system-ui, sans-serif">
        {is2F ? 'Room 202' : 'Room 102'}
      </text>
      <rect x="198" y="195" width="4" height="35" fill="#0f1824" />

      <rect x="25" y="275" width="175" height="120" fill="#18253a" stroke="#2d3f5a" strokeWidth="1.5" />
      <text x="112" y="335" textAnchor="middle" fill="#4a6080" fontSize="10" fontFamily="system-ui, sans-serif">
        {is2F ? 'Room 203' : 'Room 103'}
      </text>
      <rect x="198" y="315" width="4" height="35" fill="#0f1824" />

      <rect x="25" y="395" width="175" height="175" fill="#18253a" stroke="#2d3f5a" strokeWidth="1.5" />
      <text x="112" y="482" textAnchor="middle" fill="#4a6080" fontSize="10" fontFamily="system-ui, sans-serif">
        {is2F ? 'Room 204' : 'Room 104'}
      </text>
      <rect x="198" y="450" width="4" height="35" fill="#0f1824" />

      {/* ── Horizontal hallway (connects to right wing) ── */}
      <rect x="320" y="250" width="400" height="60" fill="#0f1824" stroke="#2d3f5a" strokeWidth="1.5" />
      <text x="520" y="284" textAnchor="middle" fill="#334e6a" fontSize="8"
        fontFamily="system-ui, sans-serif" letterSpacing="1.5">HALLWAY</text>
      {/* Door from vertical corridor → hallway */}
      <rect x="318" y="268" width="4" height="30" fill="#0f1824" />

      {/* ── Faculty office (top center) ── */}
      <rect x="340" y="35" width="175" height="100" fill="#18253a" stroke="#2d3f5a" strokeWidth="1.5" />
      <text x="427" y="82" textAnchor="middle" fill="#4a6080" fontSize="10" fontFamily="system-ui, sans-serif">Faculty Office</text>
      <text x="427" y="96" textAnchor="middle" fill="#3a5070" fontSize="8" fontFamily="system-ui, sans-serif">
        {is2F ? '(Room 208)' : '(Room 108)'}
      </text>

      {/* Restrooms */}
      <rect x="340" y="145" width="85" height="55" fill="#162030" stroke="#2d3f5a" strokeWidth="1" />
      <text x="382" y="177" textAnchor="middle" fill="#3a5070" fontSize="8" fontFamily="system-ui, sans-serif">WC</text>
      <rect x="425" y="145" width="85" height="55" fill="#162030" stroke="#2d3f5a" strokeWidth="1" />
      <text x="467" y="177" textAnchor="middle" fill="#3a5070" fontSize="8" fontFamily="system-ui, sans-serif">WC</text>

      {/* ── Right wing: Labs ── */}
      <rect x="535" y="35" width="170" height="165" fill={is2F ? '#1a2840' : '#18253a'} stroke="#2d3f5a" strokeWidth="1.5" />
      <text x="620" y="110" textAnchor="middle" fill="#4a6080" fontSize="10" fontFamily="system-ui, sans-serif">
        {is2F ? 'Chemistry Lab' : 'Physics Lab'}
      </text>
      <text x="620" y="125" textAnchor="middle" fill="#3a5070" fontSize="8" fontFamily="system-ui, sans-serif">
        {is2F ? '(Room 205)' : '(Room 105)'}
      </text>

      {/* Lab prep */}
      <rect x="705" y="35" width="170" height="165" fill="#1a2b42" stroke="#2d3f5a" strokeWidth="1.5" />
      <text x="790" y="110" textAnchor="middle" fill="#4a6080" fontSize="10" fontFamily="system-ui, sans-serif">
        {is2F ? 'Chem Prep' : 'Physics Prep'}
      </text>
      <text x="790" y="125" textAnchor="middle" fill="#3a5070" fontSize="8" fontFamily="system-ui, sans-serif">Room</text>
      <rect x="703" y="95" width="4" height="35" fill="#1a2b42" />

      {/* Biology/Computer lab */}
      <rect x="535" y="200" width="340" height="50" fill="#18253a" stroke="#2d3f5a" strokeWidth="1" />
      <text x="705" y="230" textAnchor="middle" fill="#4a6080" fontSize="9" fontFamily="system-ui, sans-serif">
        {is2F ? 'Biology Lab (Room 206)' : 'Computer Lab (Room 106)'}
      </text>
      <rect x="630" y="248" width="40" height="4" fill="#0f1824" />

      {/* Lecture hall */}
      <rect x="535" y="310" width="340" height="180" fill="#1a2b42" stroke="#2d3f5a" strokeWidth="1.5" />
      <text x="705" y="395" textAnchor="middle" fill="#4a6080" fontSize="10" fontFamily="system-ui, sans-serif">
        {is2F ? 'Lecture Hall 2' : 'Lecture Hall 1'}
      </text>
      <text x="705" y="410" textAnchor="middle" fill="#3a5070" fontSize="8" fontFamily="system-ui, sans-serif">
        {is2F ? '(Room 207)' : '(Room 107)'}
      </text>
      <rect x="630" y="308" width="40" height="4" fill="#0f1824" />

      {/* Storage/utility */}
      <rect x="340" y="490" width="170" height="80" fill="#18253a" stroke="#2d3f5a" strokeWidth="1" />
      <text x="425" y="534" textAnchor="middle" fill="#4a6080" fontSize="9" fontFamily="system-ui, sans-serif">
        {is2F ? 'Storage' : 'Utility'}
      </text>

      {/* ── Stairwells ── */}
      <StairwellSymbol x={135} y={545} w={65} h={30} />
      <StairwellSymbol x={515} y={545} w={65} h={30} />

      {/* ── Exit wall gaps ── */}
      {!is2F && <rect x="235" y="568" width="50" height="4" fill="#131c2e" />}
      {!is2F && <rect x="878" y="260" width="4" height="40" fill="#131c2e" />}
      {is2F && <rect x="878" y="100" width="4" height="45" fill="#131c2e" />}

      {/* Floor label */}
      <text x="850" y="560" textAnchor="end" fill="#1e2f46" fontSize="11"
        fontFamily="system-ui, sans-serif" fontWeight="700" letterSpacing="0.05em">
        {config.floorLabel.toUpperCase()}
      </text>

      <SimOverlay {...props} />
    </svg>
  )
}

// ── Floor plan selector ──
function FloorPlanView(props: FloorPlanProps & { buildingId: string }) {
  const { buildingId, ...rest } = props
  if (buildingId === 'admin-building') return <AdminFloorPlan {...rest} />
  if (buildingId === 'science-building') return <CSBFloorPlan {...rest} />
  return <AdminFloorPlan {...rest} />
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
  const meta     = DISASTER_META[disaster] || DISASTER_META.fire

  const floors    = getFloorConfigs(regionId)
  const hasFloors = floors.length > 0

  const [floorIdx,      setFloorIdx]      = useState(0)
  const [phase,         setPhase]         = useState<SimPhase>('planning')
  const [selectedExit,  setSelectedExit]  = useState<string | null>(null)
  const [agentPos,      setAgentPos]      = useState<Point>({ x: 0, y: 0 })
  const [metrics,       setMetrics]       = useState<SimMetrics | null>(null)
  const [events,        setEvents]        = useState<SimEvent[]>([])
  const [elapsedSec,    setElapsedSec]    = useState(0)

  const animRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const phase2Ref = useRef<SimPhase>('planning')

  const config = hasFloors ? floors[floorIdx] : null

  useEffect(() => { if (config) setAgentPos(config.startPos) }, [config])
  useEffect(() => { if (!isLoading && !isAuthenticated) window.location.href = '/auth' }, [isLoading, isAuthenticated])
  useEffect(() => { phase2Ref.current = phase }, [phase])
  useEffect(() => () => { if (animRef.current) clearInterval(animRef.current) }, [])

  const blockedExits = config
    ? new Set(config.obstacles[disaster].flatMap(o => o.blocksExits))
    : new Set<string>()

  const pushEvent = useCallback((message: string, type: SimEvent['type'] = 'info') => {
    setEvents(prev => [...prev, { time: Date.now(), message, type }])
  }, [])

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

    const primaryPath     = config.primaryPaths[selectedExit]
    const blockT          = config.blockT[selectedExit] || 1
    const isBlocked       = blockedExits.has(selectedExit)
    const totalPrimary    = pathLength(primaryPath)
    const SPEED           = 80
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
  }, [selectedExit, config, disaster, blockedExits, pushEvent, finishSimulation])

  const reset = () => {
    if (animRef.current) clearInterval(animRef.current)
    setPhase('planning')
    setSelectedExit(null)
    if (config) setAgentPos(config.startPos)
    setMetrics(null)
    setEvents([])
    setElapsedSec(0)
  }

  const switchFloor = (idx: number) => {
    if (idx === floorIdx) return
    reset()
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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', gap: '16px', background: '#1e293b', borderRadius: '16px', border: '1px solid #334155' }}>
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
    <div style={{ minHeight: '100vh', padding: '80px 32px 48px', maxWidth: '1340px', margin: '0 auto' }}>

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
          <div style={{ display: 'flex', gap: '4px', marginLeft: '12px', background: '#0f172a', borderRadius: '10px', padding: '3px', border: '1px solid #1e2f46' }}>
            {floors.map((f, i) => (
              <button key={i} onClick={() => switchFloor(i)} disabled={phase !== 'planning'}
                style={{
                  padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                  border: 'none', cursor: phase !== 'planning' ? 'not-allowed' : 'pointer',
                  background: floorIdx === i ? '#2db8b0' : 'transparent',
                  color: floorIdx === i ? '#fff' : '#4a6080',
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '20px', alignItems: 'start' }}>

        <div style={{ background: '#0d1520', borderRadius: '14px', border: '1px solid #1e2f46', overflow: 'hidden', aspectRatio: `${config!.viewWidth}/${config!.viewHeight}` }}>
          <FloorPlanView
            buildingId={regionId} config={config!} disaster={disaster}
            selectedExit={selectedExit} agentPos={agentPos} phase={phase}
            blockedExits={blockedExits}
            onExitClick={key => phase === 'planning' && setSelectedExit(key)}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {phase === 'planning' && config && (
            <>
              <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '18px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>Choose Your Exit</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.5 }}>
                  Select where you would head during this evacuation. The simulation will show what actually happens.
                </div>

                {Object.keys(config.exits).map(key => {
                  const blocked = blockedExits.has(key)
                  const selected = selectedExit === key
                  const color = blocked ? '#ef4444' : '#22c55e'
                  const isStair = key.startsWith('S')
                  return (
                    <button key={key} onClick={() => setSelectedExit(key)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        width: '100%', padding: '10px 12px', marginBottom: '8px',
                        background: selected ? `${color}12` : '#0f172a',
                        border: `1.5px solid ${selected ? color : '#1e2f46'}`,
                        borderRadius: '8px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                      }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: isStair ? '6px' : '50%', background: `${color}20`, border: `1.5px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, color }}>{key}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{config.exits[key].desc}</div>
                        {blocked && <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '2px' }}>Likely blocked {'\u00B7'} {disaster === 'fire' ? 'Fire/smoke' : 'Debris'}</div>}
                        {isStair && !blocked && <div style={{ fontSize: '10px', color: '#4a6080', marginTop: '2px' }}>Stairwell access</div>}
                      </div>
                      {selected && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                    </button>
                  )
                })}
              </div>

              <div style={{ background: `${meta.color}08`, border: `1px solid ${meta.color}20`, borderRadius: '10px', padding: '12px 14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: meta.color, marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {disaster === 'fire' ? '\uD83D\uDD25 Active Fire' : '\u26A0 Earthquake'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                  {disaster === 'fire'
                    ? 'Fire detected in the building. Smoke may be spreading \u2014 exits near the fire source may be hazardous.'
                    : 'Structural damage reported. Debris may block corridors and stairwells. Assess your exit options carefully.'}
                </div>
              </div>

              <button onClick={startSimulation} disabled={!selectedExit}
                style={{
                  padding: '12px', borderRadius: '10px', fontSize: '13px', fontWeight: 700,
                  background: selectedExit ? '#2db8b0' : '#1e2f46',
                  color: selectedExit ? '#fff' : '#4a6080',
                  border: 'none', cursor: selectedExit ? 'pointer' : 'not-allowed', transition: 'all 0.15s',
                }}>
                {selectedExit ? `Start Simulation \u2192 ${selectedExit}` : 'Select an exit first'}
              </button>
            </>
          )}

          {(phase === 'running' || phase === 'rerouting') && (
            <>
              <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '18px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '14px' }}>Live Metrics</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {[
                    { label: 'Elapsed', value: `${elapsedSec}s` },
                    { label: 'Target', value: selectedExit ?? '\u2014' },
                    { label: 'Status', value: phase === 'rerouting' ? 'Rerouting' : 'Moving', color: phase === 'rerouting' ? '#f59e0b' : '#2db8b0' },
                    { label: 'Floor', value: config?.floorLabel || '1F' },
                  ].map(m => (
                    <div key={m.label} style={{ background: '#0f172a', borderRadius: '8px', padding: '10px 12px' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.label}</div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: (m as { color?: string }).color ?? 'var(--text-primary)' }}>{m.value}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '14px', maxHeight: '180px', overflowY: 'auto' }}>
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
              <div style={{ background: '#1e293b', border: '1px solid #22c55e30', borderRadius: '12px', padding: '18px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#22c55e', marginBottom: '14px' }}>Drill Complete</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
                  {[
                    { label: 'Time', value: `${metrics.evacuationTime}s`, color: metrics.evacuationTime > 20 ? '#ef4444' : '#22c55e' },
                    { label: 'Exit Used', value: metrics.actualExit, color: '#2db8b0' },
                    { label: 'Rerouted', value: metrics.rerouted ? 'Yes' : 'No', color: metrics.rerouted ? '#f59e0b' : '#22c55e' },
                    { label: 'Congestion', value: metrics.congestionLevel, color: congestionColor(metrics.congestionLevel) },
                    { label: 'Efficiency', value: `${Math.round(metrics.pathEfficiency * 100)}%`, color: metrics.pathEfficiency >= 0.85 ? '#22c55e' : '#f59e0b' },
                    { label: 'Hazard Exp.', value: metrics.hazardExposure ? 'Exposed' : 'None', color: metrics.hazardExposure ? '#ef4444' : '#22c55e' },
                  ].map(m => (
                    <div key={m.label} style={{ background: '#0f172a', borderRadius: '8px', padding: '9px 11px' }}>
                      <div style={{ fontSize: '9.5px', color: 'var(--text-secondary)', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.label}</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: m.color }}>{m.value}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: '#0f172a', border: '1px solid #1e2f46', borderRadius: '10px', padding: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Drill Evaluator</div>
                {feedbackLines.map((line, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'flex-start' }}>
                    <div style={{ width: '5px', height: '5px', borderRadius: '50%', marginTop: '5px', flexShrink: 0, background: '#2db8b0' }} />
                    <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{line}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button onClick={reset}
                  style={{ padding: '10px', borderRadius: '9px', fontSize: '12px', fontWeight: 600, background: '#1e293b', border: '1px solid #334155', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  Run Again
                </button>
                <button onClick={() => router.push('/simulate')}
                  style={{ padding: '10px', borderRadius: '9px', fontSize: '12px', fontWeight: 600, background: '#2db8b0', border: 'none', color: '#fff', cursor: 'pointer' }}>
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
