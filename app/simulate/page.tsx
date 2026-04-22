'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/src/hooks/useAuth'
import MapView, { type MapMarker } from '@/components/MapView'
import {
  createSimulationRun,
  saveSimulationResults,
} from '@/src/services/simulation.service'
import type { DisasterType, RiskLevel, SeverityLevel } from '@/src/schema/enums'

const CAMPUS_CENTER: [number, number] = [123.8992, 10.3230] // [lng, lat]

/* Campus buildings with bounding boxes for coordinate-based matching */
const CAMPUS_BUILDINGS = [
  { id: 'social-sciences', name: '', bounds: { south: 10.3255, north: 10.3221, west: 123.8971, east: 123.8987 } },
  { id: 'arts-design', name: 'Arts and Design Workshop', bounds: { south: 10.3247, north: 10.3253, west: 123.8965, east: 123.8975 } },
  { id: 'som-building-1', name: '', bounds: { south: 10.3241, north: 10.3218, west: 123.8969, east: 123.8987 } },
  { id: 'som-admin', bounds: { south: 10.3237, north: 10.3218, west: 123.8972, east: 123.8983 } },
  { id: 'som-building-2', name: 'SOM Building 2', bounds: { south: 10.3241, north: 10.3237, west: 123.8972, east: 123.8982 } },
  { id: 'volleyball-court', name: 'UPC Volleyball Court', bounds: { south: 10.3243, north: 10.3251, west: 123.8982, east: 123.8992 } },
  { id: 'as-west-wing', name: '', bounds: { south: 10.3212, north: 10.3256, west: 123.8984, east: 123.9005 } },
  { id: 'as-east-wing', name: '', bounds: { south: 10.3212, north: 10.3250, west: 123.8985, east: 123.9007 } },
  { id: 'cultural-center', name: '', bounds: { south: 10.3190, north: 10.3260, west: 123.8987, east: 123.8997 } },
  { id: 'soccer-field', name: 'UPC Soccer Field', bounds: { south: 10.3187, north: 10.3260, west: 123.8988, east: 123.8997 } },
  { id: 'admin-building', name: '', bounds: { south: 10.3212, north: 10.3234, west: 123.8977, east: 123.8988 } },
  { id: 'science-building', name: '', bounds: { south: 10.3211, north: 10.3234, west: 123.8971, east: 123.8988 } },
  { id: 'liadlaw-hall', name: '', bounds: { south: 10.3201, north: 10.3231, west: 123.8962, east: 123.8988 } },
  { id: 'balay-warangao', name: 'Balay Warangao', bounds: { south: 10.3212, north: 10.3220, west: 123.8975, east: 123.8988 } },
  { id: 'tech-innovation', name: 'Technology Innovation Center', bounds: { south: 10.3206, north: 10.3214, west: 123.8975, east: 123.8988 } },
  { id: 'malacanang-cottage', name: 'Malacanang Cottage', bounds: { south: 10.3218, north: 10.3226, west: 123.8998, east: 123.9012 } },
  { id: 'computer-room', name: 'Computer Room', bounds: { south: 10.3212, north: 10.3220, west: 123.9012, east: 123.9025 } },
  { id: 'cdcp-center', name: 'CDCP Center', bounds: { south: 10.3206, north: 10.3214, west: 123.9025, east: 123.9038 } },
  { id: 'up-high-school', name: '', bounds: { south: 10.3213, north: 10.3224, west: 123.8942, east: 123.9048 } },
  { id: 'covered-court', name: 'UP High Open Court', bounds: { south: 10.3206, north: 10.3216, west: 123.9038, east: 123.9055 } },
  { id: 'up-cebu-library', name: '', bounds: { south: 10.3204, north: 10.3224, west: 123.8962, east: 123.8997 } },
]

/* IDs of buildings that get a clickable marker icon */
const MARKER_BUILDING_IDS = [
  'admin-building',
  'as-west-wing',
  'as-east-wing',
  'som-admin',
  'som-building-1',
  'cultural-center',
  'social-sciences',
  'science-building',
  'liadlaw-hall',
  'up-cebu-library',
  'up-high-school',
]

