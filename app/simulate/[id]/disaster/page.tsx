'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/src/hooks/useAuth'

const DISASTERS = [
  {
    type: 'fire',
    label: 'Fire Simulation',
    description: 'Simulate fire outbreak and building evacuation procedures',
    color: '#ff6b35',
    bg: 'rgba(255,107,53,0.06)',
    border: 'rgba(255,107,53,0.18)',
    hoverBg: 'rgba(255,107,53,0.12)',
    hoverBorder: 'rgba(255,107,53,0.5)',
    iconPath: (
      <>
        <path d="M12 2c.5 2.5 2 4.5 2 7a4 4 0 1 1-8 0c0-2.5 2-4.5 2-7 1.5 1.5 2.5 3 4 0z" />
        <path d="M12 12c.5 1 1 2 1 3a2 2 0 1 1-4 0c0-1 .5-2 1-3 .5.5 1 1 2 0z" />
      </>
    ),
  },
  {
    type: 'earthquake',
    label: 'Earthquake Simulation',
    description: 'Simulate seismic activity, structural response, and evacuation',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.06)',
    border: 'rgba(245,158,11,0.18)',
    hoverBg: 'rgba(245,158,11,0.12)',
    hoverBorder: 'rgba(245,158,11,0.5)',
    iconPath: (
      <>
        <path d="M2 12h4l2-5 3 10 3-10 2 5h4" />
      </>
    ),
  },
]

/* Floor counts per building — used to generate floor picker options */
const BUILDING_FLOOR_COUNT: Record<string, number> = {
  'admin-building': 3,
  'as-west-wing': 2,
  'as-east-wing': 2,
  'som-admin': 2,
  'som-building-1': 3,
  'cultural-center': 1,
  'social-sciences': 2,
  'science-building': 3,
  'liadlaw-hall': 2,
  'up-cebu-library': 2,
  'up-high-school': 2,
}

function floorLabel(index: number): string {
  const n = index + 1
  if (n === 1) return '1st Floor'
  if (n === 2) return '2nd Floor'
  if (n === 3) return '3rd Floor'
  return `${n}th Floor`
}

