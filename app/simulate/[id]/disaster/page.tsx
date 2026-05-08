'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/src/hooks/useAuth'
import { BUILDING_FLOOR_COUNT } from '@/src/config/building-floor-counts'

interface Disaster {
  type: 'fire' | 'earthquake'
  label: string
  description: string
  /** Plain-language scenario tag shown beneath the title */
  tag: string
  color: string
  colorDark: string
  bgGradient: string
  selectedGradient: string
  icon: React.ReactNode
}

const DISASTERS: Disaster[] = [
  {
    type: 'fire',
    label: 'Fire Simulation',
    description: 'Model fire outbreak with progressive smoke spread and blocked exits.',
    tag: 'High urgency · Smoke + flame',
    color: '#ff6b35',
    colorDark: '#c2410c',
    bgGradient: 'linear-gradient(135deg, rgba(255,107,53,0.05) 0%, rgba(255,107,53,0.02) 100%)',
    selectedGradient: 'linear-gradient(135deg, rgba(255,107,53,0.14) 0%, rgba(255,107,53,0.06) 100%)',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ff6b35" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 21c-4.4 0-8-3.3-8-7.5 0-2.4 1.2-4.5 2.8-6.2C8.3 5.7 9.4 4 10 2c1.4.9 2.8 2.5 3.6 4.2.7-1 1.1-2 1.3-3.2 2.9 2.3 5.1 6 5.1 10.2 0 4.4-3.6 7.8-8 7.8z" />
        <path d="M12 18.2c-1.9 0-3.5-1.4-3.5-3.2 0-1.1.5-2 1.3-2.8.7-.6 1.2-1.3 1.5-2.2 1.6 1.1 2.9 2.9 2.9 5 0 1.8-1 3.2-2.2 3.2z" />
      </svg>
    ),
  },
  {
    type: 'earthquake',
    label: 'Earthquake Simulation',
    description: 'Model seismic shock with debris zones, blocked stairwells, and structural risk.',
    tag: 'Sustained tremor · Debris zones',
    color: '#f59e0b',
    colorDark: '#b45309',
    bgGradient: 'linear-gradient(135deg, rgba(245,158,11,0.05) 0%, rgba(245,158,11,0.02) 100%)',
    selectedGradient: 'linear-gradient(135deg, rgba(245,158,11,0.14) 0%, rgba(245,158,11,0.06) 100%)',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 8h18" />
        <path d="M3 16h18" />
        <path d="M9 5l-2 6 4 2-2 6" />
        <path d="M15 5l-2 6 4 2-2 6" />
      </svg>
    ),
  },
]

const AUTONOMOUS_BUILDING_IDS = new Set([
  'science-building',
  'up-cebu-library',
  'admin-building',
  'asx',
])

function floorLabel(index: number): string {
  const n = index + 1
  if (n === 1) return '1st Floor'
  if (n === 2) return '2nd Floor'
  if (n === 3) return '3rd Floor'
  return `${n}th Floor`
}

function getSimulationRoute(regionId: string, disaster: string, floorIndex: number) {
  const base = `/simulate/${encodeURIComponent(regionId)}`
  const query = `?disaster=${encodeURIComponent(disaster)}&floor=${floorIndex}`

  if (AUTONOMOUS_BUILDING_IDS.has(regionId)) {
    return `${base}/autonomous${query}`
  }

  return `${base}/run${query}`
}

