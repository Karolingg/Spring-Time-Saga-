/**
 * Building Evacuation Readiness Score — final design.
 *
 * Every number here is derived from completed simulation runs in the
 * database. There is no fabricated data.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  HOW THE SCORE IS BUILT
 * ─────────────────────────────────────────────────────────────────────────
 *
 *  1. Pull every COMPLETED run for the building, grouped by floor_index.
 *
 *  2. For each floor:
 *       a. Score each individual run (0–100 composite, see below).
 *       b. Weight each run by its scenario difficulty × occupancy ratio.
 *       c. Floor score = weighted average of run scores, rounded.
 *
 *  3. Building score = simple average of all floor scores, rounded.
 *
 *  4. Apply the mandatory-coverage cap (see "GRADE CAP" below).
 *
 *  5. Returns `null` when no completed runs exist — the UI shows
 *     "Unassessed" rather than a fabricated number.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  PER-RUN SCORE (0–100)
 * ─────────────────────────────────────────────────────────────────────────
 *
 *    50 pts  — Evacuation rate            evacuated_count / agent_count
 *    25 pts  — Evacuation time            ≤ 60s full, ≥ 300s zero, linear
 *    15 pts  — Bottleneck edge count      0 full, ≥ 5 zero, linear
 *    10 pts  — Peak crowd density         ≤ 50% full, ≥ 100% zero, linear
 *   ────────
 *   100 pts  — Composite score
 *
 *  Letter grade thresholds: A ≥ 90 · B ≥ 80 · C ≥ 70 · D ≥ 60 · F < 60.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  RUN WEIGHTING (Safeguard A — anti-gaming)
 * ─────────────────────────────────────────────────────────────────────────
 *
 *  A run cannot drag a building's grade up by being trivial. Each run's
 *  contribution to the floor's weighted average is:
 *
 *        weight = scenario_multiplier × occupancy_ratio
 *
 *  scenario_multiplier:
 *        minor        0.6
 *        moderate     1.0
 *        severe       1.4
 *        unclassified 0.6   (legacy runs, treated as minor)
 *
 *  occupancy_ratio = clamp(agent_count / building_capacity, 0.2, 1.5)
 *
 *  So a "severe + full building" drill counts ~10× as much as a "minor +
 *  near-empty" drill. Stakeholders running clean tiny drills can no longer
 *  dilute the score from a bad-but-realistic drill.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  GRADE CAP (Safeguard C — mandatory coverage)
 * ─────────────────────────────────────────────────────────────────────────
 *
 *  Even with a high weighted score, a building's published grade is capped
 *  by the toughest scenario actually tested on it:
 *
 *        has severe drill         → no cap (full A–F range)
 *        moderate, no severe      → max grade B  (score capped at 89)
 *        only minor / unclass.    → max grade C  (score capped at 79)
 *        no completed runs        → "Unassessed"
 *
 *  Combined with the weighting above, this prevents both styles of gaming:
 *  cherry-picking easy runs (weighting) and skipping hard scenarios
 *  entirely (cap).
 */

import { supabase } from '@/src/config/supabase'
import { getCurrentUserCacheKey, ReadThroughCache } from '@/src/services/read-cache'
import type { ScenarioSeverity } from '@/src/services/simulation.service'

export type BuildingGrade = 'A' | 'B' | 'C' | 'D' | 'F'

/* ── Scoring constants ───────────────────────────────────────────────────
 * Centralised so the formula is easy to audit and tune in one place. */

/** Run-weight multiplier per scenario severity bucket. */
const SCENARIO_WEIGHT: Record<ScenarioSeverity, number> = {
  minor: 0.6,
  moderate: 1.0,
  severe: 1.4,
}
/** Legacy / null-severity runs use the minor weight. */
const UNCLASSIFIED_WEIGHT = SCENARIO_WEIGHT.minor

/** Min/max bounds on occupancy_ratio. Stops one comically over-stuffed run
 *  from dominating, and stops a one-agent run from being weighted to zero
 *  (we'd rather it count, just barely). */
const MIN_OCCUPANCY_RATIO = 0.2
const MAX_OCCUPANCY_RATIO = 1.5

/** Time score band (seconds). */
const TIME_FULL_CREDIT_S = 60
const TIME_ZERO_CREDIT_S = 300

