'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/src/hooks/useAuth'
import {
  createSimulationRun,
  saveSimulationResults,
} from '@/src/services/simulation.service'
import type { DisasterType, RiskLevel, SeverityLevel } from '@/src/schema/enums'

function SliderRow({ label, value, min, max, onChange }: {
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0' }}>
      <span style={{ fontSize: '13px', color: 'var(--text-primary)', minWidth: '110px' }}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: '#2db8b0', cursor: 'pointer' }}
      />
      <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', minWidth: '36px', textAlign: 'right' }}>{value}</span>
    </div>
  )
}

export default function SimulatePage() {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth()

  const [agents, setAgents] = useState(120)
  const [gridWidth, setGridWidth] = useState(60)
  const [gridHeight, setGridHeight] = useState(45)
  const [exits, setExits] = useState(6)
  const [wallDensity, setWallDensity] = useState(10)
  const [speed, setSpeed] = useState(200)

  // Saved config (applied)
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

  // Simulate stepping
  useEffect(() => {
    if (!isRunning) return
    const interval = setInterval(() => {
      setStep(s => s + 1)
      setEvacuated(e => {
        const next = Math.min(e + Math.floor(Math.random() * 3), applied.agents)
        if (next >= applied.agents) {
          setIsRunning(false)
          setTimeout(() => handleSaveResults('completed'), 0)
        }
        return next
      })
      setMaxCongestion(m => Math.min(m + Math.floor(Math.random() * 2), 20))
    }, applied.speed)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, applied])

  if (isAuthLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading...</div>
      </div>
    )
  }

  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const disasterType = (params?.get('disaster') ?? 'fire') as DisasterType
  const isFireMode = disasterType === 'fire'
  const accentColor = isFireMode ? '#ff6b35' : '#f59e0b'
  const modeLabel = isFireMode ? 'Fire Simulation' : 'Earthquake Simulation'

  async function handleApply() {
    setApplied({ agents, gridWidth, gridHeight, exits, wallDensity, speed })
    setStep(0)
    setEvacuated(0)
    setMaxCongestion(0)
    setIsRunning(false)
    setRunId(null)
  }

  function handleReset() {
    setAgents(120); setGridWidth(60); setGridHeight(45)
    setExits(6); setWallDensity(10); setSpeed(200)
    setStep(0); setEvacuated(0); setMaxCongestion(0); setIsRunning(false)
  }

  async function handleToggleSim() {
    if (isRunning) {
      setIsRunning(false)
      await handleSaveResults('stopped')
      return
    }

    if (!runId) {
      try {
        const id = await createSimulationRun({
          disasterType,
          agentCount: applied.agents,
          gridWidth: applied.gridWidth,
          gridHeight: applied.gridHeight,
          exitCount: applied.exits,
          wallDensity: applied.wallDensity,
          speedMs: applied.speed,
        })
        setRunId(id)
      } catch (err) {
        console.error('Failed to create simulation run:', err)
        return
      }
    }

    setIsRunning(true)
  }

  const CAMPUS_ZONES = [
    { zoneName: 'Main Entrance', lat: 10.33115, lng: 123.90095 },
    { zoneName: 'Science Hall', lat: 10.33105, lng: 123.90080 },
    { zoneName: 'Library', lat: 10.33120, lng: 123.90100 },
    { zoneName: 'Admin Building', lat: 10.33100, lng: 123.90110 },
    { zoneName: 'Engineering', lat: 10.33125, lng: 123.90075 },
    { zoneName: 'Cafeteria', lat: 10.33110, lng: 123.90120 },
  ]

  async function handleSaveResults(finalStatus: 'completed' | 'stopped') {
    if (!runId || isSaving) return
    setIsSaving(true)

    try {
      const evacuationRate = evacuated / applied.agents
      const congestionRatio = maxCongestion / 20

      const zones = CAMPUS_ZONES.map((zone, i) => {
        const baseIntensity = (1 - evacuationRate) * 100
        const variation = ((i * 17 + step) % 30) - 15
        const intensity = Math.max(0, Math.min(100, baseIntensity + variation))
        const zoneAgents = Math.round((intensity / 100) * (applied.agents / CAMPUS_ZONES.length))
        const bottleneckCount = intensity > 70 ? Math.ceil((intensity - 70) / 15) : 0
        const riskLevel: RiskLevel = intensity > 75 ? 'HIGH' : intensity > 50 ? 'MEDIUM' : 'LOW'

        return {
          zoneName: zone.zoneName,
          intensity,
          agentCount: zoneAgents,
          bottleneckCount,
          riskLevel,
          lat: zone.lat,
          lng: zone.lng,
        }
      })

      const bottleneckRecords = zones
        .filter(z => z.bottleneckCount > 0)
        .map(z => ({
          zoneName: z.zoneName,
          severity: z.riskLevel as SeverityLevel,
          cellX: Math.floor(Math.random() * applied.gridWidth),
          cellY: Math.floor(Math.random() * applied.gridHeight),
          description: `Congestion detected near ${z.zoneName} (${z.intensity.toFixed(0)}% intensity)`,
        }))

      await saveSimulationResults(
        runId,
        {
          totalSteps: step,
          evacuatedCount: evacuated,
          maxCongestion,
          evacuationTime: step * (applied.speed / 1000),
          congestionExposure: congestionRatio * 100,
          globalPeakDensity: maxCongestion / 20,
          status: finalStatus,
        },
        zones,
        bottleneckRecords,
      )
    } catch (err) {
      console.error('Failed to save simulation results:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const sectionCard = {
    background: '#ffffff',
    border: '1px solid var(--border)',
    borderRadius: '14px',
    padding: '28px 32px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    marginBottom: '20px',
  } as React.CSSProperties

  return (
    <div style={{ minHeight: '100vh', padding: '88px 40px 56px', maxWidth: '1280px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '32px' }}>
        <div style={{
          width: '44px', height: '44px', borderRadius: '12px',
          background: `${accentColor}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '22px',
        }}>
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '26px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{modeLabel}</h1>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>Configure and run the evacuation simulation</p>
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px', alignItems: 'start' }}>
      <div>

      {/* Configuration */}
      <div style={sectionCard}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          <span style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Configuration</span>
        </div>
        <div style={{ borderTop: '1px solid var(--border)' }}>
          <SliderRow label="Agents" value={agents} min={10} max={500} onChange={setAgents} />
          <SliderRow label="Grid Width" value={gridWidth} min={20} max={100} onChange={setGridWidth} />
          <SliderRow label="Grid Height" value={gridHeight} min={20} max={100} onChange={setGridHeight} />
          <SliderRow label="Exits" value={exits} min={1} max={12} onChange={setExits} />
          <SliderRow label="Wall Density" value={wallDensity} min={0} max={40} onChange={setWallDensity} />
          <SliderRow label="Speed (ms)" value={speed} min={50} max={1000} onChange={setSpeed} />
        </div>
        <button
          onClick={handleApply}
          style={{
            marginTop: '16px',
            width: '100%',
            padding: '10px',
            background: '#f1f5f9',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: '700',
            letterSpacing: '0.08em',
            color: 'var(--text-secondary)',
            textTransform: 'uppercase' as const,
            cursor: 'pointer',
          }}
        >
          Apply &amp; Reset
        </button>
      </div>


      </div>{/* end left column */}

      {/* Right column: Controls + Live Stats */}
      <div>

      {/* Controls */}
      <div style={sectionCard}>
        <span style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase' as const, display: 'block', marginBottom: '16px' }}>Controls</span>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleToggleSim}
            style={{
              flex: 1,
              padding: '14px',
              background: isRunning ? '#f59e0b' : '#2db8b0',
              border: 'none',
              borderRadius: '8px',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            {isRunning ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                Pause
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Start
              </>
            )}
          </button>
          <button
            onClick={handleReset}
            title="Reset"
            style={{
              width: '48px',
              height: '48px',
              background: '#f1f5f9',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.87L1 10"/>
            </svg>
          </button>
        </div>
        {!isRunning && step === 0 && (
          <div style={{
            marginTop: '12px',
            padding: '12px 14px',
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.2)',
            borderRadius: '8px',
            fontSize: '12px',
            color: '#92400e',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            Apply configuration, then press Start to begin simulation
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
      </div>

      {/* Live Stats */}
      <div style={sectionCard}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2db8b0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
          <span style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase' as const }}>Live Stats</span>
        </div>
        {[
          { label: 'Step', value: step },
          { label: 'Evacuated', value: `${evacuated}/${applied.agents}` },
          { label: 'Max Congestion', value: maxCongestion, color: maxCongestion > 10 ? '#ef4444' : '#2db8b0' },
        ].map((stat, i) => (
          <div key={i} style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 0',
            borderTop: i === 0 ? '1px solid var(--border)' : 'none',
            borderBottom: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <span>{stat.label}</span>
            </div>
            <span style={{ fontSize: '15px', fontWeight: '600', color: stat.color ?? 'var(--text-primary)' }}>{stat.value}</span>
          </div>
        ))}
      </div>

      </div>
      </div>
    </div>
  )
}
