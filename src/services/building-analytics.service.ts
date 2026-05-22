import { supabase } from '@/src/config/supabase'
import { getCurrentUserCacheKey, ReadThroughCache } from '@/src/services/read-cache'
import type { ScenarioSeverity } from '@/src/services/simulation.service'

export type BuildingGrade = 'A' | 'B' | 'C' | 'D' | 'F'

const SCENARIO_WEIGHT: Record<ScenarioSeverity, number> = {
  minor: 0.6,
  moderate: 1.0,
  severe: 1.4,
}
const UNCLASSIFIED_WEIGHT = SCENARIO_WEIGHT.minor

const MIN_OCCUPANCY_RATIO = 0.2
const MAX_OCCUPANCY_RATIO = 1.5

const TIME_FULL_CREDIT_S = 60
const TIME_ZERO_CREDIT_S = 300

const BN_ZERO_PENALTY    = 0
const BN_MAX_PENALTY     = 5

const PD_FULL_CREDIT     = 0.5
const PD_ZERO_CREDIT     = 1.0

const CAP_NO_SEVERE_SCORE   = 89
const CAP_NO_MODERATE_SCORE = 79

const buildingScoreCache = new ReadThroughCache()

export function clearBuildingScoreCache() {
  buildingScoreCache.clear()
}

export interface FloorScore {
  floorIndex: number
  runCount: number
  totalWeight: number
  score: number
  grade: BuildingGrade
  avgEvacuationRate: number
  avgEvacuationTime: number
  avgBottlenecks: number
  avgPeakDensity: number
}

export interface ScenarioCoverage {
  severe: number
  moderate: number
  minor: number
  unclassified: number
}

export interface BuildingScore {
  buildingId: string
  runCount: number
  score: number
  grade: BuildingGrade
  rawScore: number
  rawGrade: BuildingGrade
  avgEvacuationRate: number
  avgEvacuationTime: number
  avgBottlenecks: number
  avgPeakDensity: number
  floorBreakdown: FloorScore[]
  coverage: ScenarioCoverage
  cap: {
    maxGrade: BuildingGrade
    maxScore: number
    reason: string
  } | null
}

interface RunRow    { id: string; floor_index: number | null; scenario_severity: ScenarioSeverity | null }
interface ResultRow { run_id: string; evacuated_count: number; evacuation_time: number; global_peak_density: number }
interface ConfigRow { run_id: string; agent_count: number }
interface BnRow     { run_id: string }

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function scoreToGrade(score: number): BuildingGrade {
  return score >= 90 ? 'A' :
         score >= 80 ? 'B' :
         score >= 70 ? 'C' :
         score >= 60 ? 'D' : 'F'
}

function scoreOneRun(args: {
  rate: number
  time: number
  bottlenecks: number
  peakDensity: number
}): number {
  const rate = clamp01(args.rate)
  const time = Math.max(0, args.time)
  const bn   = Math.max(0, args.bottlenecks)
  const pd   = clamp01(args.peakDensity)

  const ratePts = rate * 50

  const timePts =
    time <= TIME_FULL_CREDIT_S ? 25 :
    time >= TIME_ZERO_CREDIT_S ?  0 :
    25 * (1 - (time - TIME_FULL_CREDIT_S) / (TIME_ZERO_CREDIT_S - TIME_FULL_CREDIT_S))

  const bnPts =
    bn <= BN_ZERO_PENALTY ? 15 :
    bn >= BN_MAX_PENALTY  ?  0 :
    15 * (1 - bn / BN_MAX_PENALTY)

  const pdPts =
    pd <= PD_FULL_CREDIT ? 10 :
    pd >= PD_ZERO_CREDIT ?  0 :
    10 * (1 - (pd - PD_FULL_CREDIT) / (PD_ZERO_CREDIT - PD_FULL_CREDIT))

  return ratePts + timePts + bnPts + pdPts
}

function runWeight(severity: ScenarioSeverity | null, agentCount: number, buildingCapacity: number): number {
  const sc = severity == null ? UNCLASSIFIED_WEIGHT : SCENARIO_WEIGHT[severity]
  const occRaw = buildingCapacity > 0 ? agentCount / buildingCapacity : 1
  const occ = clamp(occRaw, MIN_OCCUPANCY_RATIO, MAX_OCCUPANCY_RATIO)
  return sc * occ
}