/** Bottleneck score band (count of bottleneck edges per run). */
const BN_ZERO_PENALTY    = 0
const BN_MAX_PENALTY     = 5

/** Peak density score band (0–1 normalised). */
const PD_FULL_CREDIT     = 0.5
const PD_ZERO_CREDIT     = 1.0

/** Grade-cap score ceilings — keep these one point below the next grade's
 *  threshold so the cap actually changes the letter, not just the number. */
const CAP_NO_SEVERE_SCORE   = 89   // → max grade B
const CAP_NO_MODERATE_SCORE = 79   // → max grade C

/* ── Public types ────────────────────────────────────────────────────────*/

export interface FloorScore {
  /** 1-based floor number (matches the floor_index stored on simulation_runs). */
  floorIndex: number
  /** Total runs on this floor (any severity, weighted or not). */
  runCount: number
  /** Sum of run weights — useful for telling "0 weighted runs" from "many". */
  totalWeight: number
  /** 0–100 weighted-average Evacuation Readiness Score for this floor. */
  score: number
  /** Letter grade derived from `score` (pre-cap). */
  grade: BuildingGrade
  /** Weighted-average metrics (per scenario_multiplier × occupancy_ratio). */
  avgEvacuationRate: number
  avgEvacuationTime: number
  avgBottlenecks: number
  avgPeakDensity: number
}

export interface ScenarioCoverage {
  severe: number
  moderate: number
  minor: number
  /** Runs with no scenario_severity (legacy data). */
  unclassified: number
}

export interface BuildingScore {
  buildingId: string
  /** Total completed runs across all floors. */
  runCount: number
  /**
   * Final published score (0–100), AFTER any coverage cap.
   * Equals `rawScore` when no cap applies.
   */
  score: number
  /** Final published letter grade, AFTER any coverage cap. */
  grade: BuildingGrade
  /** Pre-cap score (average of floor scores). For transparency / debugging. */
  rawScore: number
  /** Pre-cap grade. Useful when communicating *why* a building was capped. */
  rawGrade: BuildingGrade
  /** Building-level averages (mean of floor-level averages). */
  avgEvacuationRate: number
  avgEvacuationTime: number
  avgBottlenecks: number
  avgPeakDensity: number
  /**
   * Per-floor breakdown sorted floor 1 → top floor.
   * Empty when every completed run lacks a floor_index (legacy data).
   */
  floorBreakdown: FloorScore[]
  /** Scenario coverage across all runs for this building. */
  coverage: ScenarioCoverage
  /**
   * Cap applied to the grade due to missing scenario coverage, or null when
   * no cap fires. Lets the UI render an honest "capped at B because no
   * severe drill" message instead of just a quiet number.
   */
  cap: {
    /** Highest grade currently reachable for this building. */
    maxGrade: BuildingGrade
    /** Score ceiling that produced `maxGrade`. */
    maxScore: number
    /** Plain-language explanation. */
    reason: string
  } | null
}

/* ── Internal row shapes ─────────────────────────────────────────────────*/
interface RunRow    { id: string; floor_index: number | null; scenario_severity: ScenarioSeverity | null }
interface ResultRow { run_id: string; evacuated_count: number; evacuation_time: number; global_peak_density: number }
interface ConfigRow { run_id: string; agent_count: number }
interface BnRow     { run_id: string }

const buildingScoreCache = new ReadThroughCache()

export function clearBuildingScoreCache() {
  buildingScoreCache.clear()
}

/* ── Helpers ─────────────────────────────────────────────────────────────*/
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

/** Score one individual run on the 0–100 composite scale. */
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

/** Difficulty weight for a single run.  weight = scenario × occupancy. */
function runWeight(severity: ScenarioSeverity | null, agentCount: number, buildingCapacity: number): number {
  const sc = severity == null ? UNCLASSIFIED_WEIGHT : SCENARIO_WEIGHT[severity]
  const occRaw = buildingCapacity > 0 ? agentCount / buildingCapacity : 1
  const occ = clamp(occRaw, MIN_OCCUPANCY_RATIO, MAX_OCCUPANCY_RATIO)
  return sc * occ
}

