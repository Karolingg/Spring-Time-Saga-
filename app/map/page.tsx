'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/src/hooks/useAuth'
import MapView, { type MapMarker } from '@/components/MapView'

/* UP Cebu campus center — used for the default top-down view */
const CAMPUS_CENTER: [number, number] = [123.8988, 10.3228] // [lng, lat]

/* ── Building data ── */
interface BuildingBounds {
  south: number
  north: number
  west: number
  east: number
}

interface CampusBuilding {
  id: string
  name: string
  type: string
  bounds: BuildingBounds
  center: [number, number] // [lat, lng] — accurate point on the actual building footprint
  capacity: number
  floors: number
  exits: number
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'N/A'
  lastDrillDate: string
  notes: string
}

interface PlaceholderAnalytics {
  currentOccupancy: number
  avgEvacuationTimeMin: number
  congestionStatus: 'Stable' | 'Moderate' | 'Critical'
  drillReadiness: number
}

const CAMPUS_BUILDINGS: CampusBuilding[] = [
  {
    id: 'social-sciences',
    name: 'Social Sciences Building',
    type: 'Academic',
    bounds: { south: 10.3221, north: 10.3255, west: 123.8971, east: 123.8987 },
    center: [10.3256, 123.8975],
    capacity: 180,
    floors: 2,
    exits: 3,
    riskLevel: 'LOW',
    lastDrillDate: '2025-09-12',
    notes: 'Houses social science classrooms and faculty offices. Main exit leads to the campus quadrangle.',
  },
  {
    id: 'asx',
    name: 'ASX Building',
    type: 'Academic',
    bounds: { south: 10.3237, north: 10.3241, west: 123.8977, east: 123.8981 },
    center: [10.3239, 123.8979],
    capacity: 120,
    floors: 2,
    exits: 2,
    riskLevel: 'LOW',
    lastDrillDate: '2025-08-30',
    notes: 'Annex learning space supporting Arts & Sciences classes and overflow seminars.',
  },
  {
    id: 'som-building-1',
    name: 'SOM Building 1',
    type: 'Academic',
    bounds: { south: 10.3218, north: 10.3241, west: 123.8969, east: 123.8987 },
    center: [10.3247, 123.8975],
    capacity: 180,
    floors: 3,
    exits: 3,
    riskLevel: 'LOW',
    lastDrillDate: '2025-08-20',
    notes: 'School of Management lecture halls. Ground floor has a wide corridor that serves as the main evacuation route.',
  },
  {
    id: 'som-admin',
    name: 'SOM Administration',
    type: 'Administrative',
    bounds: { south: 10.3218, north: 10.3237, west: 123.8972, east: 123.8983 },
    center: [10.3239, 123.8975],
    capacity: 120,
    floors: 2,
    exits: 2,
    riskLevel: 'LOW',
    lastDrillDate: '2025-07-10',
    notes: 'SOM administrative offices and faculty rooms. Connected to SOM Building 1 via covered walkway.',
  },
  {
    id: 'admin-building',
    name: 'Admin Building',
    type: 'Administrative',
    bounds: { south: 10.3212, north: 10.3234, west: 123.8977, east: 123.8988 },
    center: [10.3226, 123.8980],
    capacity: 150,
    floors: 2,
    exits: 3,
    riskLevel: 'MEDIUM',
    lastDrillDate: '2025-09-20',
    notes: 'Central administrative offices. Houses the registrar, cashier, and chancellor\'s office.',
  },
  {
    id: 'science-building',
    name: 'Science Building',
    type: 'Academic',
    bounds: { south: 10.3211, north: 10.3234, west: 123.8971, east: 123.8988 },
    center: [10.3226, 123.8961],
    capacity: 320,
    floors: 3,
    exits: 3,
    riskLevel: 'HIGH',
    lastDrillDate: '2025-10-12',
    notes: 'Core facility for natural sciences instruction. Contains chemistry, biology, and physics laboratories with stricter evacuation constraints.',
  },
  {
    id: 'as-west-wing',
    name: 'AS West Wing',
    type: 'Academic',
    bounds: { south: 10.3212, north: 10.3256, west: 123.8984, east: 123.9005 },
    center: [10.3252, 123.9000],
    capacity: 200,
    floors: 3,
    exits: 4,
    riskLevel: 'MEDIUM',
    lastDrillDate: '2025-10-05',
    notes: 'Arts and Sciences wing with laboratories. Chemical storage on 2nd floor requires extra caution during evacuation.',
  },
  {
    id: 'as-east-wing',
    name: 'AS East Wing',
    type: 'Academic',
    bounds: { south: 10.3212, north: 10.3250, west: 123.8985, east: 123.9007 },
    center: [10.3245, 123.9012],
    capacity: 220,
    floors: 3,
    exits: 4,
    riskLevel: 'MEDIUM',
    lastDrillDate: '2025-10-05',
    notes: 'Classrooms and research labs. Connected to West Wing via covered bridge on 2nd floor.',
  },
  {
    id: 'cultural-center',
    name: 'Cebu Cultural Center',
    type: 'Closed',
    bounds: { south: 10.3190, north: 10.3260, west: 123.8987, east: 123.8997 },
    center: [10.3225, 123.9015],
    capacity: 150,
    floors: 2,
    exits: 3,
    riskLevel: 'LOW',
    lastDrillDate: '2025-09-01',
    notes: 'Large cultural hall and performance venue on the eastern side of campus. Multiple exits open onto Gorordo Avenue.',
  },
  {
    id: 'up-cebu-library',
    name: 'UP Cebu Library',
    type: 'Academic',
    bounds: { south: 10.3204, north: 10.3224, west: 123.8962, east: 123.8997 },
    center: [10.3212, 123.8975],
    capacity: 100,
    floors: 2,
    exits: 2,
    riskLevel: 'LOW',
    lastDrillDate: '2025-09-05',
    notes: 'University library housing academic resources. Quiet zone with limited occupancy per floor.',
  },
  {
    id: 'liadlaw-hall',
    name: 'Liadlaw Hall',
    type: 'Academic',
    bounds: { south: 10.3201, north: 10.3231, west: 123.8962, east: 123.8988 },
    center: [10.3215, 123.8995],
    capacity: 140,
    floors: 2,
    exits: 3,
    riskLevel: 'LOW',
    lastDrillDate: '2025-08-28',
    notes: 'Multi-purpose academic hall used for lectures and public events. Wide central corridor aids evacuation.',
  },
  {
    id: 'up-high-school',
    name: 'UP High School – Cebu',
    type: 'Academic',
    bounds: { south: 10.3213, north: 10.3224, west: 123.8942, east: 123.9048 },
    center: [10.3218, 123.9020],
    capacity: 350,
    floors: 3,
    exits: 5,
    riskLevel: 'HIGH',
    lastDrillDate: '2025-11-15',
    notes: 'Largest building by occupancy. High student density during class hours. Multiple wing exits connect to the covered court and parking area.',
  },
]