function applyCoverageCap(coverage: ScenarioCoverage, rawScore: number, rawGrade: BuildingGrade): {
  score: number
  grade: BuildingGrade
  cap: BuildingScore['cap']
} {
  if (coverage.severe > 0) {
    return { score: rawScore, grade: rawGrade, cap: null }
  }
  if (coverage.moderate > 0) {
    const capped = Math.min(rawScore, CAP_NO_SEVERE_SCORE)
    return {
      score: capped,
      grade: scoreToGrade(capped),
      cap: {
        maxGrade: 'B',
        maxScore: CAP_NO_SEVERE_SCORE,
        reason: 'Grade capped at B — no severe-scenario drill has been run on this building.',
      },
    }
  }
  const capped = Math.min(rawScore, CAP_NO_MODERATE_SCORE)
  return {
    score: capped,
    grade: scoreToGrade(capped),
    cap: {
      maxGrade: 'C',
      maxScore: CAP_NO_MODERATE_SCORE,
      reason: 'Grade capped at C — only minor / unclassified drills have been run. Test a moderate or severe scenario to unlock higher grades.',
    },
  }
}

async function fetchRunRows(buildingId: string): Promise<RunRow[] | null> {
  const primary = await supabase
    .from('simulation_runs')
    .select('id, floor_index, scenario_severity')
    .eq('building_id', buildingId)
    .eq('status', 'completed')

  if (!primary.error) {
    return (primary.data ?? []) as unknown as RunRow[]
  }

  if (/scenario_severity/i.test(primary.error.message)) {
    const noSeverity = await supabase
      .from('simulation_runs')
      .select('id, floor_index')
      .eq('building_id', buildingId)
      .eq('status', 'completed')

    if (!noSeverity.error) {
      return (noSeverity.data as unknown as { id: string; floor_index: number | null }[]).map(r => ({
        id: r.id,
        floor_index: r.floor_index,
        scenario_severity: null,
      }))
    }

    if (/floor_index/i.test(noSeverity.error.message)) {
      const bare = await supabase
        .from('simulation_runs')
        .select('id')
        .eq('building_id', buildingId)
        .eq('status', 'completed')
      if (bare.error) throw new Error(bare.error.message)
      return (bare.data as unknown as { id: string }[]).map(r => ({
        id: r.id,
        floor_index: null,
        scenario_severity: null,
      }))
    }

    throw new Error(noSeverity.error.message)
  }

  throw new Error(primary.error.message)
}

