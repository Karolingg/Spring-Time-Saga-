'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/src/hooks/useAuth'
import MapView, { type AssemblyMarker, type MapMarker } from '@/components/MapView'
import {BUILDING_FLOOR_COUNT} from '@/src/config/building-floor-counts'
import { ASSEMBLY_POINTS, getNearestAssembly } from '@/src/config/assembly-points'
import { getBuildingScore, type BuildingGrade, type BuildingScore, type FloorScore } from '@/src/services/building-analytics.service'

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
  status: 'available' | 'closed' | 'coming soon'
}

/**
 * Campus building list. Intentionally hardcoded — the app is scoped to a
 * single, fixed university campus, so this set never changes at runtime.
 * There is deliberately no buildings DB table / admin UI: a closed,
 * known-at-build-time list does not need one. Edit this array to change
 * which buildings appear on the map.
 */
const CAMPUS_BUILDINGS: CampusBuilding[] = [
  {
    id: 'social-sciences',
    name: 'Social Sciences Building',
    type: 'Academic',
    bounds: { south: 10.3221, north: 10.3250, west: 123.8970, east: 123.8987 },
    center: [10.3256, 123.8975],
    capacity: 180,
    floors: 2,
    exits: 3,
    riskLevel: 'LOW',
    lastDrillDate: '2025-09-12',
    notes: 'Houses social science classrooms and faculty offices. Main exit leads to the campus quadrangle.',
    status: 'available',
  },
  {
    id: 'asx',
    name: 'ASX Building',
    type: 'Academic',
    bounds: { south: 10.3237, north: 10.3242, west: 123.8978, east: 123.8981 },
    center: [10.3239, 123.8979],
    capacity: 120,
    floors: 2,
    exits: 2,
    riskLevel: 'LOW',
    lastDrillDate: '2025-08-30',
    notes: 'Annex learning space supporting Arts & Sciences classes and overflow seminars.',
    status: 'available',
  },
  {
    id: 'som-building-1',
    name: 'SOM Building 1',
    type: 'Academic',
    bounds: { south: 10.3218, north: 10.3243, west: 123.8968, east: 123.8987 },
    center: [10.3247, 123.8975],
    capacity: 180,
    floors: 3,
    exits: 3,
    riskLevel: 'LOW',
    lastDrillDate: '2025-08-20',
    notes: 'School of Management lecture halls. Ground floor has a wide corridor that serves as the main evacuation route.',
    status: 'available',
  },
  {
    id: 'management',
    name: 'Management Building',
    type: 'Administrative',
    bounds: { south: 10.3218, north: 10.3233, west: 123.8971, east: 123.8984 },
    center: [10.3239, 123.8975],
    capacity: 120,
    floors: 2,
    exits: 2,
    riskLevel: 'LOW',
    lastDrillDate: '2025-07-10',
    notes: 'SOM administrative offices and faculty rooms. Connected to SOM Building 1 via covered walkway.',
    status: 'available',
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
    status: 'available',
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
    status: 'available',
  },
  {
    id: 'as-west-wing',
    name: 'AS West Wing',
    type: 'Academic',
    bounds: { south: 10.3212, north: 10.3257, west: 123.8984, east: 123.9005 },
    center: [10.3252, 123.9000],
    capacity: 200,
    floors: 3,
    exits: 4,
    riskLevel: 'MEDIUM',
    lastDrillDate: '2025-10-05',
    notes: 'Arts and Sciences wing with laboratories. Chemical storage on 2nd floor requires extra caution during evacuation.',
    status: 'available',
  },
  {
    id: 'as-east-wing',
    name: 'AS East Wing',
    type: 'Academic',
    bounds: { south: 10.3212, north: 10.3251, west: 123.8985, east: 123.9007 },
    center: [10.3245, 123.9012],
    capacity: 220,
    floors: 3,
    exits: 4,
    riskLevel: 'MEDIUM',
    lastDrillDate: '2025-10-05',
    notes: 'Classrooms and research labs. Connected to West Wing via covered bridge on 2nd floor.',
    status: 'available',
  },
  {
    id: 'cultural-center',
    name: 'Cebu Cultural Center',
    type: 'Closed',
    bounds: { south: 10.3190, north: 10.3260, west: 123.8987, east: 123.8997 },
    center: [10.3225, 123.9015],
    capacity: 0,
    floors: 1,
    exits: 1,
    riskLevel: 'N/A',
    lastDrillDate: 'N/A',
    notes: 'Large cultural hall and performance venue on the eastern side of campus. Multiple exits open onto Gorordo Avenue.',
    status: 'closed',
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
    status: 'available',
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
    status: 'available',
  },
  {
    id: 'up-high-school',
    name: 'UP High School – Cebu',
    type: 'Academic',
    bounds: { south: 10.3197, north: 10.3238, west: 123.8930, east: 123.9063 },
    center: [10.3218, 123.9020],
    capacity: 350,
    floors: 3,
    exits: 5,
    riskLevel: 'HIGH',
    lastDrillDate: '2025-11-15',
    notes: 'Largest building by occupancy. High student density during class hours. Multiple wing exits connect to the covered court and parking area.',
    status: 'coming soon',
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

/** Color band used for the Evacuation Readiness Score badge.
 *  A/B green-ish, C amber, D orange, F red. */
function gradeAccent(grade: BuildingGrade): string {
  switch (grade) {
    case 'A': return '#16a34a'
    case 'B': return '#22c55e'
    case 'C': return '#f59e0b'
    case 'D': return '#f97316'
    case 'F': return '#ef4444'
  }
}

export default function MapPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const [selected, setSelected] = useState<string | null>(null)
  const [forcedCenter, setForcedCenter] = useState<[number, number] | null>(null)
  const [selectedAssembly, setSelectedAssembly] = useState<string | null>(null)
  const [assemblyPopupPos, setAssemblyPopupPos] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) window.location.href = '/auth'
  }, [isLoading, isAuthenticated])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelected(null)
        setSelectedAssembly(null)
        setAssemblyPopupPos(null)
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

  // Real building drill metrics, pulled from completed simulation runs.
  // Replaces the previous fake placeholder analytics — when no runs exist
  // for a building we render an explicit "no data" state rather than fabricating.
  // `loadedScoreId` is the buildingId whose score is currently held in state;
  // we render `buildingScore` only when that id matches the selected building
  // (otherwise we show the loading state) — avoids a synchronous setState
  // reset inside the effect.
  const [buildingScore, setBuildingScore] = useState<BuildingScore | null>(null)
  const [loadedScoreId, setLoadedScoreId] = useState<string | null>(null)
  useEffect(() => {
    if (!building) return
    let cancelled = false
    getBuildingScore(building.id, building.capacity)
      .then((score) => {
        if (cancelled) return
        setBuildingScore(score)
        setLoadedScoreId(building.id)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('Failed to load building score:', err)
        setBuildingScore(null)
        setLoadedScoreId(building.id)
      })
    return () => { cancelled = true }
  }, [building])
  const activeScore = building && loadedScoreId === building.id ? buildingScore : null
  const scoreLoading = Boolean(building) && loadedScoreId !== building?.id

  // Nearest evacuation assembly area for the currently selected building.
  const nearestAssembly = useMemo(() => {
    if (!building) return null
    const [lng, lat] = boundsCenter(building.bounds)
    return getNearestAssembly([lat, lng])
  }, [building])

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


  const handleAssemblyClick = useCallback((id: string) => {
    setSelectedAssembly(id)
    // Locate the marker by its stable data-assembly-id (more robust than
    // matching on `title`, since some assembly names are empty / duplicates).
    const mapContainer = document.querySelector('.map-view-shell')
    const marker = mapContainer?.querySelector(`[data-assembly-id="${id}"]`)
    if (marker) {
      const rect = marker.getBoundingClientRect()
      setAssemblyPopupPos({
        x: rect.left + rect.width / 2,
        y: rect.top,
      })
      return
    }
    // Fallback if the marker isn't in the DOM yet (race on first render)
    setAssemblyPopupPos({ x: window.innerWidth / 2, y: 100 })
  }, [])

  // Distinct green markers for designated muster points. The marker for the
  // currently selected building's nearest assembly is highlighted so the
  // user sees at a glance where occupants of that building should gather.
  const assemblyMarkers: AssemblyMarker[] = useMemo(
    () =>
      ASSEMBLY_POINTS.map((p) => ({
        id: p.id,
        name: p.name,
        lat: p.position[0],
        lng: p.position[1],
        highlighted: nearestAssembly?.point.id === p.id,
        onClick: () => handleAssemblyClick(p.id),
      })),
    [handleAssemblyClick, nearestAssembly],
  )

  const selectedAssemblyData = selectedAssembly 
    ? ASSEMBLY_POINTS.find(p => p.id === selectedAssembly)
    : null

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
            Campus Map Display
          </h1>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
            UP Cebu &middot; Lahug, Cebu City &middot; Click a building for details
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
            assemblyMarkers={assemblyMarkers}
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

            {/* Building Image Placeholder */}
            <div style={{ padding: '0 22px 16px' }}>
              <div style={{
                width: '100%',
                height: '180px',
                background: 'rgba(148,163,184,0.1)',
                borderRadius: '12px',
                border: '1px dashed rgba(148,163,184,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94a3b8',
                fontSize: '13px',
                overflow: 'hidden'
              }}>
                <img 
                  src={`/floorplans/${building.id}.png`}
                  alt={`${building.name} floorplan`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              </div>
            </div>

            {/* Description */}
            <div style={{ padding: '0 22px 16px' }}>
              <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: 1.7 }}>
                {building.notes}
              </p>
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

            {/* Evacuation Readiness Score — real metrics aggregated from
                saved simulation runs. Shows an empty state when the building
                has no drills yet, rather than fabricating numbers. */}
            <div style={{ padding: '0 22px 16px' }}>
              <div style={{
                padding: '16px',
                background: 'rgba(255,255,255,0.62)',
                border: '1px solid rgba(45,184,176,0.16)',
                borderRadius: '12px',
                boxShadow: '0 10px 24px rgba(15,23,42,0.05)',
              }}>
                <div style={{ fontSize: '11px', color: '#2db8b0', fontWeight: '700', letterSpacing: '0.7px', marginBottom: '12px' }}>
                  EVACUATION READINESS
                </div>
                {scoreLoading ? (
                  <div style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', padding: '14px 0' }}>
                    Loading drill data&hellip;
                  </div>
                ) : activeScore ? (
                  <>
                    {/* Big grade + score */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
                      <div style={{
                        width: '52px', height: '52px', borderRadius: '12px',
                        background: gradeAccent(activeScore.grade),
                        color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em',
                        boxShadow: `0 6px 16px ${gradeAccent(activeScore.grade)}55`,
                      }}>
                        {activeScore.grade}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
                          {activeScore.score}
                          <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600, marginLeft: '4px' }}>/100</span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '5px' }}>
                          Based on {activeScore.runCount} {activeScore.runCount === 1 ? 'drill' : 'drills'}
                          {activeScore.cap && (
                            <span style={{ color: '#92400e', fontWeight: 700 }}>
                              {' '}&middot; capped from {activeScore.rawScore}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Coverage strip — three pills showing how many drills
                        of each severity have been run on this building.
                        Drives the cap below. */}
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
                      {([
                        { key: 'severe',   label: 'Severe',   color: '#ef4444', count: activeScore.coverage.severe },
                        { key: 'moderate', label: 'Moderate', color: '#f97316', count: activeScore.coverage.moderate },
                        { key: 'minor',    label: 'Minor',    color: '#3b82f6', count: activeScore.coverage.minor + activeScore.coverage.unclassified },
                      ] as const).map((bucket) => (
                        <div key={bucket.key} style={{
                          flex: 1,
                          padding: '6px 8px',
                          borderRadius: '8px',
                          background: bucket.count > 0 ? `${bucket.color}14` : 'rgba(148,163,184,0.12)',
                          border: `1px solid ${bucket.count > 0 ? `${bucket.color}40` : 'rgba(148,163,184,0.2)'}`,
                          textAlign: 'center',
                        }}>
                          <div style={{
                            fontSize: '9px', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase',
                            color: bucket.count > 0 ? bucket.color : '#94a3b8',
                          }}>
                            {bucket.label}
                          </div>
                          <div style={{
                            fontSize: '15px', fontWeight: 800,
                            color: bucket.count > 0 ? '#0f172a' : '#94a3b8',
                            lineHeight: 1.2, marginTop: '2px',
                          }}>
                            {bucket.count}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Cap warning — explains *why* the grade is capped, so a
                        stakeholder sees the missing coverage at a glance. */}
                    {activeScore.cap && (
                      <div style={{
                        padding: '8px 10px',
                        borderRadius: '8px',
                        background: '#fff7ed',
                        border: '1px solid #fed7aa',
                        marginBottom: '12px',
                        display: 'flex', alignItems: 'flex-start', gap: '8px',
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '1px' }}>
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                          <line x1="12" y1="9" x2="12" y2="13" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        <div style={{ fontSize: '11px', color: '#9a3412', lineHeight: 1.5 }}>
                          {activeScore.cap.reason}
                        </div>
                      </div>
                    )}
                    {/* Building-level metric breakdown */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: '6px', columnGap: '12px', fontSize: '12px' }}>
                      <div style={{ color: '#475569' }}>Avg evacuated</div>
                      <div style={{ color: '#0f172a', fontWeight: 600, textAlign: 'right' }}>{Math.round(activeScore.avgEvacuationRate * 100)}%</div>
                      <div style={{ color: '#475569' }}>Avg evac time</div>
                      <div style={{ color: '#0f172a', fontWeight: 600, textAlign: 'right' }}>{Math.round(activeScore.avgEvacuationTime)}s</div>
                      <div style={{ color: '#475569' }}>Avg bottlenecks</div>
                      <div style={{ color: '#0f172a', fontWeight: 600, textAlign: 'right' }}>{activeScore.avgBottlenecks.toFixed(1)}</div>
                      <div style={{ color: '#475569' }}>Peak density</div>
                      <div style={{ color: '#0f172a', fontWeight: 600, textAlign: 'right' }}>{Math.round(activeScore.avgPeakDensity * 100)}%</div>
                    </div>

                    {/* Per-floor breakdown — only shown when runs carry a floor_index */}
                    {activeScore.floorBreakdown.length > 0 && (
                      <div style={{
                        marginTop: '14px',
                        paddingTop: '12px',
                        borderTop: '1px solid rgba(148,163,184,0.2)',
                      }}>
                        <div style={{
                          fontSize: '10px', color: '#94a3b8', fontWeight: 700,
                          letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: '10px',
                        }}>
                          Floor Breakdown
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                          {activeScore.floorBreakdown.map((floor: FloorScore) => (
                            <div key={floor.floorIndex} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {/* Floor label */}
                              <div style={{
                                fontSize: '11px', color: '#64748b', fontWeight: 600,
                                width: '52px', flexShrink: 0,
                              }}>
                                {floor.floorIndex === 1 ? 'Ground' : `Floor ${floor.floorIndex}`}
                              </div>

                              {/* Score bar */}
                              <div style={{
                                flex: 1,
                                height: '6px',
                                background: 'rgba(148,163,184,0.22)',
                                borderRadius: '3px',
                                overflow: 'hidden',
                              }}>
                                <div style={{
                                  height: '100%',
                                  width: `${floor.score}%`,
                                  background: gradeAccent(floor.grade),
                                  borderRadius: '3px',
                                  transition: 'width 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
                                }} />
                              </div>

                              {/* Score number */}
                              <div style={{
                                fontSize: '11px', color: '#334155', fontWeight: 700,
                                width: '26px', textAlign: 'right', flexShrink: 0,
                              }}>
                                {floor.score}
                              </div>

                              {/* Grade badge */}
                              <div style={{
                                width: '22px', height: '22px', borderRadius: '6px',
                                background: gradeAccent(floor.grade),
                                color: '#fff',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '10px', fontWeight: 800, flexShrink: 0,
                                boxShadow: `0 2px 6px ${gradeAccent(floor.grade)}55`,
                              }}>
                                {floor.grade}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '8px', lineHeight: 1.5 }}>
                          Building score is the average of all floor scores.
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', padding: '10px 0', lineHeight: 1.7 }}>
                    No drill data yet.
                    <div style={{ fontSize: '11px', marginTop: '2px' }}>
                      Run a simulation to generate a score.
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Nearest evacuation assembly point */}
            {nearestAssembly && (
              <div style={{ padding: '0 22px 16px' }}>
                <div style={{
                  padding: '14px 16px',
                  background: 'rgba(255,255,255,0.62)',
                  border: '1px solid rgba(34,197,94,0.22)',
                  borderRadius: '12px',
                  boxShadow: '0 10px 24px rgba(15,23,42,0.05)',
                }}>
                  <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: '700', letterSpacing: '0.7px', marginBottom: '10px' }}>
                    NEAREST ASSEMBLY POINT
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '38px', height: '38px', borderRadius: '10px',
                      background: '#22c55e',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 4px 10px rgba(34,197,94,0.35)',
                      flexShrink: 0,
                    }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="9" cy="8" r="3.2" />
                        <circle cx="17" cy="9" r="2.4" />
                        <path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
                        <path d="M14.5 20c0-2.3 1.9-3.8 4.2-3.8" />
                      </svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', lineHeight: 1.3 }}>
                        {nearestAssembly.point.name}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
                        {Math.round(nearestAssembly.distance)} m away &middot; capacity {nearestAssembly.point.capacity}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Divider */}
            <div style={{ height: '1px', background: 'rgba(148,163,184,0.18)', margin: '0 22px 16px' }} />

            {/* Stats grid */}
            <div style={{ padding: '0 22px' }}>
              {building.status === 'available' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                  {/* Floors */}
                  <div style={{
                    padding: '16px', background: 'rgba(255,255,255,0.58)', borderRadius: '12px',
                    border: '1px solid rgba(148,163,184,0.16)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                    boxShadow: '0 10px 24px rgba(15,23,42,0.05)',
                  }}>
                    <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', paddingTop: '18px' }}>Floors</span>
                    <span style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', paddingTop: '12px' }}>{BUILDING_FLOOR_COUNT[building.id]}</span>
                  </div>

                  {/* Exits */}
                  <div style={{
                    padding: '16px', background: 'rgba(255,255,255,0.58)', borderRadius: '12px',
                    border: '1px solid rgba(148,163,184,0.16)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                    boxShadow: '0 10px 24px rgba(15,23,42,0.05)',
                  }}>
                    <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', paddingTop: '18px' }}>Exit Points</span>
                    <span style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', paddingTop: '12px' }}>{building.exits}</span>
                  </div>
                </div>
              ) : (
                <div style={{
                  padding: '24px',
                  background: 'rgba(148,163,184,0.1)',
                  borderRadius: '12px',
                  textAlign: 'center',
                  color: '#64748b',
                  marginBottom: '16px',
                }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {building.status === 'closed' ? 'Currently Closed' : 'Coming Soon'}
                  </div>
                </div>
              )}
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
                disabled={building.status !== 'available'}
                onClick={() => router.push(`/simulate/${encodeURIComponent(building.id)}/disaster`)}
                style={{
                  width: '100%', padding: '14px 20px',
                  background: building.status === 'available' ? 'linear-gradient(135deg, #2db8b0 0%, #1a9e97 100%)' : 'rgba(148,163,184,0.3)',
                  border: 'none', borderRadius: '12px',
                  color: building.status === 'available' ? '#fff' : '#94a3b8', 
                  fontSize: '14px', fontWeight: '700',
                  cursor: building.status === 'available' ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                  boxShadow: building.status === 'available' ? '0 4px 16px rgba(45,184,176,0.3)' : 'none',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={e => { 
                  if (building.status === 'available') {
                    e.currentTarget.style.transform = 'translateY(-1px)'; 
                    e.currentTarget.style.boxShadow = '0 6px 24px rgba(45,184,176,0.4)'
                  }
                }}
                onMouseLeave={e => { 
                  if (building.status === 'available') {
                    e.currentTarget.style.transform = 'translateY(0)'; 
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(45,184,176,0.3)'
                  }
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                {building.status === 'available' ? 'Run Simulation' : 'Not Available'}
              </button>
            </div>
            </>
          )}
        </div>
      </div>

      {/* Assembly point speech-bubble popup — floats directly above the marker icon */}
      {selectedAssemblyData && assemblyPopupPos && (
        <>
          {/* Invisible backdrop to dismiss on outside click */}
          <div
            onClick={() => { setSelectedAssembly(null); setAssemblyPopupPos(null) }}
            style={{ position: 'fixed', inset: 0, zIndex: 1999 }}
          />

          {/* Speech bubble */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              left: `${assemblyPopupPos.x}px`,
              top: `${assemblyPopupPos.y}px`,
              transform: 'translate(-50%, -100%) translateY(-18px)',
              zIndex: 2000,
              width: '220px',
              background: '#ffffff',
              borderRadius: '18px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)',
              overflow: 'visible',
              animation: 'assemblyBubbleIn 0.18s ease-out',
            }}
          >
            {/* Bubble content */}
            <div style={{ padding: '12px' }}>
              {/* Image frame */}
              {selectedAssemblyData.image ? (
                <img
                  src={selectedAssemblyData.image}
                  alt={selectedAssemblyData.name}
                  style={{
                    width: '100%',
                    height: '130px',
                    objectFit: 'cover',
                    borderRadius: '12px',
                    border: '1px solid #f0f0f0',
                  }}
                />
              ) : (
                <div style={{
                  width: '100%',
                  height: '130px',
                  background: 'linear-gradient(135deg, #f8fafb 0%, #eef2f5 100%)',
                  borderRadius: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  border: '1.5px dashed #d1d5db',
                }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <path d="M21 15l-5-5L5 21"/>
                  </svg>
                  <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 500 }}>Evacuation area photo</span>
                </div>
              )}

              {/* Name + capacity — compact */}
              <div style={{ marginTop: '8px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#1a2332', lineHeight: 1.2 }}>
                  {selectedAssemblyData.name?.trim() || 'Assembly Point'}
                </div>
                <div style={{
                  marginTop: '4px', fontSize: '11px', color: '#64748b', lineHeight: 1.3,
                }}>
                  {selectedAssemblyData.description}
                </div>
                <div style={{
                  marginTop: '6px',
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  fontSize: '10px', fontWeight: 600, color: '#2db8b0',
                  background: 'rgba(45,184,176,0.08)',
                  padding: '3px 8px', borderRadius: '6px',
                }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="9" cy="8" r="3.2" />
                    <path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
                  </svg>
                  {selectedAssemblyData.capacity} capacity
                </div>
              </div>
            </div>

            {/* Triangle tail — points down toward the marker icon */}
            <div style={{
              position: 'absolute',
              bottom: '-10px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0, height: 0,
              borderLeft: '11px solid transparent',
              borderRight: '11px solid transparent',
              borderTop: '11px solid #ffffff',
              filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.06))',
            }} />
          </div>
        </>
      )}

      <p style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
        Map powered by <a href="https://www.mapbox.com" target="_blank" rel="noreferrer" style={{ color: '#2db8b0' }}>Mapbox</a> &middot; Data &copy; <a href="https://www.openstreetmap.org" target="_blank" rel="noreferrer" style={{ color: '#2db8b0' }}>OpenStreetMap</a> contributors.
      </p>
    </div>
  )
}