const RISK_COLORS: Record<string, string> = {
  LOW: '#22c55e',
  MEDIUM: '#f59e0b',
  HIGH: '#ef4444',
}

function boundsCenter(b: BuildingBounds): [number, number] {
  return [(b.west + b.east) / 2, (b.south + b.north) / 2] // [lng, lat]
}

function getPlaceholderAnalytics(building: CampusBuilding): PlaceholderAnalytics {
  const occupancyRatio = building.riskLevel === 'HIGH' ? 0.86 : building.riskLevel === 'MEDIUM' ? 0.72 : 0.58
  const congestionStatus =
    building.riskLevel === 'HIGH' ? 'Critical' : building.riskLevel === 'MEDIUM' ? 'Moderate' : 'Stable'

  return {
    currentOccupancy: Math.max(1, Math.round(building.capacity * occupancyRatio)),
    avgEvacuationTimeMin: Number((building.floors * 1.4 + building.exits * 0.8).toFixed(1)),
    congestionStatus,
    drillReadiness: building.riskLevel === 'HIGH' ? 78 : building.riskLevel === 'MEDIUM' ? 85 : 93,
  }
}

export default function MapPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const [selected, setSelected] = useState<string | null>(null)
  const [forcedCenter, setForcedCenter] = useState<[number, number] | null>(null)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) window.location.href = '/auth'
  }, [isLoading, isAuthenticated])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelected(null)
        setForcedCenter([CAMPUS_CENTER[0], CAMPUS_CENTER[1]])
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const handleRecenterDefault = () => {
    setSelected(null)
    setForcedCenter([CAMPUS_CENTER[0], CAMPUS_CENTER[1]])
  }

  const building = useMemo(
    () => (selected ? CAMPUS_BUILDINGS.find((b) => b.id === selected) ?? null : null),
    [selected],
  )
  const analytics = useMemo(
    () => (building ? getPlaceholderAnalytics(building) : null),
    [building],
  )
  const riskColor = building ? RISK_COLORS[building.riskLevel] : '#22c55e'
  const panelOffset = building ? 416 : 0

  // When a building is selected, focus on its center so the map zooms/tilts to it.
  // Otherwise, use a forced recenter target or the campus center for the top view.
  const focusCenter: [number, number] | null = useMemo(() => {
    if (building) {
      return boundsCenter(building.bounds)
    }
    if (forcedCenter) return forcedCenter
    return CAMPUS_CENTER
  }, [building, forcedCenter])

  const handleSelectBuilding = useCallback((id: string) => {
    setForcedCenter(null)
    setSelected((current) => (current === id ? null : id))
  }, [])

  // Compact, label-less button marker anchored on each building's actual footprint.
  const markers: MapMarker[] = useMemo(
    () =>
      CAMPUS_BUILDINGS.map((b) => {
        const [lng, lat] = boundsCenter(b.bounds)
        return {
          id: b.id,
          label: b.name,
          lat,
          lng,
          compact: true,
          onClick: () => handleSelectBuilding(b.id),
        }
      }),
    [handleSelectBuilding],
  )

  // When a building is selected, tell MapView where to outline the Mapbox building footprint.
  const highlightAt: [number, number] | null = useMemo(() => {
    if (!building) return null
    const [lng, lat] = boundsCenter(building.bounds)
    return [lat, lng]
  }, [building])

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading...</span>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', padding: '88px 40px 56px', maxWidth: '1400px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
        <div style={{
          width: '44px', height: '44px', borderRadius: '12px',
          background: 'rgba(45,184,176,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
        </div>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)' }}>
            Campus Simulation Workspace
          </h1>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
            UP Cebu &middot; Lahug, Cebu City &middot; Select a building to start a drill
          </p>
        </div>
      </div>

      {/* Map + detail panel layout */}
      <div style={{
        position: 'relative',
        background: '#0f172a',
        border: '1px solid #1e293b',
        borderRadius: '14px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
        overflow: 'hidden',
        height: '640px',
      }}>
        {/* Map container */}
        <div style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
        }}>
          <button
            onClick={handleRecenterDefault}
            style={{
              position: 'absolute',
              right: '12px',
              bottom: '104px',
              zIndex: 1001,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '42px',
              height: '42px',
              borderRadius: '14px',
              border: '1px solid rgba(15,23,42,0.08)',
              background: '#ffffff',
              color: '#1e293b',
              cursor: 'pointer',
              boxShadow: '0 8px 20px rgba(15,23,42,0.18)',
              transform: `translateX(-${panelOffset}px)`,
              transition: 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.15s ease',
              willChange: 'transform',
            }}
            title="Recenter to default view"
            onMouseEnter={e => {
              e.currentTarget.style.transform = `translateX(-${panelOffset}px) translateY(-1px)`
              e.currentTarget.style.boxShadow = '0 10px 24px rgba(15,23,42,0.24)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = `translateX(-${panelOffset}px) translateY(0)`
              e.currentTarget.style.boxShadow = '0 8px 20px rgba(15,23,42,0.18)'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0f766e" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v3" />
              <path d="M12 19v3" />
              <path d="M4.93 4.93l2.12 2.12" />
              <path d="M16.95 16.95l2.12 2.12" />
              <path d="M2 12h3" />
              <path d="M19 12h3" />
              <path d="M4.93 19.07l2.12-2.12" />
              <path d="M16.95 7.05l2.12-2.12" />
              <circle cx="12" cy="12" r="4" />
            </svg>
          </button>
          <MapView
            markers={markers}
            flat2d={!selected}
            focusCenter={focusCenter}
            highlightAt={highlightAt}
            uiOffsetRight={panelOffset}
          />
        </div>

        {/* Detail panel — slides in from right */}
        <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            width: '400px',
            background: 'linear-gradient(180deg, rgba(241,245,249,0.97) 0%, rgba(232,240,247,0.95) 100%)',
            borderLeft: '1px solid rgba(148,163,184,0.24)',
            borderRadius: '0 14px 14px 0',
            boxShadow: 'inset 1px 0 0 rgba(255,255,255,0.35)',
            display: 'flex', flexDirection: 'column',
            maxHeight: '100%',
            overflowY: 'auto',
            zIndex: 1000,
            opacity: building ? 1 : 0,
            pointerEvents: building ? 'auto' : 'none',
            transform: building ? 'translateX(0)' : 'translateX(104%)',
            transition: 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease',
            willChange: 'transform, opacity',
            backdropFilter: 'blur(10px)',
          }}>
          {building && (
            <>
            {/* Accent bar at top */}
            <div style={{ height: '3px', background: `linear-gradient(90deg, ${riskColor}, #2db8b0)`, borderRadius: '0 14px 0 0' }} />

            {/* Header */}
            <div style={{ padding: '20px 22px 0' }}>
              {/* Close */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                <div style={{ flex: 1 }}>
                  <h2 style={{ margin: '0 0 2px', fontSize: '20px', fontWeight: '700', color: '#0f172a', lineHeight: 1.3 }}>
                    {building.name}
                  </h2>
                  <p style={{ margin: '0', fontSize: '12px', color: '#64748b' }}>
                    UP Cebu &middot; Lahug, Cebu City
                  </p>
                </div>
                <button onClick={() => setSelected(null)} style={{
                  width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
                  background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(148,163,184,0.24)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: '#64748b', transition: 'background 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.95)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.72)'}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>

              {/* Badges */}
              <div style={{ display: 'flex', gap: '8px', margin: '14px 0 16px', flexWrap: 'wrap' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  padding: '4px 12px', borderRadius: '20px',
                  background: 'rgba(45,184,176,0.1)', color: '#2db8b0',
                  fontSize: '11px', fontWeight: '600',
                  border: '1px solid rgba(45,184,176,0.2)',
                }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                  {building.type}
                </span>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  padding: '4px 12px', borderRadius: '20px',
                  background: `${riskColor}15`,
                  color: riskColor,
                  fontSize: '11px', fontWeight: '600',
                  border: `1px solid ${riskColor}40`,
                }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
                  {building.riskLevel} RISK
                </span>
              </div>
            </div>

            {/* Prominent stat: Capacity */}
            <div style={{
              margin: '0 22px 16px', padding: '20px',
              background: 'rgba(255,255,255,0.58)',
              border: '1px solid rgba(148,163,184,0.18)',
              borderRadius: '12px', textAlign: 'center',
              boxShadow: '0 10px 24px rgba(15,23,42,0.06)',
            }}>
              <div style={{ fontSize: '42px', fontWeight: '800', color: '#2db8b0', lineHeight: 1, marginBottom: '4px' }}>
                {building.capacity}
              </div>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Max Occupancy
              </div>
            </div>

            {/* Description */}
            <div style={{ padding: '0 22px 16px' }}>
              <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: 1.7 }}>
                {building.notes}
              </p>
            </div>

            {/* Placeholder analytics */}
            {analytics && (
              <div style={{ padding: '0 22px 16px' }}>
                <div style={{
                  padding: '14px 16px',
                  background: 'rgba(255,255,255,0.58)',
                  border: '1px solid rgba(45,184,176,0.16)',
                  borderRadius: '12px',
                  boxShadow: '0 10px 24px rgba(15,23,42,0.05)',
                }}>
                  <div style={{ fontSize: '11px', color: '#2db8b0', fontWeight: '700', letterSpacing: '0.7px', marginBottom: '10px' }}>
                    BUILDING ANALYTICS (PLACEHOLDER)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div style={{ fontSize: '12px', color: '#475569' }}>Current Occupancy</div>
                    <div style={{ fontSize: '12px', color: '#0f172a', fontWeight: '600', textAlign: 'right' }}>{analytics.currentOccupancy}</div>
                    <div style={{ fontSize: '12px', color: '#475569' }}>Avg Evacuation Time</div>
                    <div style={{ fontSize: '12px', color: '#0f172a', fontWeight: '600', textAlign: 'right' }}>{analytics.avgEvacuationTimeMin} min</div>
                    <div style={{ fontSize: '12px', color: '#475569' }}>Congestion Status</div>
                    <div style={{ fontSize: '12px', color: '#0f172a', fontWeight: '600', textAlign: 'right' }}>{analytics.congestionStatus}</div>
                    <div style={{ fontSize: '12px', color: '#475569' }}>Drill Readiness</div>
                    <div style={{ fontSize: '12px', color: '#0f172a', fontWeight: '600', textAlign: 'right' }}>{analytics.drillReadiness}%</div>
                  </div>
                </div>
              </div>
            )}

            {/* Divider */}
            <div style={{ height: '1px', background: 'rgba(148,163,184,0.18)', margin: '0 22px 16px' }} />

            {/* Stats grid */}
            <div style={{ padding: '0 22px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                {/* Floors */}
                <div style={{
                  padding: '16px', background: 'rgba(255,255,255,0.58)', borderRadius: '12px',
                  border: '1px solid rgba(148,163,184,0.16)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                  boxShadow: '0 10px 24px rgba(15,23,42,0.05)',
                }}>
                  <svg width="64" height="64" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r="24" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
                    <circle cx="32" cy="32" r="24" fill="none" stroke="#f59e0b" strokeWidth="5"
                      strokeDasharray={`${(building.floors / 5) * 150.8} 150.8`}
                      strokeLinecap="round" transform="rotate(-90 32 32)" />
                    <text x="32" y="30" textAnchor="middle" fill="#0f172a" fontSize="16" fontWeight="700">{building.floors}</text>
                    <text x="32" y="42" textAnchor="middle" fill="#64748b" fontSize="7" fontWeight="500">levels</text>
                  </svg>
                  <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Floors</span>
                </div>

                {/* Exits */}
                <div style={{
                  padding: '16px', background: 'rgba(255,255,255,0.58)', borderRadius: '12px',
                  border: '1px solid rgba(148,163,184,0.16)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                  boxShadow: '0 10px 24px rgba(15,23,42,0.05)',
                }}>
                  <svg width="64" height="64" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r="24" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
                    <circle cx="32" cy="32" r="24" fill="none" stroke={riskColor} strokeWidth="5"
                      strokeDasharray={`${(building.exits / 6) * 150.8} 150.8`}
                      strokeLinecap="round" transform="rotate(-90 32 32)" />
                    <text x="32" y="30" textAnchor="middle" fill="#0f172a" fontSize="16" fontWeight="700">{building.exits}</text>
                    <text x="32" y="42" textAnchor="middle" fill="#64748b" fontSize="7" fontWeight="500">exits</text>
                  </svg>
                  <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Exit Points</span>
                </div>
              </div>

              {/* Last drill */}
              <div style={{
                padding: '14px 16px', background: 'rgba(255,255,255,0.58)', borderRadius: '12px',
                border: '1px solid rgba(148,163,184,0.16)',
                display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px',
                boxShadow: '0 10px 24px rgba(15,23,42,0.05)',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <div>
                  <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>Last Evacuation Drill</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>
                    {new Date(building.lastDrillDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
              </div>
            </div>

            {/* Run Simulation button */}
            <div style={{ padding: '0 22px 20px' }}>
              <button
                onClick={() => router.push(`/simulate/${encodeURIComponent(building.id)}/disaster`)}
                style={{
                  width: '100%', padding: '14px 20px',
                  background: 'linear-gradient(135deg, #2db8b0 0%, #1a9e97 100%)',
                  border: 'none', borderRadius: '12px',
                  color: '#fff', fontSize: '14px', fontWeight: '700',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                  boxShadow: '0 4px 16px rgba(45,184,176,0.3)',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(45,184,176,0.4)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(45,184,176,0.3)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                Run Simulation
              </button>
            </div>
            </>
          )}
        </div>
      </div>

      <p style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
        Map powered by <a href="https://www.mapbox.com" target="_blank" rel="noreferrer" style={{ color: '#2db8b0' }}>Mapbox</a> &middot; Data &copy; <a href="https://www.openstreetmap.org" target="_blank" rel="noreferrer" style={{ color: '#2db8b0' }}>OpenStreetMap</a> contributors.
      </p>
    </div>
  )
}