export default function DisasterPickerPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const regionId = params.id as string
  const [hoveredType, setHoveredType] = useState<string | null>(null)
  const [selectedDisaster, setSelectedDisaster] = useState<string | null>(null)
  const [hoveredFloor, setHoveredFloor] = useState<number | null>(null)

  const floorCount = BUILDING_FLOOR_COUNT[regionId] || 2

  useEffect(() => {
    if (!isLoading && !isAuthenticated) window.location.href = '/auth'
  }, [isLoading, isAuthenticated])

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading...</div>
      </div>
    )
  }

  const displayName = regionId
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '88px 24px 56px' }}>
      <div style={{ width: '100%', maxWidth: '520px' }}>

        {/* Back button */}
        <button
          onClick={() => router.push('/simulate')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            background: 'none', border: 'none', color: 'var(--text-secondary)',
            fontSize: '13px', cursor: 'pointer', padding: '0', marginBottom: '32px',
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to map
        </button>

        {/* Header */}
        <div style={{ marginBottom: '36px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '6px 12px', borderRadius: '8px',
            background: 'rgba(45,184,176,0.08)', border: '1px solid rgba(45,184,176,0.15)',
            marginBottom: '16px',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" />
            </svg>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#2db8b0' }}>{displayName}</span>
          </div>
          <h1 style={{ margin: '0 0 8px', fontSize: '26px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Select Disaster Type
          </h1>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Choose which scenario to simulate for this building
          </p>
        </div>

        {/* Disaster cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {DISASTERS.map((d) => {
            const isHovered = hoveredType === d.type
            const isSelected = selectedDisaster === d.type
            return (
              <button
                key={d.type}
                onClick={() => setSelectedDisaster(selectedDisaster === d.type ? null : d.type)}
                onMouseEnter={() => setHoveredType(d.type)}
                onMouseLeave={() => setHoveredType(null)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '18px',
                  padding: '22px 24px',
                  background: isSelected ? d.hoverBg : isHovered ? d.hoverBg : d.bg,
                  border: `1.5px solid ${isSelected ? d.color : isHovered ? d.hoverBorder : d.border}`,
                  borderRadius: '14px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s ease',
                  transform: isHovered ? 'translateY(-1px)' : 'none',
                  boxShadow: isSelected ? `0 4px 16px ${d.color}20` : isHovered ? `0 8px 24px ${d.color}15` : 'none',
                }}
              >
                {/* Icon */}
                <div style={{
                  width: '48px', height: '48px', borderRadius: '14px',
                  background: `${d.color}12`,
                  border: `1px solid ${d.color}20`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all 0.2s',
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={d.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {d.iconPath}
                  </svg>
                </div>

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>
                    {d.label}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary, #94a3b8)', lineHeight: 1.5 }}>
                    {d.description}
                  </div>
                </div>

                {/* Arrow / Check */}
                {isSelected ? (
                  <svg
                    width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke={d.color}
                    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    style={{ flexShrink: 0 }}
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg
                    width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke={isHovered ? d.color : 'var(--text-muted, #475569)'}
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    style={{ flexShrink: 0, transition: 'all 0.2s', transform: isHovered ? 'translateX(2px)' : 'none' }}
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>

        {/* Floor picker — shown after disaster type is selected */}
        {selectedDisaster && (
          <div style={{ marginTop: '32px', animation: 'fadeInFloors 0.3s ease' }}>
            <style>{`
              @keyframes fadeInFloors {
                from { opacity: 0; transform: translateY(12px); }
                to   { opacity: 1; transform: translateY(0); }
              }
            `}</style>

            <h2 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              Select Floor
            </h2>
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Choose which floor to run the evacuation simulation on
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: floorCount >= 3 ? '1fr 1fr 1fr' : floorCount === 2 ? '1fr 1fr' : '1fr', gap: '10px' }}>
              {Array.from({ length: floorCount }, (_, i) => {
                const isFloorHovered = hoveredFloor === i
                const disasterMeta = DISASTERS.find(d => d.type === selectedDisaster)!
                return (
                  <button
                    key={i}
                    onClick={() => router.push(`/simulate/${encodeURIComponent(regionId)}/run?disaster=${selectedDisaster}&floor=${i}`)}
                    onMouseEnter={() => setHoveredFloor(i)}
                    onMouseLeave={() => setHoveredFloor(null)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
                      padding: '20px 16px',
                      background: isFloorHovered ? 'rgba(45,184,176,0.10)' : 'rgba(45,184,176,0.04)',
                      border: `1.5px solid ${isFloorHovered ? 'rgba(45,184,176,0.5)' : 'rgba(45,184,176,0.15)'}`,
                      borderRadius: '14px',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.2s ease',
                      transform: isFloorHovered ? 'translateY(-2px)' : 'none',
                      boxShadow: isFloorHovered ? '0 8px 24px rgba(45,184,176,0.15)' : 'none',
                    }}
                  >
                    {/* Floor icon */}
                    <div style={{
                      width: '44px', height: '44px', borderRadius: '12px',
                      background: isFloorHovered ? 'rgba(45,184,176,0.15)' : 'rgba(45,184,176,0.08)',
                      border: '1px solid rgba(45,184,176,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.2s',
                    }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <line x1="3" y1="9" x2="21" y2="9" />
                        <line x1="9" y1="21" x2="9" y2="9" />
                      </svg>
                    </div>

                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>
                        {floorLabel(i)}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {disasterMeta.label}
                      </div>
                    </div>

                    <svg
                      width="16" height="16" viewBox="0 0 24 24" fill="none"
                      stroke={isFloorHovered ? '#2db8b0' : 'var(--text-muted, #475569)'}
                      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      style={{ transition: 'all 0.2s' }}
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