/* Per-building detail cards ------------------------------------------------ */
interface BuildingDetail {
  name: string
  type: string
  description: string
  capacity: number
  floors: number
  yearBuilt: string
  riskLevel: 'Low' | 'Medium' | 'High' | 'N/A'
  facilities: string[]
}

const BUILDING_DETAILS: Record<string, BuildingDetail> = {
  'admin-building': {
    name: 'Administration Building',
    type: 'Administrative',
    description:
      'Central administrative hub of UP Cebu, housing the Office of the Chancellor, Registrar, Accounting, and other key administrative units. It serves as the primary point of contact for official university transactions.',
    capacity: 200,
    floors: 3,
    yearBuilt: '1985',
    riskLevel: 'Medium',
    facilities: ['Chancellor\'s Office', 'Registrar', 'Accounting', 'Conference Rooms'],
  },
  'as-west-wing': {
    name: 'AS West Wing',
    type: 'Academic',
    description:
      'The western section of the Arts & Sciences complex, hosting lecture halls and faculty offices for humanities and social sciences departments. Classes and seminars are held here throughout the day.',
    capacity: 350,
    floors: 2,
    yearBuilt: '1991',
    riskLevel: 'Medium',
    facilities: ['Lecture Halls', 'Faculty Offices', 'Study Rooms', 'Lounge Area'],
  },
  'as-east-wing': {
    name: 'AS East Wing',
    type: 'Academic',
    description:
      'The eastern extension of the Arts & Sciences building, primarily used for natural sciences laboratory classes and overflow lecture rooms. It shares a central courtyard with the West Wing.',
    capacity: 300,
    floors: 2,
    yearBuilt: '1993',
    riskLevel: 'Medium',
    facilities: ['Science Labs', 'Lecture Rooms', 'Faculty Offices', 'Courtyard Access'],
  },
  'som-admin': {
    name: 'SOM Administration',
    type: 'Administrative',
    description:
      'Administrative offices for the School of Management, including the Dean\'s Office, student affairs, and program coordination units for business and management undergraduate and graduate programs.',
    capacity: 80,
    floors: 2,
    yearBuilt: '1998',
    riskLevel: 'Low',
    facilities: ['Dean\'s Office', 'Student Affairs', 'Program Coordinators', 'Meeting Rooms'],
  },
  'som-building-1': {
    name: 'SOM Building 1',
    type: 'Academic',
    description:
      'Primary classroom building for the School of Management. Equipped with tiered lecture halls, case-study rooms, and presentation facilities used for business courses at both undergraduate and postgraduate levels.',
    capacity: 400,
    floors: 3,
    yearBuilt: '2002',
    riskLevel: 'Medium',
    facilities: ['Tiered Lecture Halls', 'Case-Study Rooms', 'Presentation Suites', 'Student Lounge'],
  },
  'cultural-center': {
    name: 'Cebu Cultural Center',
    type: 'N/A',
    description:
      'Closed',
    capacity: 0,
    floors: 1,
    yearBuilt: '-',
    riskLevel: 'N/A',
    facilities: [], 
  },
  'social-sciences': {
    name: 'Social Sciences Building',
    type: 'Academic',
    description:
      'Dedicated to the Social Sciences Division, this building houses psychology, public administration, and political science faculty offices and classrooms. Research centers and seminar rooms support advanced study.',
    capacity: 250,
    floors: 2,
    yearBuilt: '1995',
    riskLevel: 'Low',
    facilities: ['Seminar Rooms', 'Research Center', 'Faculty Offices', 'Discussion Rooms'],
  },
  'science-building': {
    name: 'Science Building',
    type: 'Academic',
    description:
      'Core facility for natural sciences instruction. Contains chemistry, biology, and physics laboratories alongside lecture rooms. Safety equipment and ventilation systems are installed throughout to support lab operations.',
    capacity: 320,
    floors: 3,
    yearBuilt: '1990',
    riskLevel: 'High',
    facilities: ['Chemistry Lab', 'Biology Lab', 'Physics Lab', 'Instrument Room'],
  },
  'lihangin-hall': {
    name: 'Lihangin Hall',
    type: 'Academic',
    description:
      'A multi-purpose academic hall used for large classes, university assemblies, and cultural events. Its open design and elevated position make it a landmark on campus, particularly valued during orientation periods.',
    capacity: 600,
    floors: 2,
    yearBuilt: '1982',
    riskLevel: 'Medium',
    facilities: ['Assembly Hall', 'Large Classrooms', 'Stage Area', 'Outdoor Terrace'],
  },
  'up-cebu-library': {
    name: 'UP Cebu Library',
    type: 'Library',
    description:
      'The main repository of academic resources for the university community. Houses print collections, digital access terminals, study carrels, and a rare-materials section. Open to students, faculty, and accredited researchers.',
    capacity: 180,
    floors: 2,
    yearBuilt: '2000',
    riskLevel: 'Low',
    facilities: ['Reading Rooms', 'Digital Terminals', 'Study Carrels', 'Rare Materials Section'],
  },
  'up-high-school': {
    name: 'UP High School - Cebu',
    type: 'Secondary School',
    description:
      'The integrated laboratory high school of UP Cebu, offering a science-oriented curriculum to qualified secondary students. Facilities include specialized science and computer rooms alongside standard academic classrooms.',
    capacity: 800,
    floors: 2,
    yearBuilt: '1979',
    riskLevel: 'High',
    facilities: ['Classrooms', 'Science Labs', 'Computer Room', 'Covered Court'],
  },
}

