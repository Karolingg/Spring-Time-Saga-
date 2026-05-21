'use client'

import { useEffect, useMemo, useState } from 'react'
import { getBuildingById } from '@/src/simulation/building-model'
import { createSimulation, stepSimulation } from '@/src/simulation/engine'
import { distributeAgentsByCapacity } from '@/src/simulation/autonomous-analytics'
import { placedHazardToZone, type PlacedHazard } from '@/src/simulation/hazard-placement'

/**
 * Exit Utilization Breakdown.
 *
 * Re-simulates the saved run (seed + hazards + per-room allocation) and counts
 * which exit each occupant evacuated through. A run can report "all reachable
 * exits" yet still funnel 90% of people through one door — that imbalance is
 * the real bottleneck story, and it isn't visible in the headline KPIs.
 */
interface ExitUtilizationBreakdownProps {
  buildingId: string | null
  simulatedFloorIndex: number | null
  disasterType: 'fire' | 'earthquake' | null
  hazards: PlacedHazard[] | null
  agentsPerRoom: Record<string, number> | null
  seed: number | null
  agentCount: number | null
}

const HAZARD_GROWTH_MULTIPLIER = 0.45
// Matches the heatmap replay's timestep so this breakdown and the heatmap on
// the same report agree with each other.
const STEP_DT = 0.1
const BATCH_BUDGET_MS = 14
const MAX_STEPS = 12000

