'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/src/hooks/useAuth'

// ─── Types ────────────────────────────────────────────────────────────────────
type ExitKey = 'E1' | 'E2' | 'E3'
type SimPhase = 'planning' | 'running' | 'rerouting' | 'completed'
type DisasterType = 'fire' | 'earthquake'

interface Point { x: number; y: number }

interface ObstacleDef {
  id: string
  x: number; y: number; w: number; h: number
  type: 'fire' | 'smoke' | 'debris'
  label: string
  blocksExits: ExitKey[]
}

interface SimEvent {
  time: number
  message: string
  type: 'info' | 'warn' | 'danger'
}

interface SimMetrics {
  evacuationTime: number
  rerouted: boolean
  reroutedFrom?: ExitKey
  reroutedTo?: ExitKey
  hazardExposure: boolean
  pathEfficiency: number
  exitChoice: ExitKey
  actualExit: ExitKey
  congestionLevel: 'Low' | 'Medium' | 'High'
}

// ─── Floor Plan Geometry ──────────────────────────────────────────────────────
const VW = 780
const VH = 500

// Exit positions on the SVG
const EXITS: Record<ExitKey, { x: number; y: number; label: string; desc: string }> = {
  E1: { x: 390, y: 492, label: 'E1', desc: 'Main Exit · South' },
  E2: { x: 18,  y: 257, label: 'E2', desc: 'Side Exit · West'  },
  E3: { x: 762, y: 112, label: 'E3', desc: 'Emergency Exit · East' },
}

// Agent start position: center of main corridor
const START_POS: Point = { x: 390, y: 257 }

// Waypoints defining each exit's primary route
const PRIMARY_PATHS: Record<ExitKey, Point[]> = {
  E1: [
    { x: 390, y: 257 },
    { x: 390, y: 295 },
    { x: 390, y: 370 },
    { x: 390, y: 445 },
    { x: 390, y: 492 },
  ],
  E2: [
    { x: 390, y: 257 },
    { x: 280, y: 257 },
    { x: 150, y: 257 },
    { x: 55,  y: 257 },
    { x: 18,  y: 257 },
  ],
  E3: [
    { x: 390, y: 257 },
    { x: 530, y: 257 },
    { x: 665, y: 257 },
    { x: 700, y: 200 },
    { x: 700, y: 112 },
    { x: 762, y: 112 },
  ],
}

// Reroute paths when a chosen exit is blocked
// The path starts from roughly where the agent is when it encounters the block
const REROUTE: Record<ExitKey, { to: ExitKey; path: Point[] }> = {
  E2: {
    to: 'E1',
    path: [
      { x: 150, y: 257 },
      { x: 280, y: 257 },
      { x: 390, y: 257 },
      { x: 390, y: 350 },
      { x: 390, y: 445 },
      { x: 390, y: 492 },
    ],
  },
  E3: {
    to: 'E1',
    path: [
      { x: 665, y: 257 },
      { x: 530, y: 257 },
      { x: 390, y: 257 },
      { x: 390, y: 350 },
      { x: 390, y: 445 },
      { x: 390, y: 492 },
    ],
  },
  E1: { to: 'E1', path: [] }, // E1 is always safe
}

// The fraction along the primary path at which a block is encountered
const BLOCK_T: Record<ExitKey, number> = { E2: 0.45, E3: 0.50, E1: 1 }

// Obstacles per disaster type
const OBSTACLES: Record<DisasterType, ObstacleDef[]> = {
  fire: [
    {
      id: 'fire-accounting',
      x: 22, y: 345, w: 225, h: 130,
      type: 'fire',
      label: 'Fire',
      blocksExits: ['E2'],
    },
    {
      id: 'smoke-west-corridor',
      x: 22, y: 232, w: 130, h: 55,
      type: 'smoke',
      label: 'Smoke',
      blocksExits: ['E2'],
    },
    {
      id: 'smoke-records',
      x: 248, y: 290, w: 130, h: 80,
      type: 'smoke',
      label: 'Smoke',
      blocksExits: [],
    },
  ],
  earthquake: [
    {
      id: 'debris-west-corridor',
      x: 72, y: 234, w: 95, h: 46,
      type: 'debris',
      label: 'Debris',
      blocksExits: ['E2'],
    },
    {
      id: 'debris-east-corridor',
      x: 524, y: 224, w: 75, h: 66,
      type: 'debris',
      label: 'Debris',
      blocksExits: ['E3'],
    },
    {
      id: 'debris-lobby-ceiling',
      x: 248, y: 22, w: 262, h: 22,
      type: 'debris',
      label: 'Structural Damage',
      blocksExits: [],
    },
  ],
}