interface BuildingBounds {
  south: number
  north: number
  west: number
  east: number
}

function normalizeBounds(bounds: BuildingBounds): BuildingBounds {
  return {
    south: Math.min(bounds.south, bounds.north),
    north: Math.max(bounds.south, bounds.north),
    west: Math.min(bounds.west, bounds.east),
    east: Math.max(bounds.west, bounds.east),
  }
}

function boundsCenter(bounds: BuildingBounds): { lat: number; lng: number } {
  const b = normalizeBounds(bounds)
  return {
    lat: (b.south + b.north) / 2,
    lng: (b.west + b.east) / 2,
  }
}

function boundsArea(bounds: BuildingBounds): number {
  const b = normalizeBounds(bounds)
  return Math.abs((b.north - b.south) * (b.east - b.west))
}

const CAMPUS_MAP_BOUNDS: [[number, number], [number, number]] = (() => {
  let south = Number.POSITIVE_INFINITY
  let north = Number.NEGATIVE_INFINITY
  let west = Number.POSITIVE_INFINITY
  let east = Number.NEGATIVE_INFINITY
  const pad = 0.0006

  for (const building of CAMPUS_BUILDINGS) {
    const bounds = normalizeBounds(building.bounds)
    south = Math.min(south, bounds.south)
    north = Math.max(north, bounds.north)
    west = Math.min(west, bounds.west)
    east = Math.max(east, bounds.east)
  }

  return [
    [south - pad, west - pad],
    [north + pad, east + pad],
  ]
})()

function findBuildingByCoords(lat: number, lng: number): string | null {
  // Expand bounds slightly to be more forgiving with click targets
  const pad = 0.0003
  const matches = CAMPUS_BUILDINGS.filter(b => {
    const n = normalizeBounds(b.bounds)
    return (
      lat >= n.south - pad && lat <= n.north + pad &&
      lng >= n.west - pad && lng <= n.east + pad
    )
  })

  if (matches.length === 0) return null
  if (matches.length === 1) return matches[0].id

  // If bounds overlap, pick the most specific (smallest) bounding box.
  matches.sort((a, b) => boundsArea(a.bounds) - boundsArea(b.bounds))
  return matches[0].id
}

function hasBuildingDetail(buildingId: string): boolean {
  return Boolean(BUILDING_DETAILS[buildingId])
}