async function loadBuildingScore(
  buildingId: string,
  buildingCapacity: number,
): Promise<BuildingScore | null> {
  const runRows = await fetchRunRows(buildingId)
  if (!runRows || runRows.length === 0) return null
  const runs = runRows
  const runIds = runRows.map(r => r.id)

  const [resultRes, configRes, bnRes] = await Promise.all([
    supabase
      .from('simulation_results')
      .select('run_id, evacuated_count, evacuation_time, global_peak_density')
      .in('run_id', runIds),
    supabase
      .from('simulation_configs')
      .select('run_id, agent_count')
      .in('run_id', runIds),
    supabase
      .from('simulation_bottlenecks')
      .select('run_id')
      .in('run_id', runIds),
  ])

  if (resultRes.error) throw new Error(resultRes.error.message)
  if (configRes.error) throw new Error(configRes.error.message)
  if (bnRes.error)     throw new Error(bnRes.error.message)

  const results = (resultRes.data ?? []) as ResultRow[]
  const configs = (configRes.data ?? []) as ConfigRow[]
  const bnRows  = (bnRes.data   ?? []) as BnRow[]
  if (results.length === 0) return null

  const runMeta = new Map(runRows.map(r => [r.id, {
    floorIndex: r.floor_index,
    severity:   r.scenario_severity,
  }]))
  const agentCountByRun  = new Map(configs.map(c => [c.run_id, c.agent_count]))
  const bottlenecksByRun = new Map<string, number>()
  for (const b of bnRows) {
    bottlenecksByRun.set(b.run_id, (bottlenecksByRun.get(b.run_id) ?? 0) + 1)
  }

  const coverage: ScenarioCoverage = { severe: 0, moderate: 0, minor: 0, unclassified: 0 }
  for (const r of runRows) {
    if (r.scenario_severity == null)        coverage.unclassified++
    else if (r.scenario_severity === 'severe')   coverage.severe++
    else if (r.scenario_severity === 'moderate') coverage.moderate++
    else                                    coverage.minor++
  }

  const byFloor = new Map<number | null, ResultRow[]>()
  for (const r of results) {
    const meta = runMeta.get(r.run_id)
    const fi = meta?.floorIndex ?? null
    if (!byFloor.has(fi)) byFloor.set(fi, [])
    byFloor.get(fi)!.push(r)
  }

  function scoreFloorGroup(groupResults: ResultRow[]): Omit<FloorScore, 'floorIndex'> {
    let scoreWSum = 0, rateWSum = 0, timeWSum = 0, bnWSum = 0, pdWSum = 0
    let weightSum = 0

    for (const r of groupResults) {
      const meta        = runMeta.get(r.run_id)
      const severity    = meta?.severity ?? null
      const agentCount  = agentCountByRun.get(r.run_id) ?? 1
      const rate        = agentCount > 0 ? r.evacuated_count / agentCount : 0
      const time        = r.evacuation_time
      const bottlenecks = bottlenecksByRun.get(r.run_id) ?? 0
      const peakDensity = r.global_peak_density / 100

      const runScore = scoreOneRun({ rate, time, bottlenecks, peakDensity })
      const w        = runWeight(severity, agentCount, buildingCapacity)

      scoreWSum  += runScore   * w
      rateWSum   += rate       * w
      timeWSum   += time       * w
      bnWSum     += bottlenecks * w
      pdWSum     += peakDensity * w
      weightSum  += w
    }

    if (weightSum === 0) {
      return {
        runCount: groupResults.length,
        totalWeight: 0,
        score: 0,
        grade: 'F',
        avgEvacuationRate: 0,
        avgEvacuationTime: 0,
        avgBottlenecks: 0,
        avgPeakDensity: 0,
      }
    }

    const score = Math.round(scoreWSum / weightSum)
    return {
      runCount:          groupResults.length,
      totalWeight:       Number(weightSum.toFixed(3)),
      score,
      grade:             scoreToGrade(score),
      avgEvacuationRate: clamp01(rateWSum / weightSum),
      avgEvacuationTime: timeWSum / weightSum,
      avgBottlenecks:    bnWSum   / weightSum,
      avgPeakDensity:    clamp01(pdWSum / weightSum),
    }
  }

  const floorBreakdown: FloorScore[] = []
  for (const [fi, groupResults] of byFloor.entries()) {
    if (fi === null) continue
    floorBreakdown.push({ floorIndex: fi, ...scoreFloorGroup(groupResults) })
  }
  floorBreakdown.sort((a, b) => a.floorIndex - b.floorIndex)

  let rawScore:  number
  let rawGrade:  BuildingGrade
  let avgEvacuationRate: number
  let avgEvacuationTime: number
  let avgBottlenecks:    number
  let avgPeakDensity:    number

  const mean = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length

  if (floorBreakdown.length > 0) {
    rawScore = Math.round(mean(floorBreakdown.map(f => f.score)))
    rawGrade = scoreToGrade(rawScore)
    avgEvacuationRate = mean(floorBreakdown.map(f => f.avgEvacuationRate))
    avgEvacuationTime = mean(floorBreakdown.map(f => f.avgEvacuationTime))
    avgBottlenecks    = mean(floorBreakdown.map(f => f.avgBottlenecks))
    avgPeakDensity    = mean(floorBreakdown.map(f => f.avgPeakDensity))
  } else {
    const fg = scoreFloorGroup(results)
    rawScore = fg.score
    rawGrade = fg.grade
    avgEvacuationRate = fg.avgEvacuationRate
    avgEvacuationTime = fg.avgEvacuationTime
    avgBottlenecks    = fg.avgBottlenecks
    avgPeakDensity    = fg.avgPeakDensity
  }

  const capped = applyCoverageCap(coverage, rawScore, rawGrade)

  return {
    buildingId,
    runCount: runs.length,
    score:    capped.score,
    grade:    capped.grade,
    rawScore,
    rawGrade,
    avgEvacuationRate,
    avgEvacuationTime,
    avgBottlenecks,
    avgPeakDensity,
    floorBreakdown,
    coverage,
    cap:      capped.cap,
  }
}

export async function getBuildingScore(
  buildingId: string,
  buildingCapacity: number,
): Promise<BuildingScore | null> {
  const userKey = await getCurrentUserCacheKey('building-score')
  return buildingScoreCache.get(`${userKey}:${buildingId}:${buildingCapacity}`, () => (
    loadBuildingScore(buildingId, buildingCapacity)
  ))
}
