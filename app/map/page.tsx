'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useAuth } from '@/src/hooks/useAuth'
import type { MapRegion } from '@/components/MapView'

const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => (
    <div style={{
      height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f8fafc', borderRadius: '12px', color: 'var(--text-secondary)', fontSize: '14px', gap: '10px',
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
    id: 'admin-building',
    name: 'Administration Building',
    type: 'Administrative',
    polygon: [
      [10.33155, 123.90040],
      [10.33155, 123.90095],
      [10.33120, 123.90095],
      [10.33120, 123.90040],
    ],
    capacity: 150,
    floors: 2,
    exits: 3,
    riskLevel: 'LOW',
    lastDrillDate: '2025-09-12',
    notes: 'Houses administrative offices and the registrar. Primary evacuation exits lead to the central quadrangle.',
  },
  {
    id: 'science-building',
    name: 'Science Building',
    type: 'Academic',
    polygon: [
      [10.33120, 123.90005],
      [10.33120, 123.90055],
      [10.33090, 123.90055],
      [10.33090, 123.90005],
    ],
    capacity: 200,
    floors: 3,
    exits: 4,
    riskLevel: 'MEDIUM',
    lastDrillDate: '2025-10-05',
    notes: 'Contains laboratories with chemical storage. Extra caution required during fire evacuation. Secondary exit through the rear stairwell.',
  },
  {
    id: 'som-building-1',
    name: 'SOM Building 1',
    type: 'Academic',
    polygon: [
      [10.33175, 123.89960],
      [10.33175, 123.90005],
      [10.33145, 123.90005],
      [10.33145, 123.89960],
    ],
    capacity: 180,
    floors: 3,
    exits: 3,
    riskLevel: 'LOW',
    lastDrillDate: '2025-08-20',
    notes: 'School of Management lecture halls. Ground floor has a wide corridor that serves as the main evacuation route.',
  },
  {
    id: 'som-building-2',
    name: 'SOM Building 2',
    type: 'Academic',
    polygon: [
      [10.33130, 123.89960],
      [10.33130, 123.90005],
      [10.33100, 123.90005],
      [10.33100, 123.89960],
    ],
    capacity: 160,
    floors: 2,
    exits: 3,
    riskLevel: 'LOW',
    lastDrillDate: '2025-08-20',
    notes: 'Connected to SOM Building 1 via covered walkway. Faculty offices on the second floor.',
  },
  {
    id: 'library',
    name: 'UP Cebu Library',
    type: 'Academic',
    polygon: [
      [10.33040, 123.90005],
      [10.33040, 123.90060],
      [10.33010, 123.90060],
      [10.33010, 123.90005],
    ],
    capacity: 120,
    floors: 2,
    exits: 2,
    riskLevel: 'MEDIUM',
    lastDrillDate: '2025-11-01',
    notes: 'Main campus library. Limited exits — evacuation drills focus on orderly single-file exit through the front entrance.',
  },
  {
    id: 'tech-innovation',
    name: 'Technology Innovation Center',
    type: 'Research',
    polygon: [
      [10.33075, 123.89945],
      [10.33075, 123.89995],
      [10.33045, 123.89995],
      [10.33045, 123.89945],
    ],
    capacity: 80,
    floors: 2,
    exits: 2,
    riskLevel: 'LOW',
    lastDrillDate: '2025-07-15',
    notes: 'Houses computer labs and research facilities. Backup generators on site. Emergency power shutoff near the main entrance.',
  },
  {
    id: 'up-high-school',
    name: 'UP High School – Cebu',
    type: 'Academic',
    polygon: [
      [10.33085, 123.90120],
      [10.33085, 123.90195],
      [10.33050, 123.90195],
      [10.33050, 123.90120],
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
    name: 'UP High Covered Court',
    type: 'Recreational',
    polygon: [
      [10.33050, 123.90200],
      [10.33050, 123.90250],
      [10.33020, 123.90250],
      [10.33020, 123.90200],
    ],
    capacity: 500,
    floors: 1,
    exits: 4,
    riskLevel: 'LOW',
    lastDrillDate: '2025-06-10',
    notes: 'Open-air structure used as the primary evacuation assembly point. Wide clearance on all sides.',
  },
]

const RISK_COLORS: Record<string, string> = {
  LOW: '#22c55e',
  MEDIUM: '#f59e0b',
  HIGH: '#ef4444',
}

export default function MapPage() {
  const { isAuthenticated, isLoading } = useAuth()
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
  }))

  return (
    <div style={{ minHeight: '100vh', padding: '88px 40px 56px', maxWidth: '1280px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)' }}>
            Campus Map
          </h1>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
            UP Cebu &middot; Lahug, Cebu City &middot; Click a building for details
          </p>
        </div>
      </div>

      {/* Map + sidebar */}
      <div style={{
        position: 'relative',
        background: '#ffffff',
        border: '1px solid var(--border)',
        borderRadius: '14px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        overflow: 'hidden',
        height: '640px',
      }}>
        <MapView
          regions={regions}
          onRegionClick={(id) => setSelected(selected === id ? null : id)}
        />

        {/* Info sidebar */}
        {building && (
          <div style={{
            position: 'absolute', top: 0, right: 0, bottom: 0,
            width: '340px', background: '#fff',
            borderLeft: '1px solid var(--border)',
            zIndex: 1001, overflowY: 'auto',
            boxShadow: '-4px 0 16px rgba(0,0,0,0.08)',
            padding: '20px',
          }}>
            {/* Close */}
            <button onClick={() => setSelected(null)} style={{
              position: 'absolute', top: '12px', right: '12px',
              width: '28px', height: '28px', borderRadius: '6px',
              background: '#f8fafc', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--text-muted)',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>

            {/* Name + type */}
            <div style={{ marginBottom: '16px', paddingRight: '32px' }}>
              <h2 style={{ margin: '0 0 6px', fontSize: '17px', fontWeight: '700', color: 'var(--text-primary)' }}>
                {building.name}
              </h2>
              <span style={{
                display: 'inline-block', padding: '3px 10px', borderRadius: '20px',
                background: 'rgba(45,184,176,0.1)', color: '#0f766e',
                fontSize: '11px', fontWeight: '600',
              }}>
                {building.type}
              </span>
            </div>

            {/* Stats grid */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px',
              marginBottom: '16px',
            }}>
              {([
                { label: 'Capacity', value: String(building.capacity), icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg> },
                { label: 'Floors', value: String(building.floors), icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg> },
                { label: 'Exits', value: String(building.exits), icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg> },
                { label: 'Risk', value: building.riskLevel, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={RISK_COLORS[building.riskLevel]} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> },
              ]).map(stat => (
                <div key={stat.label} style={{
                  padding: '12px', background: '#f8fafc', borderRadius: '8px',
                  border: '1px solid var(--border)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    {stat.icon}
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{stat.label}</span>
                  </div>
                  <div style={{
                    fontSize: '16px', fontWeight: '700',
                    color: stat.label === 'Risk' ? RISK_COLORS[building.riskLevel] : 'var(--text-primary)',
                  }}>
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Last drill */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 12px', background: '#f8fafc', borderRadius: '8px',
              border: '1px solid var(--border)', marginBottom: '16px',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Last evacuation drill</div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                  {new Date(building.lastDrillDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>Notes</div>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {building.notes}
              </p>
            </div>
          </div>
        )}
      </div>

      <p style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
        Map data &copy; <a href="https://www.openstreetmap.org" target="_blank" rel="noreferrer" style={{ color: '#2db8b0' }}>OpenStreetMap</a> contributors.
      </p>
    </div>
  )
}