function hasMarker(buildingId: string): boolean {
  return MARKER_BUILDING_IDS.includes(buildingId)
}

function buildBoundsMarkers(): MapMarker[] {
  return CAMPUS_BUILDINGS
    .filter(b => hasMarker(b.id))
    .map((b) => {
      const c = boundsCenter(b.bounds)
      return {
        id: b.id,
        label: b.name as string,
        lat: c.lat,
        lng: c.lng,
      }
    })
}

function attachMarkerClicks(markers: MapMarker[], onOpenPanel: (buildingId: string) => void): MapMarker[] {
  return markers.map((m) => ({
    ...m,
    onClick: () => onOpenPanel(m.id),
  }))
}

function openBuildingFromCoords(coords: [number, number], onOpenPanel: (buildingId: string) => void): void {
  const [lat, lng] = coords
  const buildingId = findBuildingByCoords(lat, lng)
  if (buildingId) onOpenPanel(buildingId)
}

function handleBuildingClickFromMap(coords: [number, number], onOpenPanel: (buildingId: string) => void): void {
  openBuildingFromCoords(coords, onOpenPanel)
}

function toPanelOpenHandler(setter: (id: string | null) => void): (buildingId: string) => void {
  return (buildingId: string) => {
    if (hasBuildingDetail(buildingId)) setter(buildingId)
  }
}

/* ── Building detail side-panel ─────────────────────────────────────────── */
const RISK_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  Low:    { bg: 'rgba(34,197,94,0.10)',  border: 'rgba(34,197,94,0.25)',  text: '#22c55e' },
  Medium: { bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.25)', text: '#f59e0b' },
  High:   { bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.25)',  text: '#ef4444' },
}