// Path efficiency scores (optimal = E1 for most cases; E3 adds distance)
const EFFICIENCY: Record<ExitKey, number> = { E1: 0.95, E2: 0.88, E3: 0.72 }

// ─── Path math ────────────────────────────────────────────────────────────────
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

// ─── SVG Floor Plan ───────────────────────────────────────────────────────────
function AdminFloorPlan({
  disaster,
  selectedExit,
  agentPos,
  phase,
  blockedExits,
  onExitClick,
}: {
  disaster: DisasterType
  selectedExit: ExitKey | null
  agentPos: Point
  phase: SimPhase
  blockedExits: Set<ExitKey>
  onExitClick: (e: ExitKey) => void
}) {
  const obstacles = OBSTACLES[disaster]

  const pathD = (points: Point[]) =>
    points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')

  const isPlanning = phase === 'planning'

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      style={{ width: '100%', height: '100%', display: 'block' }}
    >
      <defs>
        <radialGradient id="rg-fire" cx="50%" cy="60%">
          <stop offset="0%"   stopColor="#ff4500" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#ff8c00" stopOpacity="0.35" />
        </radialGradient>
        <radialGradient id="rg-smoke">
          <stop offset="0%"   stopColor="#6b7280" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#4b5563" stopOpacity="0.20" />
        </radialGradient>
        <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#92400e" strokeWidth="1.5" opacity="0.6" />
        </pattern>
      </defs>

      {/* ── Outer building shell ── */}
      <rect x="20" y="20" width="740" height="460" rx="6"
        fill="#131c2e" stroke="#2d3f5a" strokeWidth="2.5" />

      {/* ── Top row rooms ── */}
      {/* Chancellor's Office */}
      <rect x="20" y="20" width="228" height="210" fill="#18253a" stroke="#2d3f5a" strokeWidth="1.5" />
      <text x="134" y="118" textAnchor="middle" fill="#4a6080" fontSize="11" fontFamily="system-ui, sans-serif">Chancellor's</text>
      <text x="134" y="132" textAnchor="middle" fill="#4a6080" fontSize="11" fontFamily="system-ui, sans-serif">Office</text>

      {/* Main Lobby */}
      <rect x="248" y="20" width="284" height="210" fill="#1a2b42" stroke="#2d3f5a" strokeWidth="1.5" />
      <text x="390" y="122" textAnchor="middle" fill="#4a6080" fontSize="11" fontFamily="system-ui, sans-serif">Main Lobby</text>
      <text x="390" y="136" textAnchor="middle" fill="#3a5070" fontSize="9" fontFamily="system-ui, sans-serif">/ Reception</text>

      {/* Registrar */}
      <rect x="532" y="20" width="228" height="210" fill="#18253a" stroke="#2d3f5a" strokeWidth="1.5" />
      <text x="646" y="122" textAnchor="middle" fill="#4a6080" fontSize="11" fontFamily="system-ui, sans-serif">Registrar</text>

      {/* ── Main horizontal corridor ── */}
      <rect x="20" y="230" width="740" height="55" fill="#0f1824" stroke="#2d3f5a" strokeWidth="1.5" />
      <text x="390" y="261" textAnchor="middle" fill="#334e6a" fontSize="9.5"
        fontFamily="system-ui, sans-serif" letterSpacing="2">MAIN CORRIDOR</text>

      {/* Doorway openings (rooms → corridor) */}
      <rect x="100" y="229" width="58" height="57" fill="#0f1824" />
      <rect x="310" y="229" width="160" height="57" fill="#0f1824" />
      <rect x="590" y="229" width="58" height="57" fill="#0f1824" />
      <rect x="100" y="228" width="58" height="4"  fill="#2d3f5a" />
      <rect x="310" y="228" width="160" height="4" fill="#2d3f5a" />
      <rect x="590" y="228" width="58"  height="4" fill="#2d3f5a" />

      {/* ── Bottom row rooms ── */}
      {/* Accounting */}
      <rect x="20" y="285" width="228" height="195" fill="#18253a" stroke="#2d3f5a" strokeWidth="1.5" />
      <text x="134" y="385" textAnchor="middle" fill="#4a6080" fontSize="11" fontFamily="system-ui, sans-serif">Accounting</text>

      {/* Records Room */}
      <rect x="248" y="285" width="284" height="195" fill="#1a2b42" stroke="#2d3f5a" strokeWidth="1.5" />
      <text x="390" y="385" textAnchor="middle" fill="#4a6080" fontSize="11" fontFamily="system-ui, sans-serif">Records Room</text>

      {/* HR Department */}
      <rect x="532" y="285" width="228" height="195" fill="#18253a" stroke="#2d3f5a" strokeWidth="1.5" />
      <text x="646" y="385" textAnchor="middle" fill="#4a6080" fontSize="11" fontFamily="system-ui, sans-serif">HR Dept</text>

      {/* Bottom doorways */}
      <rect x="100" y="283" width="58" height="4" fill="#2d3f5a" />
      <rect x="310" y="283" width="160" height="4" fill="#2d3f5a" />
      <rect x="590" y="283" width="58"  height="4" fill="#2d3f5a" />

      {/* ── E1 gap in bottom wall (main exit opening) ── */}
      <rect x="350" y="478" width="80" height="4" fill="#131c2e" />

      {/* ── E2 gap in left wall ── */}
      <rect x="18" y="232" width="4" height="51" fill="#131c2e" />

      {/* ── E3 gap in right wall ── */}
      <rect x="758" y="92" width="4" height="42" fill="#131c2e" />

      {/* ── Obstacles ── */}
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
              🔥 {obs.label}
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
              ☁ Smoke
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
              ⚠ {obs.label}
            </text>
          </g>
        )
        return null
      })}

      {/* ── Planned route dashes ── */}
      {selectedExit && isPlanning && (
        <path
          d={pathD(PRIMARY_PATHS[selectedExit])}
          fill="none"
          stroke={blockedExits.has(selectedExit) ? '#ef4444' : '#2db8b0'}
          strokeWidth="2.5"
          strokeDasharray="7 4"
          strokeLinecap="round"
          opacity="0.65"
        />
      )}

      {/* ── Exits ── */}
      {(Object.keys(EXITS) as ExitKey[]).map(key => {
        const ex = EXITS[key]
        const blocked = blockedExits.has(key)
        const selected = selectedExit === key
        const color = blocked ? '#ef4444' : '#22c55e'
        return (
          <g key={key}
            onClick={isPlanning ? () => onExitClick(key) : undefined}
            style={{ cursor: isPlanning ? 'pointer' : 'default' }}>
            {/* Glow ring when selected */}
            {selected && (
              <circle cx={ex.x} cy={ex.y} r="22"
                fill="none" stroke={color} strokeWidth="1.5" opacity="0.3">
                <animate attributeName="r" values="18;24;18" dur="1.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.3;0.1;0.3" dur="1.5s" repeatCount="indefinite" />
              </circle>
            )}
            <circle cx={ex.x} cy={ex.y} r={selected ? 17 : 13}
              fill={selected ? color : `${color}22`}
              stroke={color} strokeWidth={selected ? 2.5 : 1.8}
              style={{ transition: 'all 0.2s' }} />
            <text x={ex.x} y={ex.y + 4}
              textAnchor="middle" fill={selected ? '#fff' : color}
              fontSize="10" fontFamily="system-ui, sans-serif" fontWeight="700">
              {key}
            </text>
            {/* Blocked X */}
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

      {/* ── Agent ── */}
      {phase !== 'planning' && (
        <g>
          <circle cx={agentPos.x} cy={agentPos.y + 3} r="11" fill="#000" opacity="0.18" />
          <circle cx={agentPos.x} cy={agentPos.y} r="11"
            fill="#2db8b0" stroke="#fff" strokeWidth="2" />
          {/* Simple person silhouette */}
          <circle cx={agentPos.x} cy={agentPos.y - 4} r="3.5" fill="#fff" />
          <path d={`M${agentPos.x - 5},${agentPos.y + 4} Q${agentPos.x},${agentPos.y + 9} ${agentPos.x + 5},${agentPos.y + 4}`}
            stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        </g>
      )}

      {/* ── Start marker ── */}
      {phase === 'planning' && (
        <g>
          <circle cx={START_POS.x} cy={START_POS.y} r="8"
            fill="#2db8b033" stroke="#2db8b0" strokeWidth="1.5" strokeDasharray="3 2" />
          <text x={START_POS.x} y={START_POS.y + 4}
            textAnchor="middle" fill="#2db8b0" fontSize="9" fontFamily="system-ui, sans-serif">YOU</text>
        </g>
      )}

      {/* ── Legend: exit labels ── */}
      {(Object.keys(EXITS) as ExitKey[]).map(key => {
        const ex = EXITS[key]
        const blocked = blockedExits.has(key)
        // Offset label away from wall
        const lx = key === 'E2' ? ex.x + 28 : key === 'E3' ? ex.x - 28 : ex.x
        const ly = key === 'E1' ? ex.y - 20 : ex.y
        return (
          <text key={`lbl-${key}`} x={lx} y={ly}
            textAnchor="middle" fill={blocked ? '#ef444488' : '#22c55e88'}
            fontSize="9" fontFamily="system-ui, sans-serif">
            {ex.desc}
          </text>
        )
      })}
    </svg>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const DISASTER_META: Record<string, { label: string; color: string }> = {
  fire:       { label: 'Fire Simulation',       color: '#ff6b35' },
  earthquake: { label: 'Earthquake Simulation', color: '#f59e0b' },
}

export default function SimulationRunPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const router   = useRouter()
  const params   = useParams()
  const search   = useSearchParams()

  const regionId  = params.id as string
  const disaster  = (search.get('disaster') || 'fire') as DisasterType
  const meta      = DISASTER_META[disaster] || DISASTER_META.fire
  const isAdmin   = regionId === 'admin-building'

  // ── Simulation state ──
  const [phase,        setPhase]        = useState<SimPhase>('planning')
  const [selectedExit, setSelectedExit] = useState<ExitKey | null>(null)
  const [agentPos,     setAgentPos]     = useState<Point>(START_POS)
  const [metrics,      setMetrics]      = useState<SimMetrics | null>(null)
  const [events,       setEvents]       = useState<SimEvent[]>([])
  const [elapsedSec,   setElapsedSec]   = useState(0)

  const animRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTime = useRef<number>(0)
  const phase2Ref = useRef<SimPhase>('planning') // avoid stale closure in interval

  useEffect(() => { if (!isLoading && !isAuthenticated) window.location.href = '/auth' },
    [isLoading, isAuthenticated])

  // Keep ref in sync
  useEffect(() => { phase2Ref.current = phase }, [phase])

  const blockedExits = new Set(
    OBSTACLES[disaster].flatMap(o => o.blocksExits)
  )

  // ── Clean up on unmount ──
  useEffect(() => () => { if (animRef.current) clearInterval(animRef.current) }, [])

  // ── Push event ──
  const pushEvent = useCallback((message: string, type: SimEvent['type'] = 'info') => {
    setEvents(prev => [...prev, { time: Date.now(), message, type }])
  }, [])

  // ── Finish simulation ──
  const finishSimulation = useCallback((
    chosen: ExitKey,
    actual: ExitKey,
    rerouted: boolean,
    time: number,
  ) => {
    setPhase('completed')
    phase2Ref.current = 'completed'

    const hazardExposure = OBSTACLES[disaster].some(obs =>
      obs.type !== 'debris' && obs.blocksExits.includes(chosen)
    )
    const congestion: SimMetrics['congestionLevel'] =
      actual === 'E1' && rerouted ? 'High' : actual === 'E1' ? 'Medium' : 'Low'

    setMetrics({
      evacuationTime: parseFloat(time.toFixed(1)),
      rerouted,
      reroutedFrom: rerouted ? chosen : undefined,
      reroutedTo:   rerouted ? actual : undefined,
      hazardExposure,
      pathEfficiency: rerouted ? 0.58 : EFFICIENCY[chosen],
      exitChoice:    chosen,
      actualExit:    actual,
      congestionLevel: congestion,
    })

    pushEvent(
      rerouted
        ? `Evacuated via ${actual} after reroute — ${time.toFixed(1)}s total`
        : `Successfully evacuated via ${actual} in ${time.toFixed(1)}s`,
      'info'
    )
  }, [disaster, pushEvent])

  // ── Run simulation ──
  const startSimulation = useCallback(() => {
    if (!selectedExit) return
    setPhase('running')
    setEvents([])

    const primaryPath     = PRIMARY_PATHS[selectedExit]
    const blockT          = BLOCK_T[selectedExit]
    const isBlocked       = blockedExits.has(selectedExit)
    const totalPrimary    = pathLength(primaryPath)
    const SPEED           = 80 // px per second
    const primaryDuration = isBlocked
      ? (totalPrimary * blockT / SPEED) * 1000
      : (totalPrimary          / SPEED) * 1000

    let hasRerouted = false
    const TICK = 50
    let elapsed = 0
    setElapsedSec(0)

    pushEvent(`Evacuation started — heading to ${selectedExit}`, 'info')
    if (isBlocked) {
      const obs = OBSTACLES[disaster].find(o => o.blocksExits.includes(selectedExit))
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

        const reroute = REROUTE[selectedExit]
        pushEvent(`Route to ${selectedExit} is BLOCKED — rerouting to ${reroute.to}`, 'danger')

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
  }, [selectedExit, disaster, blockedExits, pushEvent, finishSimulation])

  const reset = () => {
    if (animRef.current) clearInterval(animRef.current)
    setPhase('planning')
    setSelectedExit(null)
    setAgentPos(START_POS)
    setMetrics(null)
    setEvents([])
    setElapsedSec(0)
  }

  // ── Auth loading ──
  if (isLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading...</div>
    </div>
  )

  const displayName = regionId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  // ── Non-admin buildings: placeholder ──
  if (!isAdmin) return (
    <div style={{ minHeight: '100vh', padding: '88px 40px 56px', maxWidth: '1280px', margin: '0 auto' }}>
      <button onClick={() => router.push(`/simulate/${encodeURIComponent(regionId)}/disaster`)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', padding: 0, marginBottom: '28px' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        Change disaster type
      </button>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', gap: '16px', background: 'var(--card-bg, #1e293b)', borderRadius: '16px', border: '1px solid var(--border, #334155)' }}>
        <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{displayName}</div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Floor plan for this building is coming soon.</div>
      </div>
    </div>
  )

  // ── Feedback text for completed phase ──
  const feedbackLines: string[] = []
  if (metrics) {
    if (metrics.rerouted) {
      feedbackLines.push(`You chose ${metrics.exitChoice} but it was blocked by ${disaster === 'fire' ? 'fire/smoke' : 'debris'}.`)
      feedbackLines.push(`The simulation rerouted you to ${metrics.reroutedTo}, adding significant delay.`)
    } else if (metrics.exitChoice === 'E3') {
      feedbackLines.push(`You chose the emergency exit (E3), which was clear but required a longer path.`)
    } else if (metrics.exitChoice === 'E1') {
      feedbackLines.push(`You chose the main exit (E1) — the most direct safe route for this scenario.`)
    } else {
      feedbackLines.push(`You chose the side exit (E2) — check for hazards near this route in ${disaster} scenarios.`)
    }
    if (metrics.hazardExposure) {
      feedbackLines.push(`Your initial route passed through a hazard zone — awareness of obstacle positions is critical.`)
    }
    if (metrics.pathEfficiency >= 0.9) {
      feedbackLines.push(`Route efficiency: Excellent. You took near-optimal path given conditions.`)
    } else if (metrics.pathEfficiency >= 0.7) {
      feedbackLines.push(`Route efficiency: Good. A better exit choice could reduce your time by ~20%.`)
    } else {
      feedbackLines.push(`Route efficiency: Poor. Review the floor plan and obstacle positions before the next drill.`)
    }
  }

  const congestionColor = (level: SimMetrics['congestionLevel']) =>
    level === 'High' ? '#ef4444' : level === 'Medium' ? '#f59e0b' : '#22c55e'

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', padding: '80px 32px 48px', maxWidth: '1340px', margin: '0 auto' }}>

      {/* Back */}
      <button
        onClick={() => router.push(`/simulate/${encodeURIComponent(regionId)}/disaster`)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', padding: 0, marginBottom: '24px', transition: 'color 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        Change disaster type
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px' }}>
        <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: `${meta.color}12`, border: `1px solid ${meta.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={meta.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {disaster === 'fire'
              ? <><path d="M12 2c.5 2.5 2 4.5 2 7a4 4 0 1 1-8 0c0-2.5 2-4.5 2-7 1.5 1.5 2.5 3 4 0z" /><path d="M12 12c.5 1 1 2 1 3a2 2 0 1 1-4 0c0-1 .5-2 1-3 .5.5 1 1 2 0z" /></>
              : <path d="M2 12h4l2-5 3 10 3-10 2 5h4" />
            }
          </svg>
        </div>
        <div>
          <h1 style={{ margin: '0 0 3px', fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            {meta.label}
          </h1>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
            Administration Building · Ground Floor
          </p>
        </div>

        {/* Phase pill */}
        <div style={{ marginLeft: 'auto', padding: '5px 14px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', background: phase === 'planning' ? '#2db8b015' : phase === 'completed' ? '#22c55e15' : `${meta.color}15`, color: phase === 'planning' ? '#2db8b0' : phase === 'completed' ? '#22c55e' : meta.color, border: `1px solid ${phase === 'planning' ? '#2db8b030' : phase === 'completed' ? '#22c55e30' : `${meta.color}30`}` }}>
          {phase === 'planning' ? 'Planning' : phase === 'rerouting' ? 'Rerouting…' : phase === 'running' ? `Running · ${elapsedSec}s` : 'Completed'}
        </div>
      </div>

      {/* Main layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '20px', alignItems: 'start' }}>

        {/* ── Left: Floor plan ── */}
        <div style={{ background: '#0d1520', borderRadius: '14px', border: '1px solid #1e2f46', overflow: 'hidden', aspectRatio: '780/500' }}>
          <AdminFloorPlan
            disaster={disaster}
            selectedExit={selectedExit}
            agentPos={agentPos}
            phase={phase}
            blockedExits={blockedExits}
            onExitClick={key => phase === 'planning' && setSelectedExit(key)}
          />
        </div>

        {/* ── Right: Control panel ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* PLANNING PHASE */}
          {phase === 'planning' && (
            <>
              <div style={{ background: 'var(--card-bg, #1e293b)', border: '1px solid var(--border, #334155)', borderRadius: '12px', padding: '18px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  Choose Your Exit
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.5 }}>
                  Select where you would head during this evacuation. The simulation will show what actually happens.
                </div>

                {(Object.keys(EXITS) as ExitKey[]).map(key => {
                  const blocked  = blockedExits.has(key)
                  const selected = selectedExit === key
                  const color    = blocked ? '#ef4444' : '#22c55e'
                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedExit(key)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        width: '100%', padding: '10px 12px', marginBottom: '8px',
                        background: selected ? `${color}12` : '#0f172a',
                        border: `1.5px solid ${selected ? color : '#1e2f46'}`,
                        borderRadius: '8px', cursor: 'pointer', textAlign: 'left',
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: `${color}20`, border: `1.5px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, color }}>{key}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{EXITS[key].desc}</div>
                        {blocked && <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '2px' }}>Likely blocked · {disaster === 'fire' ? 'Fire/smoke' : 'Debris'}</div>}
                      </div>
                      {selected && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Obstacle warning */}
              <div style={{ background: `${meta.color}08`, border: `1px solid ${meta.color}20`, borderRadius: '10px', padding: '12px 14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: meta.color, marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {disaster === 'fire' ? '🔥 Active Fire' : '⚠ Earthquake'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                  {disaster === 'fire'
                    ? 'Fire in Accounting. Smoke spreading into the west corridor — exits near that area may be hazardous.'
                    : 'Debris blocking west corridor and east side. Consider central exits.'}
                </div>
              </div>

              {/* Start button */}
              <button
                onClick={startSimulation}
                disabled={!selectedExit}
                style={{
                  padding: '12px', borderRadius: '10px', fontSize: '13px', fontWeight: 700,
                  background: selectedExit ? '#2db8b0' : '#1e2f46',
                  color: selectedExit ? '#fff' : '#4a6080',
                  border: 'none', cursor: selectedExit ? 'pointer' : 'not-allowed',
                  transition: 'all 0.15s',
                }}
              >
                {selectedExit ? `Start Simulation → ${selectedExit}` : 'Select an exit first'}
              </button>
            </>
          )}

          {/* RUNNING / REROUTING PHASE */}
          {(phase === 'running' || phase === 'rerouting') && (
            <>
              <div style={{ background: 'var(--card-bg, #1e293b)', border: '1px solid var(--border, #334155)', borderRadius: '12px', padding: '18px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '14px' }}>
                  Live Metrics
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {[
                    { label: 'Elapsed', value: `${elapsedSec}s` },
                    { label: 'Target', value: selectedExit ?? '—' },
                    { label: 'Status', value: phase === 'rerouting' ? 'Rerouting' : 'Moving', color: phase === 'rerouting' ? '#f59e0b' : '#2db8b0' },
                    { label: 'Disaster', value: disaster === 'fire' ? 'Fire' : 'Earthquake', color: meta.color },
                  ].map(m => (
                    <div key={m.label} style={{ background: '#0f172a', borderRadius: '8px', padding: '10px 12px' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.label}</div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: (m as { color?: string }).color ?? 'var(--text-primary)' }}>{m.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Event log */}
              <div style={{ background: 'var(--card-bg, #1e293b)', border: '1px solid var(--border, #334155)', borderRadius: '12px', padding: '14px', maxHeight: '180px', overflowY: 'auto' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Event Log</div>
                {events.length === 0 && <div style={{ fontSize: '12px', color: '#334155' }}>No events yet…</div>}
                {events.map((ev, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'flex-start' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', marginTop: '4px', flexShrink: 0, background: ev.type === 'danger' ? '#ef4444' : ev.type === 'warn' ? '#f59e0b' : '#2db8b0' }} />
                    <div style={{ fontSize: '11px', color: ev.type === 'danger' ? '#ef4444' : ev.type === 'warn' ? '#f59e0b' : 'var(--text-secondary)', lineHeight: 1.4 }}>{ev.message}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* COMPLETED PHASE */}
          {phase === 'completed' && metrics && (
            <>
              <div style={{ background: 'var(--card-bg, #1e293b)', border: '1px solid #22c55e30', borderRadius: '12px', padding: '18px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#22c55e', marginBottom: '14px' }}>
                  Drill Complete
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
                  {[
                    { label: 'Time',        value: `${metrics.evacuationTime}s`,                    color: metrics.evacuationTime > 20 ? '#ef4444' : '#22c55e' },
                    { label: 'Exit Used',   value: metrics.actualExit,                              color: '#2db8b0' },
                    { label: 'Rerouted',    value: metrics.rerouted ? 'Yes' : 'No',                color: metrics.rerouted ? '#f59e0b' : '#22c55e' },
                    { label: 'Congestion',  value: metrics.congestionLevel,                         color: congestionColor(metrics.congestionLevel) },
                    { label: 'Efficiency',  value: `${Math.round(metrics.pathEfficiency * 100)}%`, color: metrics.pathEfficiency >= 0.85 ? '#22c55e' : '#f59e0b' },
                    { label: 'Hazard Exp.', value: metrics.hazardExposure ? 'Exposed' : 'None',    color: metrics.hazardExposure ? '#ef4444' : '#22c55e' },
                  ].map(m => (
                    <div key={m.label} style={{ background: '#0f172a', borderRadius: '8px', padding: '9px 11px' }}>
                      <div style={{ fontSize: '9.5px', color: 'var(--text-secondary)', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.label}</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: m.color }}>{m.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Feedback */}
              <div style={{ background: '#0f172a', border: '1px solid #1e2f46', borderRadius: '10px', padding: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Drill Evaluator</div>
                {feedbackLines.map((line, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'flex-start' }}>
                    <div style={{ width: '5px', height: '5px', borderRadius: '50%', marginTop: '5px', flexShrink: 0, background: '#2db8b0' }} />
                    <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{line}</div>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button onClick={reset}
                  style={{ padding: '10px', borderRadius: '9px', fontSize: '12px', fontWeight: 600, background: '#1e293b', border: '1px solid #334155', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  Run Again
                </button>
                <button
                  onClick={() => router.push('/simulate')}
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