export default function DisasterPickerPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const regionId = params.id as string
  const [hoveredType, setHoveredType] = useState<Disaster['type'] | null>(null)
  const [selectedDisaster, setSelectedDisaster] = useState<Disaster['type'] | null>(null)
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

  const step = selectedDisaster ? 2 : 1

  return (
    <div style={{
      minHeight: '100vh',
      padding: '64px 24px 56px',
      background:
        'radial-gradient(circle at 80% 0%, rgba(45,184,176,0.06) 0%, transparent 35%),' +
        'radial-gradient(circle at 0% 100%, rgba(245,158,11,0.04) 0%, transparent 35%),' +
        'linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)',
    }}>
      <div style={{ maxWidth: '780px', margin: '0 auto' }}>

        {/* Top row: back action + building/step badge */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '18px' }}>
          <button
            onClick={() => router.push('/map')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              background: 'none', border: 'none', color: 'var(--text-secondary)',
              fontSize: '13px', cursor: 'pointer', padding: '0', marginTop: '6px',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to buildings
          </button>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            padding: '6px 12px',
            borderRadius: '999px',
            background: 'rgba(255,255,255,0.85)',
            border: '1px solid var(--border)',
            backdropFilter: 'blur(6px)',
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--text-muted)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginRight: '8px',
            flexShrink: 0,
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2db8b0' }} />
            {displayName}
            <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#cbd5e1' }} />
            Step {step} of 2
          </div>
        </div>

        {/* Page header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{
            margin: '0 0 4px',
            fontSize: '26px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
          }}>
            {selectedDisaster ? 'Pick a floor to simulate' : 'Choose a disaster scenario'}
          </h1>
          <p style={{
            margin: 0,
            fontSize: '14px',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            maxWidth: '540px',
          }}>
            {selectedDisaster
              ? 'Each floor has its own evacuation plan. Pick the one to model.'
              : 'EVACSIM models how occupants of this building would evacuate under each scenario, with realistic hazard spread and crowd behavior.'}
          </p>
        </div>

        {/* Disaster cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '8px' }}>
          {DISASTERS.map((d) => {
            const isHovered = hoveredType === d.type
            const isSelected = selectedDisaster === d.type
            const isInactive = selectedDisaster !== null && !isSelected
            return (
              <button
                key={d.type}
                onClick={() => setSelectedDisaster(selectedDisaster === d.type ? null : d.type)}
                onMouseEnter={() => setHoveredType(d.type)}
                onMouseLeave={() => setHoveredType(null)}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '20px',
                  padding: '22px 24px',
                  background: isSelected
                    ? `${d.selectedGradient}, #ffffff`
                    : `${d.bgGradient}, #ffffff`,
                  border: `1.5px solid ${
                    isSelected ? d.color
                    : isHovered ? `${d.color}80`
                    : 'rgba(15,23,42,0.08)'
                  }`,
                  borderRadius: '16px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s ease',
                  transform: isHovered && !isSelected ? 'translateY(-2px)' : 'none',
                  boxShadow: isSelected
                    ? `0 10px 30px -10px ${d.color}60, 0 0 0 1px ${d.color}30 inset`
                    : isHovered
                      ? `0 12px 28px -10px ${d.color}40`
                      : '0 1px 2px rgba(15,23,42,0.04)',
                  opacity: isInactive ? 0.55 : 1,
                  overflow: 'hidden',
                }}
              >
                {/* Decorative accent stripe on the left when selected */}
                {isSelected && (
                  <span style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: '4px',
                    background: `linear-gradient(180deg, ${d.color} 0%, ${d.colorDark} 100%)`,
                  }} />
                )}

                {/* Icon */}
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '16px',
                  background: `linear-gradient(135deg, ${d.color}18 0%, ${d.color}08 100%)`,
                  border: `1px solid ${d.color}30`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'transform 0.2s',
                  transform: isHovered ? 'scale(1.05)' : 'scale(1)',
                  boxShadow: isHovered ? `0 6px 18px -6px ${d.color}50` : 'none',
                }}>
                  {d.icon}
                </div>

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '16px',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    marginBottom: '4px',
                    letterSpacing: '-0.02em',
                  }}>
                    {d.label}
                  </div>
                  <div style={{
                    fontSize: '13px',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                    marginBottom: '8px',
                  }}>
                    {d.description}
                  </div>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: d.colorDark,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: d.color }} />
                    {d.tag}
                  </div>
                </div>

                {/* Indicator */}
                <div style={{
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '36px',
                  height: '36px',
                  borderRadius: '12px',
                  background: isSelected ? d.color : isHovered ? `${d.color}15` : 'transparent',
                  color: isSelected ? '#ffffff' : isHovered ? d.color : '#cbd5e1',
                  transition: 'all 0.2s',
                }}>
                  {isSelected ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isHovered ? 'translateX(2px)' : 'none', transition: 'transform 0.2s' }}>
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Floor picker — shown after disaster type is selected */}
        {selectedDisaster && (
          <div style={{ marginTop: '36px', animation: 'fadeInFloors 0.35s ease' }}>
            <style>{`
              @keyframes fadeInFloors {
                from { opacity: 0; transform: translateY(16px); }
                to   { opacity: 1; transform: translateY(0); }
              }
            `}</style>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '4px',
            }}>
              <span style={{
                width: '22px',
                height: '22px',
                borderRadius: '7px',
                background: 'rgba(45,184,176,0.12)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#1f9189',
                fontSize: '11px',
                fontWeight: 700,
              }}>
                2
              </span>
              <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Available floors
              </h2>
              <span style={{
                marginLeft: 'auto',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--text-muted)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}>
                {floorCount} floor{floorCount === 1 ? '' : 's'}
              </span>
            </div>
            <p style={{ margin: '0 0 16px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Floors with authored navigation graphs run on the autonomous engine; others use the manual route.
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: floorCount >= 3 ? 'repeat(3, 1fr)' : floorCount === 2 ? '1fr 1fr' : '1fr',
              gap: '12px',
            }}>
              {Array.from({ length: floorCount }, (_, i) => {
                const isFloorHovered = hoveredFloor === i
                const disasterMeta = DISASTERS.find(d => d.type === selectedDisaster)!
                return (
                  <button
                    key={i}
                    onClick={() => {
                      if (!selectedDisaster) return
                      router.push(getSimulationRoute(regionId, selectedDisaster, i))
                    }}
                    onMouseEnter={() => setHoveredFloor(i)}
                    onMouseLeave={() => setHoveredFloor(null)}
                    style={{
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: '14px',
                      padding: '18px 18px 16px',
                      background: '#ffffff',
                      border: `1.5px solid ${isFloorHovered ? 'rgba(45,184,176,0.5)' : 'rgba(15,23,42,0.08)'}`,
                      borderRadius: '14px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s ease',
                      transform: isFloorHovered ? 'translateY(-3px)' : 'none',
                      boxShadow: isFloorHovered
                        ? '0 14px 32px -12px rgba(45,184,176,0.4)'
                        : '0 1px 2px rgba(15,23,42,0.04)',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Top accent stripe */}
                    <span style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '3px',
                      background: isFloorHovered
                        ? `linear-gradient(90deg, #2db8b0 0%, ${disasterMeta.color} 100%)`
                        : 'transparent',
                      transition: 'background 0.2s',
                    }} />

                    {/* Floor visual + number */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                    }}>
                      <FloorStackIcon
                        floorIndex={i}
                        totalFloors={floorCount}
                        active={isFloorHovered}
                      />
                      <div style={{
                        fontSize: '32px',
                        fontWeight: 700,
                        lineHeight: 1,
                        color: isFloorHovered ? '#1f9189' : '#cbd5e1',
                        fontFeatureSettings: '"tnum"',
                        letterSpacing: '-0.02em',
                        transition: 'color 0.2s',
                      }}>
                        {i + 1}
                      </div>
                    </div>

                    {/* Label */}
                    <div style={{ width: '100%' }}>
                      <div style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        marginBottom: '2px',
                      }}>
                        {floorLabel(i)}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                      }}>
                        Run {disasterMeta.label.toLowerCase()}
                      </div>
                    </div>

                    {/* Bottom action */}
                    <div style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      paddingTop: '12px',
                      borderTop: '1px dashed var(--border)',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: isFloorHovered ? '#1f9189' : 'var(--text-muted)',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      transition: 'color 0.2s',
                    }}>
                      <span>Open simulation</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isFloorHovered ? 'translateX(3px)' : 'none', transition: 'transform 0.2s' }}>
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
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

/**
 * Mini stack-of-floors icon. The active floor (the one this button represents)
 * is highlighted in the brand color; surrounding floors are rendered in muted
 * grey so the user can see where in the building they're picking.
 */
function FloorStackIcon({ floorIndex, totalFloors, active }: { floorIndex: number; totalFloors: number; active: boolean }) {
  // Render top-down (highest floor at top of stack visually)
  const floors = Array.from({ length: totalFloors }, (_, i) => totalFloors - 1 - i)
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '2px',
      width: '34px',
    }}>
      {floors.map((f) => {
        const isActiveFloor = f === floorIndex
        return (
          <div
            key={f}
            style={{
              height: '6px',
              borderRadius: '2px',
              background: isActiveFloor
                ? (active ? '#2db8b0' : '#1f9189')
                : 'rgba(15,23,42,0.06)',
              transform: isActiveFloor && active ? 'scaleX(1.05)' : 'scaleX(1)',
              transformOrigin: 'left center',
              transition: 'background 0.2s, transform 0.2s',
            }}
          />
        )
      })}
    </div>
  )
}
