'use client'

import { useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/src/hooks/useAuth'
import type { MapMarker } from '@/components/MapView'

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

/* Campus buildings with bounding boxes for coordinate-based matching */
const CAMPUS_BUILDINGS = [
  { id: 'social-sciences', name: 'Social Sciences Building', bounds: { south: 10.3255, north: 10.3219, west: 123.8971, east: 123.8987 } },
  { id: 'arts-design', name: 'Arts and Design Workshop', bounds: { south: 10.3247, north: 10.3253, west: 123.8965, east: 123.8975 } },
  { id: 'som-building-1', name: 'SOM Building 1', bounds: { south: 10.3241, north: 10.3218, west: 123.8969, east: 123.8987 } },
  { id: 'som-admin', bounds: { south: 10.3237, north: 10.3218, west: 123.8972, east: 123.8983 } },
  { id: 'som-building-2', name: 'SOM Building 2', bounds: { south: 10.3231, north: 10.3237, west: 123.8972, east: 123.8982 } },
  { id: 'volleyball-court', name: 'UPC Volleyball Court', bounds: { south: 10.3243, north: 10.3251, west: 123.8982, east: 123.8992 } },
  { id: 'as-west-wing', name: 'AS West Wing', bounds: { south: 10.3248, north: 10.3256, west: 123.8992, east: 123.9005 } },
  { id: 'union-building', name: 'Union Building', bounds: { south: 10.3252, north: 10.3260, west: 123.9005, east: 123.9018 } },
  { id: 'as-east-wing', name: 'AS East Wing', bounds: { south: 10.3242, north: 10.3250, west: 123.9005, east: 123.9018 } },
  { id: 'soccer-field', name: 'UPC Soccer Field', bounds: { south: 10.3232, north: 10.3244, west: 123.9018, east: 123.9038 } },
  { id: 'admin-building', name: 'Administration Building', bounds: { south: 10.3212, north: 10.3234, west: 123.8977, east: 123.8988 } },
  { id: 'science-building', name: 'Science Building', bounds: { south: 10.3211, north: 10.3234, west: 123.8971, east: 123.8988 } },
  { id: 'lihangin-hall', name: 'Liadlaw Hall', bounds: { south: 10.3201, north: 10.3231, west: 123.8962, east: 123.8988 } },
  { id: 'balay-warangao', name: 'Balay Warangao', bounds: { south: 10.3212, north: 10.3220, west: 123.8975, east: 123.8988 } },
  { id: 'tech-innovation', name: 'Technology Innovation Center', bounds: { south: 10.3206, north: 10.3214, west: 123.8975, east: 123.8988 } },
  { id: 'malacanang-cottage', name: 'Malacanang Cottage', bounds: { south: 10.3218, north: 10.3226, west: 123.8998, east: 123.9012 } },
  { id: 'computer-room', name: 'Computer Room', bounds: { south: 10.3212, north: 10.3220, west: 123.9012, east: 123.9025 } },
  { id: 'cdcp-center', name: 'CDCP Center', bounds: { south: 10.3206, north: 10.3214, west: 123.9025, east: 123.9038 } },
  { id: 'up-high-school', name: 'UP High School - Cebu', bounds: { south: 10.3212, north: 10.3224, west: 123.9028, east: 123.9048 } },
  { id: 'covered-court', name: 'UP High Open Court', bounds: { south: 10.3206, north: 10.3216, west: 123.9038, east: 123.9055 } },
  { id: 'up-cebu-library', name: 'UP Cebu Library', bounds: { south: 10.3203, north: 10.3224, west: 123.8963, east: 123.8997 } },
]

/* IDs of buildings that get a clickable marker icon */
const MARKER_BUILDING_IDS = [
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

function findBuildingByCoords(lat: number, lng: number): string | null {
  // Expand bounds slightly to be more forgiving with click targets
  const pad = 0.0003
  for (const b of CAMPUS_BUILDINGS) {
    if (
      lat >= b.bounds.south - pad && lat <= b.bounds.north + pad &&
      lng >= b.bounds.west - pad && lng <= b.bounds.east + pad
    ) {
      return b.id
    }
  }
  return null
}

export default function SimulatePage() {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth()
  const router = useRouter()

  const markers: MapMarker[] = CAMPUS_BUILDINGS
    .filter(b => MARKER_BUILDING_IDS.includes(b.id))
    .map(b => ({
      id: b.id,
      label: b.name,
      lat: (b.bounds.south + b.bounds.north) / 2,
      lng: (b.bounds.west + b.bounds.east) / 2,
      onClick: () => router.push(`/simulate/${encodeURIComponent(b.id)}/disaster`),
    }))

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      window.location.href = '/auth'
    }
  }, [isAuthLoading, isAuthenticated])

  if (isAuthLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading...</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', padding: '88px 40px 56px', maxWidth: '1280px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
        <div style={{
          width: '44px', height: '44px', borderRadius: '12px',
          background: 'rgba(45,184,176,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
        </div>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)' }}>
            Simulation Setup
          </h1>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
            Select a building on the map to begin
          </p>
        </div>
      </div>

      {/* Map — no custom region overlays, only Mapbox 3D buildings are clickable */}
      <div style={{
        position: 'relative',
        background: '#0f172a',
        border: '1px solid #1e293b',
        borderRadius: '14px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
        overflow: 'hidden',
        height: '640px',
      }}>
        <MapView
          flat2d
          markers={markers}
          onBuildingClick={(_name, coords) => {
            const [lat, lng] = coords
            const buildingId = findBuildingByCoords(lat, lng)
            if (buildingId) {
              router.push(`/simulate/${encodeURIComponent(buildingId)}/disaster`)
            }
          }}
        />

        {/* Prompt overlay */}
        <div style={{
          position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
          zIndex: 1000, background: 'rgba(15, 23, 42, 0.95)', border: '1px solid #334155',
          borderRadius: '12px', padding: '12px 24px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          backdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', gap: '10px',
          fontSize: '14px', color: '#94a3b8', fontWeight: '500',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          Click a building to start simulation setup
        </div>
      </div>

      <p style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
        Map powered by <a href="https://www.mapbox.com" target="_blank" rel="noreferrer" style={{ color: '#2db8b0' }}>Mapbox</a> &middot; Data &copy; <a href="https://www.openstreetmap.org" target="_blank" rel="noreferrer" style={{ color: '#2db8b0' }}>OpenStreetMap</a> contributors.
      </p>
    </div>
  )
}