/** Distinct, print-safe colours assigned to exits in evacuee-count order. */
const EXIT_COLORS = ['#2db8b0', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#0ea5e9']

interface ExitRow {
  label: string
  count: number
}

interface UtilResult {
  exits: ExitRow[]
  /** Occupants that never reached an exit (trapped + still-moving stragglers). */
  notEvacuated: number
  total: number
}

export function ExitUtilizationBreakdown({
  buildingId,
  simulatedFloorIndex,
  disasterType,
  hazards,
  agentsPerRoom,
  seed,
  agentCount,
}: ExitUtilizationBreakdownProps) {
  const floor = useMemo(() => {
    if (!buildingId || simulatedFloorIndex == null) return null
    const building = getBuildingById(buildingId)
    return building?.floors[simulatedFloorIndex] ?? null
  }, [buildingId, simulatedFloorIndex])

  const allocations = useMemo(() => {
    if (agentsPerRoom && Object.keys(agentsPerRoom).length > 0) return agentsPerRoom
    if (floor && agentCount && agentCount > 0) return distributeAgentsByCapacity(floor, agentCount)
    return null
  }, [agentsPerRoom, floor, agentCount])

  const [result, setResult] = useState<UtilResult | null>(null)
  const [isComputing, setIsComputing] = useState(false)

  useEffect(() => {
    if (!floor || !allocations) {
      setResult(null)
      return
    }
    const totalAgents = Object.values(allocations).reduce((s, v) => s + v, 0)
    if (totalAgents <= 0) {
      setResult(null)
      return
    }

    let cancelled = false
    setIsComputing(true)

    let state = createSimulation(floor, {
      disasterType: (disasterType ?? 'fire') as 'fire' | 'earthquake',
      agentsPerRoom: allocations,
      hazardGrowthMultiplier: HAZARD_GROWTH_MULTIPLIER,
      hazardOverrides: hazards != null
        ? hazards.map((h) => placedHazardToZone(h, `exit-util-${buildingId}-${simulatedFloorIndex ?? 0}`))
        : undefined,
      seed: seed ?? undefined,
    })
    state.running = true
    let steps = 0

    // When an agent evacuates, the engine sets `currentNodeId` to the exit
    // node it walked into — so the final state tells us which door it used.
    const exitLabelById = new Map(
      floor.nodes.filter((n) => n.type === 'exit').map((n) => [n.id, n.label]),
    )

    const runBatch = () => {
      if (cancelled) return
      const batchStart = performance.now()
      while (performance.now() - batchStart < BATCH_BUDGET_MS && steps < MAX_STEPS) {
        const active = state.agents.filter((a) => a.state !== 'evacuated' && a.state !== 'trapped')
        if (active.length === 0) break
        state = stepSimulation(state, floor, STEP_DT)
        steps++
      }

      const allResolved = state.agents.every((a) => a.state === 'evacuated' || a.state === 'trapped')
      if (allResolved || steps >= MAX_STEPS) {
        const counts = new Map<string, number>()
        let notEvacuated = 0
        for (const agent of state.agents) {
          if (agent.state === 'evacuated') {
            const label = exitLabelById.get(agent.currentNodeId) ?? 'Unknown exit'
            counts.set(label, (counts.get(label) ?? 0) + 1)
          } else {
            // Trapped agents and any stragglers still moving at MAX_STEPS.
            notEvacuated++
          }
        }
        const exits: ExitRow[] = [...counts.entries()]
          .map(([label, count]) => ({ label, count }))
          .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
        if (!cancelled) {
          setResult({ exits, notEvacuated, total: state.agents.length })
          setIsComputing(false)
        }
        return
      }
      setTimeout(runBatch, 0)
    }

    runBatch()
    return () => { cancelled = true }
  }, [floor, allocations, disasterType, hazards, seed, buildingId, simulatedFloorIndex])

  if (!floor) {
    return (
      <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
        Exit utilization requires a building with a floor model.
      </p>
    )
  }

  if (isComputing || !result) {
    return (
      <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
        Computing exit utilization…
      </p>
    )
  }

  const evacuated = result.exits.reduce((s, e) => s + e.count, 0)

  if (evacuated === 0) {
    return (
      <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
        No occupants reached an exit in this run — every route to an exit was
        cut off by the hazard. See the heatmap for where agents were stranded.
      </p>
    )
  }

  const topShare = Math.round((result.exits[0].count / evacuated) * 100)
  const imbalanced = result.exits.length > 1 && topShare >= 65

  return (
    <div>
      <p style={{ margin: '0 0 14px', fontSize: '13px', lineHeight: 1.6, color: '#1e293b' }}>
        Evacuee load split across {result.exits.length}{' '}
        {result.exits.length === 1 ? 'exit' : 'exits'} on a deterministic re-run
        of this drill.
        {imbalanced && (
          <>
            {' '}
            <strong>{result.exits[0].label}</strong> alone carried {topShare}% of
            the evacuees — a load imbalance worth rebalancing with signage or
            staged release.
          </>
        )}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {result.exits.map((exit, i) => {
          const pct = (exit.count / evacuated) * 100
          const color = EXIT_COLORS[i % EXIT_COLORS.length]
          return (
            <div key={exit.label} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '64px', flexShrink: 0,
                fontSize: '13px', fontWeight: 700, color: '#0f172a',
              }}>
                {exit.label}
              </div>
              <div style={{
                flex: 1, height: '20px', borderRadius: '6px',
                background: '#f1f5f9', overflow: 'hidden',
                border: '1px solid #e2e8f0',
              }}>
                <div style={{
                  height: '100%', width: `${Math.max(pct, 2)}%`,
                  background: color, borderRadius: '5px',
                  transition: 'width 0.3s ease',
                }} />
              </div>
              <div style={{
                width: '108px', flexShrink: 0, textAlign: 'right',
                fontSize: '12px', color: '#475569',
              }}>
                <strong style={{ color: '#0f172a' }}>{exit.count}</strong>
                {' '}· {pct.toFixed(0)}%
              </div>
            </div>
          )
        })}

        {result.notEvacuated > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '64px', flexShrink: 0,
              fontSize: '12px', fontWeight: 700, color: '#b91c1c',
            }}>
              Trapped
            </div>
            <div style={{
              flex: 1, height: '20px', borderRadius: '6px',
              background: '#f1f5f9', overflow: 'hidden', border: '1px solid #e2e8f0',
            }}>
              <div style={{
                height: '100%',
                width: `${Math.max((result.notEvacuated / result.total) * 100, 2)}%`,
                background: '#ef4444', borderRadius: '5px',
              }} />
            </div>
            <div style={{
              width: '108px', flexShrink: 0, textAlign: 'right',
              fontSize: '12px', color: '#475569',
            }}>
              <strong style={{ color: '#b91c1c' }}>{result.notEvacuated}</strong>
              {' '}· {((result.notEvacuated / result.total) * 100).toFixed(0)}%
            </div>
          </div>
        )}
      </div>

      <p style={{ margin: '14px 0 0', fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>
        Percentages are share of evacuees per exit; the trapped row is share of
        all occupants. Derived from a deterministic re-run of the saved seed.
      </p>
    </div>
  )
}
