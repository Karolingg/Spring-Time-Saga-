'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/src/hooks/useAuth'
import type { MapRegion } from '@/components/MapView'

const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => (
    <div style={{
      height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0f172a', borderRadius: '12px', color: '#94a3b8', fontSize: '14px', gap: '10px',
    }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
      Loading map...
    </div>
  ),
})

/* ── Building data ── */
interface CampusBuilding {
  id: string
  name: string
  type: string
  polygon: [number, number][]
  capacity: number
  floors: number
  exits: number
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  lastDrillDate: string
  notes: string
}

const CAMPUS_BUILDINGS: CampusBuilding[] = [
  {
    id: 'social-sciences',
    name: 'Social Sciences Building',
    type: 'Academic',
    polygon: [
      [10.3259, 123.8965],
      [10.3259, 123.8975],
      [10.3253, 123.8975],
      [10.3253, 123.8965],
    ],
    capacity: 180,
    floors: 2,
    exits: 3,
    riskLevel: 'LOW',
    lastDrillDate: '2025-09-12',
    notes: 'Houses social science classrooms and faculty offices. Main exit leads to the campus quadrangle.',
  },
  {
    id: 'arts-design',
    name: 'Arts and Design Workshop',
    type: 'Academic',
    polygon: [
      [10.3253, 123.8965],
      [10.3253, 123.8975],
      [10.3247, 123.8975],
      [10.3247, 123.8965],
    ],
    capacity: 100,
    floors: 2,
    exits: 2,
    riskLevel: 'LOW',
    lastDrillDate: '2025-08-15',
    notes: 'Art studios and workshops. Contains flammable materials in the painting studio area.',
  },
  {
    id: 'som-building-1',
    name: 'SOM Building 1',
    type: 'Academic',
    polygon: [
      [10.3249, 123.8972],
      [10.3249, 123.8982],
      [10.3243, 123.8982],
      [10.3243, 123.8972],
    ],
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
    polygon: [
      [10.3243, 123.8972],
      [10.3243, 123.8982],
      [10.3237, 123.8982],
      [10.3237, 123.8972],
    ],
    capacity: 120,
    floors: 2,
    exits: 2,
    riskLevel: 'LOW',
    lastDrillDate: '2025-07-10',
    notes: 'SOM administrative offices and faculty rooms. Connected to SOM Building 1 via covered walkway.',
  },
  {
    id: 'som-building-2',
    name: 'SOM Building 2',
    type: 'Academic',
    polygon: [
      [10.3237, 123.8972],
      [10.3237, 123.8982],
      [10.3231, 123.8982],
      [10.3231, 123.8972],
    ],
    capacity: 160,
    floors: 2,
    exits: 3,
    riskLevel: 'LOW',
    lastDrillDate: '2025-08-20',
    notes: 'Connected to SOM Building 1 via covered walkway. Faculty offices on the second floor.',
  },
  {
    id: 'volleyball-court',
    name: 'UPC Volleyball Court',
    type: 'Recreational',
    polygon: [
      [10.3251, 123.8982],
      [10.3251, 123.8992],
      [10.3243, 123.8992],
      [10.3243, 123.8982],
    ],
    capacity: 200,
    floors: 1,
    exits: 4,
    riskLevel: 'LOW',
    lastDrillDate: '2025-06-05',
    notes: 'Open-air volleyball court. Can serve as a secondary evacuation assembly point.',
  },
  {
    id: 'as-west-wing',
    name: 'AS West Wing',
    type: 'Academic',
    polygon: [
      [10.3256, 123.8992],
      [10.3256, 123.9005],
      [10.3248, 123.9005],
      [10.3248, 123.8992],
    ],
    capacity: 200,
    floors: 3,
    exits: 4,
    riskLevel: 'MEDIUM',
    lastDrillDate: '2025-10-05',
    notes: 'Arts and Sciences wing with laboratories. Chemical storage on 2nd floor requires extra caution during evacuation.',
  },
  {
    id: 'union-building',
    name: 'Union Building',
    type: 'Administrative',
    polygon: [
      [10.3260, 123.9005],
      [10.3260, 123.9018],
      [10.3252, 123.9018],
      [10.3252, 123.9005],
    ],
    capacity: 150,
    floors: 2,
    exits: 3,
    riskLevel: 'LOW',
    lastDrillDate: '2025-09-01',
    notes: 'Student union offices and activity rooms. Central location provides quick access to multiple evacuation routes.',
  },
  {
    id: 'as-east-wing',
    name: 'AS East Wing',
    type: 'Academic',
    polygon: [
      [10.3250, 123.9005],
      [10.3250, 123.9018],
      [10.3242, 123.9018],
      [10.3242, 123.9005],
    ],
    capacity: 220,
    floors: 3,
    exits: 4,
    riskLevel: 'MEDIUM',
    lastDrillDate: '2025-10-05',
    notes: 'Classrooms and research labs. Connected to West Wing via covered bridge on 2nd floor.',
  },
  {
    id: 'soccer-field',
    name: 'UPC Soccer Field',
    type: 'Recreational',
    polygon: [
      [10.3244, 123.9018],
      [10.3244, 123.9038],
      [10.3232, 123.9038],
      [10.3232, 123.9018],
    ],
    capacity: 500,
    floors: 1,
    exits: 4,
    riskLevel: 'LOW',
    lastDrillDate: '2025-06-10',
    notes: 'Open field used as the primary evacuation assembly point for the upper campus. Wide clearance on all sides.',
  },
  {
    id: 'admin-building',
    name: 'Administration Building',
    type: 'Administrative',
    polygon: [
      [10.3240, 123.8978],
      [10.3240, 123.8992],
      [10.3232, 123.8992],
      [10.3232, 123.8978],
    ],
    capacity: 120,
    floors: 2,
    exits: 3,
    riskLevel: 'LOW',
    lastDrillDate: '2025-08-01',
    notes: 'Central administrative offices. Houses the registrar, cashier, and chancellor\'s office. Main entrance faces the campus quadrangle.',
  },
  {
    id: 'science-building',
    name: 'Science Building',
    type: 'Academic',
    polygon: [
      [10.3232, 123.8978],
      [10.3232, 123.8992],
      [10.3224, 123.8992],
      [10.3224, 123.8978],
    ],
    capacity: 200,
    floors: 3,
    exits: 4,
    riskLevel: 'MEDIUM',
    lastDrillDate: '2025-10-05',
    notes: 'Contains laboratories with chemical storage. Extra caution required during fire evacuation.',
  },
  {
    id: 'lihangin-hall',
    name: 'Lihangin Hall',
    type: 'Academic',
    polygon: [
      [10.3226, 123.8978],
      [10.3226, 123.8992],
      [10.3218, 123.8992],
      [10.3218, 123.8978],
    ],
    capacity: 150,
    floors: 2,
    exits: 3,
    riskLevel: 'MEDIUM',
    lastDrillDate: '2025-09-20',
    notes: 'Multi-purpose academic hall. Limited stairwell access on the west side.',
  },
  {
    id: 'balay-warangao',
    name: 'Balay Warangao',
    type: 'Administrative',
    polygon: [
      [10.3220, 123.8975],
      [10.3220, 123.8988],
      [10.3212, 123.8988],
      [10.3212, 123.8975],
    ],
    capacity: 80,
    floors: 2,
    exits: 2,
    riskLevel: 'LOW',
    lastDrillDate: '2025-07-15',
    notes: 'Administrative cottage. Houses student affairs and guidance offices.',
  },
  {
    id: 'tech-innovation',
    name: 'Technology Innovation Center',
    type: 'Research',
    polygon: [
      [10.3214, 123.8975],
      [10.3214, 123.8988],
      [10.3206, 123.8988],
      [10.3206, 123.8975],
    ],
    capacity: 80,
    floors: 2,
    exits: 2,
    riskLevel: 'LOW',
    lastDrillDate: '2025-07-15',
    notes: 'Houses computer labs and research facilities. Backup generators on site. Emergency power shutoff near the main entrance.',
  },
  {
    id: 'malacanang-cottage',
    name: 'Malacanang Cottage',
    type: 'Administrative',
    polygon: [
      [10.3226, 123.8998],
      [10.3226, 123.9012],
      [10.3218, 123.9012],
      [10.3218, 123.8998],
    ],
    capacity: 60,
    floors: 1,
    exits: 2,
    riskLevel: 'LOW',
    lastDrillDate: '2025-06-20',
    notes: 'Heritage cottage used for administrative functions. Single-story structure with clear exit paths.',
  },
  {
    id: 'computer-room',
    name: 'Computer Room',
    type: 'Academic',
    polygon: [
      [10.3220, 123.9012],
      [10.3220, 123.9025],
      [10.3212, 123.9025],
      [10.3212, 123.9012],
    ],
    capacity: 80,
    floors: 1,
    exits: 2,
    riskLevel: 'LOW',
    lastDrillDate: '2025-08-10',
    notes: 'Main computer laboratory. Contains sensitive equipment — orderly evacuation required.',
  },
  {
    id: 'cdcp-center',
    name: 'CDCP Center',
    type: 'Academic',
    polygon: [
      [10.3214, 123.9025],
      [10.3214, 123.9038],
      [10.3206, 123.9038],
      [10.3206, 123.9025],
    ],
    capacity: 100,
    floors: 2,
    exits: 2,
    riskLevel: 'LOW',
    lastDrillDate: '2025-08-10',
    notes: 'Community development center. Ground floor exit leads directly to Gorordo Avenue.',
  },
  {
    id: 'up-high-school',
    name: 'UP High School – Cebu',
    type: 'Academic',
    polygon: [
      [10.3224, 123.9028],
      [10.3224, 123.9048],
      [10.3212, 123.9048],
      [10.3212, 123.9028],
    ],
    capacity: 350,
    floors: 3,
    exits: 5,
    riskLevel: 'HIGH',
    lastDrillDate: '2025-11-15',
    notes: 'Largest building by occupancy. High student density during class hours. Multiple wing exits connect to the covered court and parking area.',
  },
  {
    id: 'covered-court',
    name: 'UP High Open Court',
    type: 'Recreational',
    polygon: [
      [10.3216, 123.9038],
      [10.3216, 123.9055],
      [10.3206, 123.9055],
      [10.3206, 123.9038],
    ],
    capacity: 500,
    floors: 1,
    exits: 4,
    riskLevel: 'LOW',
    lastDrillDate: '2025-06-10',
    notes: 'Open court used as the primary evacuation assembly point for the lower campus. Wide clearance on all sides.',
  },
  {
    id: 'up-cebu-library',
    name: 'UP Cebu Library',
    type: 'Academic',
    polygon: [
      [10.3212, 123.8960],
      [10.3212, 123.8975],
      [10.3202, 123.8975],
      [10.3202, 123.8960],
    ],
    capacity: 100,
    floors: 2,
    exits: 2,
    riskLevel: 'LOW',
    lastDrillDate: '2025-09-05',
    notes: 'University library housing academic resources. Quiet zone with limited occupancy per floor.',
  },
]