const TYPE_ICONS: Record<string, React.ReactElement> = {
  'Administrative': (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><line x1="16" y1="21" x2="16" y2="7"/><line x1="8" y1="21" x2="8" y2="7"/>
    </svg>
  ),
  'Academic': (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
    </svg>
  ),
  'Library': (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  ),
  'Student Services': (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  'Secondary School': (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
}

function BuildingPanel({
  detail,
  selectedFloor,
  onFloorChange,
  onClose,
  onSimulate,
}: {
  detail: BuildingDetail
  selectedFloor: number
  onFloorChange: (floor: number) => void
  onClose: () => void
  onSimulate: () => void
}) {
  const risk = RISK_COLORS[detail.riskLevel] ?? RISK_COLORS.Medium
  const typeIcon = TYPE_ICONS[detail.type] ?? TYPE_ICONS['Academic']
  const floorOptions = Array.from({ length: Math.max(1, detail.floors) }, (_, index) => index + 1)

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: 'min(360px, 100%)',
        zIndex: 1200,
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(8, 13, 28, 0.97)',
        borderLeft: '1px solid #1e293b',
        backdropFilter: 'blur(20px)',
        animation: 'slideInPanel 0.25s ease',
        overflowY: 'auto',
      }}
    >
      <style>{`
        @keyframes slideInPanel {
          from { transform: translateX(40px); opacity: 0; }
          to   { transform: translateX(0);   opacity: 1; }
        }
      `}</style>

      {/* Close button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '14px 14px 0' }}>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            width: '30px', height: '30px', borderRadius: '8px',
            background: 'rgba(255,255,255,0.05)', border: '1px solid #1e293b',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#64748b', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.10)'; e.currentTarget.style.color = '#f1f5f9' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#64748b' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Panel body */}
      <div style={{ padding: '10px 20px 24px', display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>

        {/* Building type badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '5px 10px', borderRadius: '8px',
          background: 'rgba(45,184,176,0.08)', border: '1px solid rgba(45,184,176,0.18)',
          alignSelf: 'flex-start',
        }}>
          {typeIcon}
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#2db8b0', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            {detail.type}
          </span>
        </div>

        {/* Name */}
        <div>
          <h2 style={{ margin: '0 0 6px', fontSize: '20px', fontWeight: 800, color: '#f1f5f9', lineHeight: 1.25, letterSpacing: '-0.02em' }}>
            {detail.name}
          </h2>
          <p style={{ margin: 0, fontSize: '12.5px', color: '#64748b', lineHeight: 1.6 }}>
            {detail.description}
          </p>
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {/* Capacity */}
          <div style={{
            padding: '13px 14px', borderRadius: '10px',
            background: 'rgba(255,255,255,0.035)', border: '1px solid #1e293b',
          }}>
            <div style={{ fontSize: '10px', color: '#475569', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Capacity
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#f1f5f9', lineHeight: 1 }}>
              {detail.capacity.toLocaleString()}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>persons</div>
          </div>

          {/* Floors */}
          <div style={{
            padding: '13px 14px', borderRadius: '10px',
            background: 'rgba(255,255,255,0.035)', border: '1px solid #1e293b',
          }}>
            <div style={{ fontSize: '10px', color: '#475569', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Floors
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#f1f5f9', lineHeight: 1 }}>
              {detail.floors}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>storeys</div>
          </div>

          {/* Year built */}
          <div style={{
            padding: '13px 14px', borderRadius: '10px',
            background: 'rgba(255,255,255,0.035)', border: '1px solid #1e293b',
          }}>
            <div style={{ fontSize: '10px', color: '#475569', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Est. Built
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#f1f5f9', lineHeight: 1 }}>
              {detail.yearBuilt}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>year</div>
          </div>

          {/* Risk level */}
          <div style={{
            padding: '13px 14px', borderRadius: '10px',
            background: risk.bg, border: `1px solid ${risk.border}`,
          }}>
            <div style={{ fontSize: '10px', color: '#475569', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Risk Level
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: risk.text, lineHeight: 1 }}>
              {detail.riskLevel}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>priority</div>
          </div>
        </div>

        {/* Key facilities */}
        <div>
          <div style={{ fontSize: '11px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
            Key Facilities
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
            {detail.facilities.map(f => (
              <span
                key={f}
                style={{
                  padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600,
                  background: 'rgba(45,184,176,0.06)', border: '1px solid rgba(45,184,176,0.15)',
                  color: '#94a3b8',
                }}
              >
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Floor picker */}
        <div>
          <div style={{ fontSize: '11px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
            Floor Picker
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {floorOptions.map((floor) => {
              const isActive = selectedFloor === floor
              return (
                <button
                  key={floor}
                  onClick={() => onFloorChange(floor)}
                  style={{
                    minWidth: '44px',
                    padding: '7px 10px',
                    borderRadius: '9px',
                    border: isActive ? '1px solid rgba(45,184,176,0.55)' : '1px solid #1e293b',
                    background: isActive ? 'rgba(45,184,176,0.16)' : 'rgba(255,255,255,0.04)',
                    color: isActive ? '#2db8b0' : '#94a3b8',
                    fontSize: '12px',
                    fontWeight: isActive ? 700 : 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {`F${floor}`}
                </button>
              )
            })}
          </div>
        </div>

        {/* CTA */}
        <div style={{ marginTop: 'auto', paddingTop: '8px' }}>
          <button
            onClick={onSimulate}
            style={{
              width: '100%', padding: '14px 20px',
              background: 'linear-gradient(135deg, #2db8b0 0%, #1a9e96 100%)',
              border: 'none', borderRadius: '12px',
              color: '#fff', fontSize: '14px', fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              boxShadow: '0 4px 20px rgba(45,184,176,0.35)',
              transition: 'all 0.2s',
              letterSpacing: '-0.01em',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(45,184,176,0.45)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(45,184,176,0.35)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            Begin Simulation
          </button>
          <p style={{ margin: '10px 0 0', fontSize: '11px', color: '#475569', textAlign: 'center' }}>
            Choose a disaster scenario on the next screen
          </p>
        </div>
      </div>
    </div>
  )
}

/* ── Page ─────────────────────────────────────────────────────────────────── */
export default function SimulatePage() {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth()
  const router = useRouter()
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null)
  const [selectedFloor, setSelectedFloor] = useState(1)
  const [forcedCenter, setForcedCenter] = useState<[number, number] | null>(null)
  const openPanel = toPanelOpenHandler(setSelectedBuildingId)

  const selectedBuilding = selectedBuildingId ? BUILDING_DETAILS[selectedBuildingId] : null
  const selectedBuildingCenter = useMemo<[number, number] | null>(() => {
    if (!selectedBuildingId) return null
    const building = CAMPUS_BUILDINGS.find((b) => b.id === selectedBuildingId)
    if (!building) return null
    const center = boundsCenter(building.bounds)
    return [center.lng, center.lat]
  }, [selectedBuildingId])
  const highlightAt = useMemo<[number, number] | null>(() => {
    if (!selectedBuildingCenter) return null
    return [selectedBuildingCenter[1], selectedBuildingCenter[0]]
  }, [selectedBuildingCenter])
  const markers: MapMarker[] = attachMarkerClicks(buildBoundsMarkers(), openPanel)
  // Sim parameters
  const [agents, setAgents] = useState(120)
  const [gridWidth, setGridWidth] = useState(60)
  const [gridHeight, setGridHeight] = useState(45)
  const [exits, setExits] = useState(6)
  const [wallDensity, setWallDensity] = useState(10)
  const [speed, setSpeed] = useState(200)
  const [applied, setApplied] = useState({ agents: 120, gridWidth: 60, gridHeight: 45, exits: 6, wallDensity: 10, speed: 200 })

  // Sim state
  const [step, setStep] = useState(0)
  const [evacuated, setEvacuated] = useState(0)
  const [maxCongestion, setMaxCongestion] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [runId, setRunId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      window.location.href = '/auth'
    }
  }, [isAuthLoading, isAuthenticated])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setSelectedBuildingId(null)
      setForcedCenter([CAMPUS_CENTER[0], CAMPUS_CENTER[1]])
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!selectedBuilding) {
      setSelectedFloor(1)
      return
    }
    setSelectedFloor((current) => {
      if (current < 1) return 1
      if (current > selectedBuilding.floors) return selectedBuilding.floors
      return current
    })
  }, [selectedBuilding])

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
          focusCenter={selectedBuildingCenter ?? forcedCenter ?? CAMPUS_CENTER}
          highlightAt={highlightAt}
          maxBounds={CAMPUS_MAP_BOUNDS}
          minZoom={15.7}
          maxZoom={19.8}
          onBuildingClick={(_name, coords) => {
            handleBuildingClickFromMap(coords, openPanel)
          }}
        />

        {/* Prompt overlay — hide when panel is open */}
        {!selectedBuilding && (
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
        )}
        {isSaving && (
          <div style={{
            marginTop: '12px',
            padding: '12px 14px',
            background: 'rgba(45,184,176,0.08)',
            border: '1px solid rgba(45,184,176,0.2)',
            borderRadius: '8px',
            fontSize: '12px',
            color: '#115e59',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            Saving simulation results...
          </div>
        )}

        {/* Building details panel */}
        {selectedBuilding && selectedBuildingId && (
          <BuildingPanel
            detail={selectedBuilding}
            selectedFloor={selectedFloor}
            onFloorChange={setSelectedFloor}
            onClose={() => {
              setSelectedBuildingId(null)
              setSelectedFloor(1)
            }}
            onSimulate={() => router.push(`/simulate/${encodeURIComponent(selectedBuildingId)}/disaster`)}
          />
        )}

      </div>

      <p style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
        Map powered by <a href="https://www.mapbox.com" target="_blank" rel="noreferrer" style={{ color: '#2db8b0' }}>Mapbox</a> &middot; Data &copy; <a href="https://www.openstreetmap.org" target="_blank" rel="noreferrer" style={{ color: '#2db8b0' }}>OpenStreetMap</a> contributors.
      </p>
    </div>
  )
}