/** Decide the cap (if any) given which severities have been tested. */
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
  // Only minor and/or unclassified runs exist.
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

/* ── Public API ──────────────────────────────────────────────────────────*/

/**
 * Defensive fetch of run-level metadata.
 *
 * Tries to pull the modern set of columns (`scenario_severity`, `floor_index`)
 * first. If the running database is behind on migrations and rejects the
 * unknown column, we retry with a smaller projection and synthesize null values
 * so the rest of the scoring pipeline can keep working. This lets the app boot
 * cleanly against a partially-migrated Supabase instance — useful during the
 * ship-to-stakeholders window where the production DB might lag the codebase
 * by a migration or two.
 */
async function fetchRunRows(buildingId: string): Promise<RunRow[] | null> {
  // First attempt — full projection (assumes all migrations applied)
  const primary = await supabase
    .from('simulation_runs')
    .select('id, floor_index, scenario_severity')
    .eq('building_id', buildingId)
    .eq('status', 'completed')

  if (!primary.error) {
    return (primary.data ?? []) as unknown as RunRow[]
  }

  // Fallback 1 — scenario_severity column missing (migration 20260516 not applied)
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

    // Fallback 2 — floor_index ALSO missing (migration 20260512 not applied)
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

  // Some other unexpected error — surface it
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
    /* One row per bottleneck edge (max 6/run). Counting rows here avoids the
     * historical double-count bug where each edge was credited once per
     * endpoint node and inflated the bottleneck total. */
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

  /* Lookup maps for fast per-run join. */
  const runMeta = new Map(runRows.map(r => [r.id, {
    floorIndex: r.floor_index,
    severity:   r.scenario_severity,
  }]))
  const agentCountByRun  = new Map(configs.map(c => [c.run_id, c.agent_count]))
  const bottlenecksByRun = new Map<string, number>()
  for (const b of bnRows) {
    bottlenecksByRun.set(b.run_id, (bottlenecksByRun.get(b.run_id) ?? 0) + 1)
  }

  /* Coverage tally — drives the grade cap. */
  const coverage: ScenarioCoverage = { severe: 0, moderate: 0, minor: 0, unclassified: 0 }
  for (const r of runRows) {
    if (r.scenario_severity == null)        coverage.unclassified++
    else if (r.scenario_severity === 'severe')   coverage.severe++
    else if (r.scenario_severity === 'moderate') coverage.moderate++
    else                                    coverage.minor++
  }

  /* Group result rows by floor_index. Null floor_index = legacy run; we
   * fold those into a synthetic group only used when no floor-tagged runs
   * exist (so a single building never mixes floor-tagged and legacy data
   * inside the same floor breakdown). */
  const byFloor = new Map<number | null, ResultRow[]>()
  for (const r of results) {
    const meta = runMeta.get(r.run_id)
    const fi = meta?.floorIndex ?? null
    if (!byFloor.has(fi)) byFloor.set(fi, [])
    byFloor.get(fi)!.push(r)
  }

  /* Score one group of result rows as a single floor — weighted average of
   * per-run scores, weighted by difficulty. */
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
      /* global_peak_density is stored as 0–100 (integer percent) — divide
       * by 100 to normalise to 0–1 so the scoring band thresholds work. */
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
      /* Should not happen — every weight is > 0 — but be defensive. */
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

  /* Build the floor breakdown. */
  const floorBreakdown: FloorScore[] = []
  for (const [fi, groupResults] of byFloor.entries()) {
    if (fi === null) continue
    floorBreakdown.push({ floorIndex: fi, ...scoreFloorGroup(groupResults) })
  }
  floorBreakdown.sort((a, b) => a.floorIndex - b.floorIndex)

  /* Building raw score: average of floor scores when we have floor-tagged
   * runs, otherwise score all (legacy) runs together as a single group. */
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
    /* Legacy fallback — every run lacks floor_index. */
    const fg = scoreFloorGroup(results)
    rawScore = fg.score
    rawGrade = fg.grade
    avgEvacuationRate = fg.avgEvacuationRate
    avgEvacuationTime = fg.avgEvacuationTime
    avgBottlenecks    = fg.avgBottlenecks
    avgPeakDensity    = fg.avgPeakDensity
  }

  /* Apply the mandatory-coverage cap. */
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