const RISK_COLORS: Record<string, string> = {
  LOW: '#22c55e',
  MEDIUM: '#f59e0b',
  HIGH: '#ef4444',
}

/* IDs of buildings that show detail panel on click */
const CLICKABLE_IDS = [
  'admin-building',
  'as-west-wing',
  'as-east-wing',
  'som-admin',
  'som-building-1',
  'union-building',
  'social-sciences',
  'science-building',
  'lihangin-hall',
  'up-cebu-library',
  'up-high-school',
]

export default function MapPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) window.location.href = '/auth'
  }, [isLoading, isAuthenticated])

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading...</span>
      </div>
    )
  }

  const building = selected ? CAMPUS_BUILDINGS.find(b => b.id === selected) : null

  const regions: MapRegion[] = CAMPUS_BUILDINGS.map(b => ({
    id: b.id,
    polygon: b.polygon as [number, number][],
    selected: b.id === selected,
    floors: b.floors,
  }))

  const riskColor = building ? RISK_COLORS[building.riskLevel] : '#22c55e'

  return (
    <div style={{ minHeight: '100vh', padding: '88px 40px 56px', maxWidth: '1400px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)' }}>
            Heatmap Display
          </h1>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
            UP Cebu &middot; Lahug, Cebu City &middot; Click a building for details
          </p>
        </div>
      </div>

      {/* Map + detail panel layout */}
      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
        {/* Map container */}
        <div style={{
          position: 'relative',
          flex: building ? '1 1 0' : '1 1 100%',
          background: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: '14px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
          overflow: 'hidden',
          height: '640px',
          transition: 'flex 0.3s ease',
        }}>
          <MapView
            regions={regions}
            hoverOnly
            onRegionClick={(id) => {
              if (CLICKABLE_IDS.includes(id)) {
                setSelected(selected === id ? null : id)
              }
            }}
          />
        </div>

        {/* Detail panel — slides in from right */}
        {building && (
          <div style={{
            width: '400px', flexShrink: 0,
            background: 'rgba(10, 15, 28, 0.98)',
            border: '1px solid rgba(45, 184, 176, 0.12)',
            borderRadius: '14px',
            boxShadow: '0 8px 40px rgba(0,0,0,0.4), 0 0 60px rgba(45,184,176,0.05)',
            display: 'flex', flexDirection: 'column',
            maxHeight: '640px', overflowY: 'auto',
          }}>
            {/* Accent bar at top */}
            <div style={{ height: '3px', background: `linear-gradient(90deg, ${riskColor}, #2db8b0)`, borderRadius: '14px 14px 0 0' }} />

            {/* Header */}
            <div style={{ padding: '20px 22px 0' }}>
              {/* Close */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                <div style={{ flex: 1 }}>
                  <h2 style={{ margin: '0 0 2px', fontSize: '20px', fontWeight: '700', color: '#f1f5f9', lineHeight: 1.3 }}>
                    {building.name}
                  </h2>
                  <p style={{ margin: '0', fontSize: '12px', color: '#64748b' }}>
                    UP Cebu &middot; Lahug, Cebu City
                  </p>
                </div>
                <button onClick={() => setSelected(null)} style={{
                  width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: '#94a3b8', transition: 'background 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
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
              background: 'rgba(45,184,176,0.04)',
              border: '1px solid rgba(45,184,176,0.1)',
              borderRadius: '12px', textAlign: 'center',
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
              <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', lineHeight: 1.7 }}>
                {building.notes}
              </p>
            </div>

            {/* Divider */}
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '0 22px 16px' }} />

            {/* Stats grid */}
            <div style={{ padding: '0 22px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                {/* Floors */}
                <div style={{
                  padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                }}>
                  <svg width="64" height="64" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r="24" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
                    <circle cx="32" cy="32" r="24" fill="none" stroke="#f59e0b" strokeWidth="5"
                      strokeDasharray={`${(building.floors / 5) * 150.8} 150.8`}
                      strokeLinecap="round" transform="rotate(-90 32 32)" />
                    <text x="32" y="30" textAnchor="middle" fill="#f1f5f9" fontSize="16" fontWeight="700">{building.floors}</text>
                    <text x="32" y="42" textAnchor="middle" fill="#64748b" fontSize="7" fontWeight="500">levels</text>
                  </svg>
                  <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Floors</span>
                </div>

                {/* Exits */}
                <div style={{
                  padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                }}>
                  <svg width="64" height="64" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r="24" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
                    <circle cx="32" cy="32" r="24" fill="none" stroke={riskColor} strokeWidth="5"
                      strokeDasharray={`${(building.exits / 6) * 150.8} 150.8`}
                      strokeLinecap="round" transform="rotate(-90 32 32)" />
                    <text x="32" y="30" textAnchor="middle" fill="#f1f5f9" fontSize="16" fontWeight="700">{building.exits}</text>
                    <text x="32" y="42" textAnchor="middle" fill="#64748b" fontSize="7" fontWeight="500">exits</text>
                  </svg>
                  <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Exit Points</span>
                </div>
              </div>

              {/* Last drill */}
              <div style={{
                padding: '14px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.06)',
                display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <div>
                  <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>Last Evacuation Drill</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#f1f5f9' }}>
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
          </div>
        )}
      </div>

      <p style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
        Map powered by <a href="https://www.mapbox.com" target="_blank" rel="noreferrer" style={{ color: '#2db8b0' }}>Mapbox</a> &middot; Data &copy; <a href="https://www.openstreetmap.org" target="_blank" rel="noreferrer" style={{ color: '#2db8b0' }}>OpenStreetMap</a> contributors.
      </p>
    </div>
  )
}
