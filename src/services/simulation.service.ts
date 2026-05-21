import { supabase } from '@/src/config/supabase'
import type {
  SimulationConfig,
  SimulationRun,
  SimulationZone,
  SimulationBottleneck,
  SimulationRunConfig,
  SimulationRunResults,
  DensityCell,
} from '@/src/schema/simulation.types'
import type { RiskLevel, SeverityLevel, SimulationStatus } from '@/src/schema/enums'
import type { PlacedHazard } from '@/src/simulation/hazard-placement'
import { GRID_COLS, GRID_ROWS } from '@/src/simulation/spatial-grid'
import { logAction } from '@/src/services/audit.service'
import { clearBuildingScoreCache } from '@/src/services/building-analytics.service'
import { getCurrentUserCacheKey, ReadThroughCache } from '@/src/services/read-cache'

export interface ReplayInputs {
  hazards: PlacedHazard[]
  agentsPerRoom: Record<string, number>
  seed: number
}

/** Severity bucket a saved run falls into. Drives the building's
 *  difficulty-weighted score and the mandatory-coverage grade cap. */
export type ScenarioSeverity = 'minor' | 'moderate' | 'severe'

type Row = Record<string, unknown>

const AGGREGATE_CACHE_MS = 60_000
const MAX_DENSITY_CELLS_PER_RUN = GRID_COLS * GRID_ROWS

const aggregateCache = new Map<string, { expiresAt: number; value?: unknown; promise?: Promise<unknown> }>()
const readCache = new ReadThroughCache()

async function getCachedAggregate<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const now = Date.now()
  const cached = aggregateCache.get(key)
  if (cached && cached.expiresAt > now) {
    if (cached.value !== undefined) return cached.value as T
    if (cached.promise) return cached.promise as Promise<T>
  }

  const promise = loader()
    .then((value) => {
      aggregateCache.set(key, { expiresAt: Date.now() + AGGREGATE_CACHE_MS, value })
      return value
    })
    .catch((error) => {
      aggregateCache.delete(key)
      throw error
    })

  aggregateCache.set(key, { expiresAt: now + AGGREGATE_CACHE_MS, promise })
  return promise
}

function clearAggregateCache() {
  aggregateCache.clear()
}

function clearSimulationReadCache() {
  readCache.clearPrefix('simulation:')
}

function clearAnalysisCaches() {
  clearAggregateCache()
  clearSimulationReadCache()
  clearBuildingScoreCache()
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Ensures the authenticated user has a profiles row (handles pre-migration
 * users and the OAuth-trigger race condition). Mirrors the handle_new_user
 * trigger by deriving a display name from auth metadata when present.
 */
async function ensureProfile(
  userId: string,
  email: string | undefined,
  metadata?: Record<string, unknown> | null,
): Promise<void> {
  const meta = metadata ?? {}
  const displayName =
    (meta.full_name as string | undefined) ??
    (meta.name as string | undefined) ??
    (email ? email.split('@')[0] : null)

  const { error } = await supabase
    .from('profiles')
    .upsert(
      { id: userId, email: email ?? null, display_name: displayName },
      { onConflict: 'id', ignoreDuplicates: true },
    )

  if (error) throw new Error(`Failed to ensure profile: ${error.message}`)
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * Optional columns that depend on later migrations. If a column is missing
 * (because that migration hasn't run against the connected Supabase project
 * yet), we strip it from the insert payload and retry. This lets the app
 * survive a partially-migrated database — important during the ship-to-
 * stakeholders window where prod might lag the codebase.
 *
 * Each entry maps a payload key → matcher for the error message Postgres
 * returns when that column is missing. Order matters: rarer/newer columns
 * first so we retry minimally.
 */
const OPTIONAL_RUN_COLUMNS: { key: string; matcher: RegExp }[] = [
  { key: 'scenario_severity', matcher: /scenario_severity/i }, // migration 20260516
  { key: 'hazards',           matcher: /hazards/i           }, // migration 20260513
  { key: 'agents_per_room',   matcher: /agents_per_room/i   }, // migration 20260513
  { key: 'seed',              matcher: /\bseed\b/i          }, // migration 20260513
  { key: 'floor_index',       matcher: /floor_index/i       }, // migration 20260512
  { key: 'building_id',       matcher: /building_id/i       }, // migration 20260410
]

async function insertRunWithFallback(
  payload: Record<string, unknown>,
): Promise<{ id: string }> {
  let current = { ...payload }
  // Try up to N+1 times — each retry strips one missing column
  for (let attempt = 0; attempt <= OPTIONAL_RUN_COLUMNS.length; attempt++) {
    const { data, error } = await supabase
      .from('simulation_runs')
      .insert(current as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      .select('id')
      .single()

    if (!error) return data as { id: string }

    // Try to identify which optional column caused the failure
    const missing = OPTIONAL_RUN_COLUMNS.find(c =>
      c.matcher.test(error.message) && c.key in current,
    )
    if (!missing) throw new Error(error.message)

    // Strip the offending column and try again
    const next = { ...current }
    delete next[missing.key]
    current = next
  }
  throw new Error('Failed to insert simulation run after column-fallback retries')
}

export async function createSimulationRun(
  config: SimulationConfig,
  buildingId?: string,
  floorIndex?: number,
  replay?: ReplayInputs,
  scenarioSeverity?: ScenarioSeverity,
): Promise<string> {
  const { data: session, error: authError } = await supabase.auth.getUser()
  if (authError || !session.user) throw new Error('Not authenticated')

  const user = session.user
  await ensureProfile(user.id, user.email, user.user_metadata ?? null)

  const run = await insertRunWithFallback({
    user_id: user.id,
    disaster_type: config.disasterType,
    status: 'running',
    building_id: buildingId ?? null,
    floor_index: floorIndex ?? null,
    hazards: replay?.hazards ?? null,
    agents_per_room: replay?.agentsPerRoom ?? null,
    seed: replay?.seed ?? null,
    scenario_severity: scenarioSeverity ?? null,
  })

  const { error: cfgError } = await supabase
    .from('simulation_configs')
    .insert({
      run_id: run.id,
      agent_count: config.agentCount,
      grid_width: config.gridWidth,
      grid_height: config.gridHeight,
      exit_count: config.exitCount,
      wall_density: config.wallDensity,
      speed_ms: config.speedMs,
    })
  if (cfgError) throw new Error(cfgError.message)

  // Log the action
  await logAction('create', 'run', run.id, { buildingId, disasterType: config.disasterType })
  clearSimulationReadCache()

  return run.id
}

export async function saveSimulationResults(
  runId: string,
  results: {
    totalSteps: number
    evacuatedCount: number
    maxCongestion: number
    evacuationTime: number
    congestionExposure: number
    globalPeakDensity: number
    status: string
  },
  zones: Omit<SimulationZone, 'id' | 'runId'>[],
  bottlenecks: Omit<SimulationBottleneck, 'id' | 'runId'>[],
): Promise<void> {
  // Make this operation idempotent:
  // - upsert the single-row simulation_results by run_id
  // - replace child rows (zones, bottlenecks) by deleting existing ones and inserting fresh

  // 1) Upsert results (on conflict run_id -> update)
  const { error: resErr } = await supabase
    .from('simulation_results')
    .upsert(
      {
        run_id: runId,
        total_steps: results.totalSteps,
        evacuated_count: results.evacuatedCount,
        max_congestion: results.maxCongestion,
        evacuation_time: results.evacuationTime,
        congestion_exposure: results.congestionExposure,
        global_peak_density: results.globalPeakDensity,
      },
      { onConflict: 'run_id' },
    )

  if (resErr) throw new Error(resErr.message)

  // 2) Replace zones: delete existing then insert new
  const { error: delZonesErr } = await supabase.from('simulation_zones').delete().eq('run_id', runId)
  if (delZonesErr) throw new Error(delZonesErr.message)

  if (zones.length > 0) {
    const zoneRows = zones.map(z => ({
      run_id: runId,
      zone_name: z.zoneName,
      intensity: z.intensity,
      agent_count: z.agentCount,
      bottleneck_count: z.bottleneckCount,
      risk_level: z.riskLevel,
      lat: z.lat,
      lng: z.lng,
    }))

    const { error: zonesInsertErr } = await supabase.from('simulation_zones').insert(zoneRows)
    if (zonesInsertErr) throw new Error(zonesInsertErr.message)
  }

  // 3) Replace bottlenecks: delete existing then insert new
  const { error: delBnErr } = await supabase.from('simulation_bottlenecks').delete().eq('run_id', runId)
  if (delBnErr) throw new Error(delBnErr.message)

  if (bottlenecks.length > 0) {
    const bnRows = bottlenecks.map(b => ({
      run_id: runId,
      zone_name: b.zoneName,
      severity: b.severity,
      cell_x: b.cellX,
      cell_y: b.cellY,
      description: b.description,
    }))

    const { error: bnInsertErr } = await supabase.from('simulation_bottlenecks').insert(bnRows)
    if (bnInsertErr) throw new Error(bnInsertErr.message)
  }

  // 4) Update the run status and timestamps
  const { error: statusErr } = await supabase
    .from('simulation_runs')
    .update({ status: results.status, updated_at: new Date().toISOString() })
    .eq('id', runId)

  if (statusErr) throw new Error(statusErr.message)

  // Log the action
  await logAction('complete', 'run', runId, {
    status: results.status,
    evacuatedCount: results.evacuatedCount,
    evacuationTime: results.evacuationTime,
  })
  clearAnalysisCaches()
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

function toConfig(row: Row): SimulationRunConfig {
  return {
    id: row.id as string,
    runId: row.run_id as string,
    agentCount: row.agent_count as number,
    gridWidth: row.grid_width as number,
    gridHeight: row.grid_height as number,
    exitCount: row.exit_count as number,
    wallDensity: row.wall_density as number,
    speedMs: row.speed_ms as number,
  }
}

function toResults(row: Row): SimulationRunResults {
  return {
    id: row.id as string,
    runId: row.run_id as string,
    totalSteps: row.total_steps as number,
    evacuatedCount: row.evacuated_count as number,
    maxCongestion: row.max_congestion as number,
    evacuationTime: row.evacuation_time as number,
    congestionExposure: row.congestion_exposure as number,
    globalPeakDensity: row.global_peak_density as number,
  }
}

function toZone(row: Row): SimulationZone {
  return {
    id: row.id as string,
    runId: row.run_id as string,
    zoneName: row.zone_name as string,
    intensity: row.intensity as number,
    agentCount: row.agent_count as number,
    bottleneckCount: row.bottleneck_count as number,
    riskLevel: (row.risk_level as RiskLevel) ?? 'LOW',
    lat: (row.lat as number) ?? null,
    lng: (row.lng as number) ?? null,
  }
}

function toBottleneck(row: Row): SimulationBottleneck {
  return {
    id: row.id as string,
    runId: row.run_id as string,
    zoneName: row.zone_name as string,
    severity: (row.severity as SeverityLevel) ?? 'LOW',
    cellX: (row.cell_x as number) ?? null,
    cellY: (row.cell_y as number) ?? null,
    description: (row.description as string) ?? null,
  }
}

function toSimulationRun(
  row: Row,
  config: Row | null,
  result: Row | null,
  zones: Row[],
  bottlenecks: Row[],
): SimulationRun {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    disasterType: (row.disaster_type as SimulationRun['disasterType']) ?? 'fire',
    status: (row.status as SimulationStatus) ?? 'pending',
    buildingId: (row.building_id as string) ?? null,
    floorIndex: (row.floor_index as number | null) ?? null,
    hazards: (row.hazards as PlacedHazard[] | null) ?? null,
    agentsPerRoom: (row.agents_per_room as Record<string, number> | null) ?? null,
    seed: (row.seed as number | null) ?? null,
    notes: (row.notes as string) ?? null,
    createdAt: (row.created_at as string) ?? '',
    updatedAt: (row.updated_at as string) ?? '',
    config: config ? toConfig(config) : null,
    results: result ? toResults(result) : null,
    zones: zones.map(toZone),
    bottlenecks: bottlenecks.map(toBottleneck),
  }
}

async function fetchFullRun(runRow: Row): Promise<SimulationRun> {
  const runId = runRow.id as string

  const [cfgRes, resRes, zoneRes, bnRes] = await Promise.all([
    supabase.from('simulation_configs').select('*').eq('run_id', runId).maybeSingle(),
    supabase.from('simulation_results').select('*').eq('run_id', runId).maybeSingle(),
    supabase.from('simulation_zones').select('*').eq('run_id', runId),
    supabase.from('simulation_bottlenecks').select('*').eq('run_id', runId),
  ])

  return toSimulationRun(
    runRow,
    cfgRes.data as Row | null,
    resRes.data as Row | null,
    (zoneRes.data ?? []) as Row[],
    (bnRes.data ?? []) as Row[],
  )
}

async function fetchFullRuns(runRows: Row[]): Promise<SimulationRun[]> {
  if (runRows.length === 0) return []

  const runIds = runRows.map(row => row.id as string)

  const [cfgRes, resRes, zoneRes, bnRes] = await Promise.all([
    supabase.from('simulation_configs').select('*').in('run_id', runIds),
    supabase.from('simulation_results').select('*').in('run_id', runIds),
    supabase.from('simulation_zones').select('*').in('run_id', runIds),
    supabase.from('simulation_bottlenecks').select('*').in('run_id', runIds),
  ])

  if (cfgRes.error) throw new Error(cfgRes.error.message)
  if (resRes.error) throw new Error(resRes.error.message)
  if (zoneRes.error) throw new Error(zoneRes.error.message)
  if (bnRes.error) throw new Error(bnRes.error.message)

  const configsByRun = new Map<string, Row>()
  for (const row of (cfgRes.data ?? []) as Row[]) {
    configsByRun.set(row.run_id as string, row)
  }

  const resultsByRun = new Map<string, Row>()
  for (const row of (resRes.data ?? []) as Row[]) {
    resultsByRun.set(row.run_id as string, row)
  }

  const zonesByRun = new Map<string, Row[]>()
  for (const row of (zoneRes.data ?? []) as Row[]) {
    const runId = row.run_id as string
    zonesByRun.set(runId, [...(zonesByRun.get(runId) ?? []), row])
  }

  const bottlenecksByRun = new Map<string, Row[]>()
  for (const row of (bnRes.data ?? []) as Row[]) {
    const runId = row.run_id as string
    bottlenecksByRun.set(runId, [...(bottlenecksByRun.get(runId) ?? []), row])
  }

  return runRows.map(row => {
    const runId = row.id as string
    return toSimulationRun(
      row,
      configsByRun.get(runId) ?? null,
      resultsByRun.get(runId) ?? null,
      zonesByRun.get(runId) ?? [],
      bottlenecksByRun.get(runId) ?? [],
    )
  })
}

export async function getSimulationRun(runId: string): Promise<SimulationRun> {
  const userKey = await getCurrentUserCacheKey('simulation')
  return readCache.get(`${userKey}:run:${runId}`, async () => {
    const { data, error } = await supabase
      .from('simulation_runs')
      .select('*')
      .eq('id', runId)
      .single()

    if (error) throw new Error(error.message)
    return fetchFullRun(data)
  })
}

export async function getLatestSimulationRun(): Promise<SimulationRun | null> {
  const userKey = await getCurrentUserCacheKey('simulation')
  return readCache.get(`${userKey}:latest`, async () => {
    const { data, error } = await supabase
      .from('simulation_runs')
      .select('*')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) return null
    return fetchFullRun(data)
  })
}

export async function getSimulationHistory(limit: number = 5): Promise<SimulationRun[]> {
  const userKey = await getCurrentUserCacheKey('simulation')
  return readCache.get(`${userKey}:history:${limit}`, async () => {
    const { data, error } = await supabase
      .from('simulation_runs')
      .select('*')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw new Error(error.message)
    if (!data || data.length === 0) return []

    return fetchFullRuns(data)
  })
}

export async function deleteSimulationRun(runId: string): Promise<void> {
  // Generated Supabase types may lag migrations, so keep this RPC call loose.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc('delete_simulation_run_rate_limited', {
    p_run_id: runId,
  })

  if (error) throw new Error(error.message)

  // Log the action
  await logAction('delete', 'run', runId)
  clearAnalysisCaches()
}

export async function resetAllSimulationData(): Promise<void> {
  const { data: session, error: authError } = await supabase.auth.getUser()
  if (authError || !session.user) throw new Error('Not authenticated')

  // Generated Supabase types may lag migrations, so keep this RPC call loose.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc('reset_simulation_data_rate_limited')

  if (error) throw new Error(error.message)

  // Log the action
  await logAction('reset', 'run', 'all')
  clearAnalysisCaches()
}

export interface AggregateFloorHeatmap {
  buildingId: string
  floorIndex: number
  runCount: number
  /** Aggregated grid cells — peakDensity is the average peak across the runs
   *  that contributed (so a few outlier runs don't dominate the picture). */
  cells: { cellX: number; cellY: number; peakDensity: number }[]
}

/**
 * Aggregates density cells across every completed run, grouped by
 * `(buildingId, floorIndex)`. For each cell we keep the average peak density
 * across the runs that touched that cell — effectively "this is where crowds
 * tend to build up on this floor."
 */
export async function getAggregateFloorHeatmaps(): Promise<AggregateFloorHeatmap[]> {
  return getCachedAggregate('aggregate-floor-heatmaps', async () => {
  const { data: runs, error: runsError } = await supabase
    .from('simulation_runs')
    .select('id, building_id, floor_index')
    .eq('status', 'completed')

  if (runsError) throw new Error(runsError.message)
  if (!runs || runs.length === 0) return []

  const runsWithFloor = (runs as { id: string; building_id: string | null; floor_index: number | null }[])
    .filter((r) => r.building_id != null && r.floor_index != null)

  if (runsWithFloor.length === 0) return []

  const runIds = runsWithFloor.map((r) => r.id)
  const runMeta = new Map(runsWithFloor.map((r) => [r.id, { buildingId: r.building_id as string, floorIndex: r.floor_index as number }]))

  // Pull density cells for all completed runs in a single round-trip.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cellRows, error: cellsError } = await (supabase as any)
    .from('density_cells')
    .select('run_id, cell_x, cell_y, peak_density')
    .in('run_id', runIds)

  if (cellsError) throw new Error(cellsError.message)
  if (!cellRows || cellRows.length === 0) return []

  // Group by (buildingId, floorIndex) → cell key → { sum, count, runs }.
  const groups = new Map<string, {
    buildingId: string
    floorIndex: number
    runIds: Set<string>
    cellSums: Map<string, { cellX: number; cellY: number; sum: number; count: number }>
  }>()

  for (const row of cellRows as { run_id: string; cell_x: number; cell_y: number; peak_density: number }[]) {
    const meta = runMeta.get(row.run_id)
    if (!meta) continue
    const groupKey = `${meta.buildingId}:${meta.floorIndex}`
    let group = groups.get(groupKey)
    if (!group) {
      group = {
        buildingId: meta.buildingId,
        floorIndex: meta.floorIndex,
        runIds: new Set(),
        cellSums: new Map(),
      }
      groups.set(groupKey, group)
    }
    group.runIds.add(row.run_id)
    const cellKey = `${row.cell_x}:${row.cell_y}`
    const cell = group.cellSums.get(cellKey)
    if (cell) {
      cell.sum += row.peak_density
      cell.count++
    } else {
      group.cellSums.set(cellKey, { cellX: row.cell_x, cellY: row.cell_y, sum: row.peak_density, count: 1 })
    }
  }

  return Array.from(groups.values()).map((group) => ({
    buildingId: group.buildingId,
    floorIndex: group.floorIndex,
    runCount: group.runIds.size,
    cells: Array.from(group.cellSums.values()).map((c) => ({
      cellX: c.cellX,
      cellY: c.cellY,
      peakDensity: c.sum / c.count,
    })),
  }))
  })
}

export async function getAggregateSimulationStats(): Promise<{
  totalRuns: number
  avgEvacuationRate: number
  totalAgentsSimulated: number
  avgBottlenecksPerRun: number
  avgEvacuationTime: number
}> {
  return getCachedAggregate('aggregate-simulation-stats', async () => {
  const { data: runs, error: runsError } = await supabase
    .from('simulation_runs')
    .select('id')
    .eq('status', 'completed')

  if (runsError) throw new Error(runsError.message)
  if (!runs || runs.length === 0) {
    return { totalRuns: 0, avgEvacuationRate: 0, totalAgentsSimulated: 0, avgBottlenecksPerRun: 0, avgEvacuationTime: 0 }
  }

  const runIds = runs.map(r => r.id as string)

  const [configRes, resultRes, zoneRes] = await Promise.all([
    supabase.from('simulation_configs').select('run_id, agent_count').in('run_id', runIds),
    supabase.from('simulation_results').select('run_id, evacuated_count, evacuation_time').in('run_id', runIds),
    supabase.from('simulation_zones').select('run_id, bottleneck_count').in('run_id', runIds),
  ])

  if (configRes.error) throw new Error(configRes.error.message)
  if (resultRes.error) throw new Error(resultRes.error.message)
  if (zoneRes.error) throw new Error(zoneRes.error.message)

  const configs = (configRes.data ?? []) as { run_id: string; agent_count: number }[]
  const results = (resultRes.data ?? []) as { run_id: string; evacuated_count: number; evacuation_time: number }[]
  const zones = (zoneRes.data ?? []) as { run_id: string; bottleneck_count: number }[]

  const totalAgentsSimulated = configs.reduce((sum, c) => sum + c.agent_count, 0)

  const evacuationRates = results.map(r => {
    const cfg = configs.find(c => c.run_id === r.run_id)
    const agentCount = cfg?.agent_count ?? 1
    return (r.evacuated_count / agentCount) * 100
  })
  const avgEvacuationRate = evacuationRates.length > 0
    ? evacuationRates.reduce((s, v) => s + v, 0) / evacuationRates.length
    : 0

  const totalBottlenecks = zones.reduce((sum, z) => sum + z.bottleneck_count, 0)
  const avgBottlenecksPerRun = runs.length > 0 ? totalBottlenecks / runs.length : 0

  const totalEvacTime = results.reduce((sum, r) => sum + r.evacuation_time, 0)
  const avgEvacuationTime = results.length > 0 ? totalEvacTime / results.length : 0

  return {
    totalRuns: runs.length,
    avgEvacuationRate,
    totalAgentsSimulated,
    avgBottlenecksPerRun,
    avgEvacuationTime,
  }
  })
}

export async function getAggregateZoneStats(): Promise<{
  zoneName: string
  avgIntensity: number
  avgAgentCount: number
  totalBottlenecks: number
  dominantRiskLevel: RiskLevel
}[]> {
  return getCachedAggregate('aggregate-zone-stats', async () => {
  const { data: runs, error: runsError } = await supabase
    .from('simulation_runs')
    .select('id')
    .eq('status', 'completed')

  if (runsError) throw new Error(runsError.message)
  if (!runs || runs.length === 0) return []

  const runIds = runs.map(r => r.id as string)

  const { data: zones, error: zonesError } = await supabase
    .from('simulation_zones')
    .select('zone_name, intensity, agent_count, bottleneck_count, risk_level')
    .in('run_id', runIds)

  if (zonesError) throw new Error(zonesError.message)
  if (!zones || zones.length === 0) return []

  const zoneMap = new Map<string, { intensities: number[]; agentCounts: number[]; bottlenecks: number; riskCounts: Record<string, number> }>()

  for (const z of zones as { zone_name: string; intensity: number; agent_count: number; bottleneck_count: number; risk_level: string }[]) {
    if (!zoneMap.has(z.zone_name)) {
      zoneMap.set(z.zone_name, { intensities: [], agentCounts: [], bottlenecks: 0, riskCounts: {} })
    }
    const entry = zoneMap.get(z.zone_name)!
    entry.intensities.push(z.intensity)
    entry.agentCounts.push(z.agent_count)
    entry.bottlenecks += z.bottleneck_count
    entry.riskCounts[z.risk_level] = (entry.riskCounts[z.risk_level] ?? 0) + 1
  }

  return Array.from(zoneMap.entries()).map(([zoneName, data]) => {
    const avgIntensity = data.intensities.reduce((s, v) => s + v, 0) / data.intensities.length
    const avgAgentCount = data.agentCounts.reduce((s, v) => s + v, 0) / data.agentCounts.length
    const dominantRiskLevel = (Object.entries(data.riskCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'LOW') as RiskLevel
    return { zoneName, avgIntensity, avgAgentCount: Math.round(avgAgentCount), totalBottlenecks: data.bottlenecks, dominantRiskLevel }
  }).sort((a, b) => b.avgIntensity - a.avgIntensity)
  })
}

/** One run's headline metrics, used to plot a per-floor drill trend. */
export interface RunTrendPoint {
  runId: string
  createdAt: string
  disasterType: string
  /** Seconds to clear the floor. */
  evacuationTime: number
  evacuatedCount: number
  agentCount: number
  maxCongestion: number
}

/** Chronological run history for one building floor. */
export interface BuildingFloorTrend {
  buildingId: string
  floorIndex: number
  /** Oldest-first. */
  runs: RunTrendPoint[]
}

/**
 * Groups every completed run by `(buildingId, floorIndex)` and returns each
 * group's runs in chronological order with their headline metrics. Feeds the
 * drill-trend view: direction arrows need run-over-run history, and the
 * "needs a baseline" gate needs the per-floor run count.
 */
export async function getRunTrends(): Promise<BuildingFloorTrend[]> {
  return getCachedAggregate('run-trends', async () => {
    const { data: runs, error: runsError } = await supabase
      .from('simulation_runs')
      .select('id, building_id, floor_index, disaster_type, created_at')
      .eq('status', 'completed')
      .order('created_at', { ascending: true })

    if (runsError) throw new Error(runsError.message)
    if (!runs || runs.length === 0) return []

    const runsWithFloor = (runs as {
      id: string; building_id: string | null; floor_index: number | null
      disaster_type: string | null; created_at: string
    }[]).filter((r) => r.building_id != null && r.floor_index != null)

    if (runsWithFloor.length === 0) return []

    const runIds = runsWithFloor.map((r) => r.id)
    const [cfgRes, resRes] = await Promise.all([
      supabase.from('simulation_configs').select('run_id, agent_count').in('run_id', runIds),
      supabase.from('simulation_results').select('run_id, evacuation_time, evacuated_count, max_congestion').in('run_id', runIds),
    ])
    if (cfgRes.error) throw new Error(cfgRes.error.message)
    if (resRes.error) throw new Error(resRes.error.message)

    const cfgByRun = new Map(
      (cfgRes.data as { run_id: string; agent_count: number }[] ?? []).map((c) => [c.run_id, c]),
    )
    const resByRun = new Map(
      (resRes.data as { run_id: string; evacuation_time: number; evacuated_count: number; max_congestion: number }[] ?? [])
        .map((r) => [r.run_id, r]),
    )

    const groups = new Map<string, BuildingFloorTrend>()
    for (const run of runsWithFloor) {
      const res = resByRun.get(run.id)
      if (!res) continue // skip runs that never recorded results
      const cfg = cfgByRun.get(run.id)
      const key = `${run.building_id}:${run.floor_index}`
      let group = groups.get(key)
      if (!group) {
        group = { buildingId: run.building_id as string, floorIndex: run.floor_index as number, runs: [] }
        groups.set(key, group)
      }
      group.runs.push({
        runId: run.id,
        createdAt: run.created_at,
        disasterType: run.disaster_type ?? 'fire',
        evacuationTime: res.evacuation_time ?? 0,
        evacuatedCount: res.evacuated_count ?? 0,
        agentCount: cfg?.agent_count ?? 0,
        maxCongestion: res.max_congestion ?? 0,
      })
    }
    return Array.from(groups.values())
  })
}

// ---------------------------------------------------------------------------
// Run Tags
// ---------------------------------------------------------------------------

export async function addRunTag(runId: string, tag: string): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('run_tags')
      .insert({ run_id: runId, tag })

    if (error) {
      // Ignore unique constraint violations (tag already exists on this run)
      if (!error.message.includes('duplicate')) throw new Error(error.message)
    }
  } catch (err) {
    console.error(`Failed to add tag: ${err}`)
  }
}

export async function removeRunTag(runId: string, tag: string): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('run_tags')
      .delete()
      .eq('run_id', runId)
      .eq('tag', tag)

    if (error) throw new Error(error.message)
  } catch (err) {
    console.error(`Failed to remove tag: ${err}`)
  }
}

export async function getRunTags(runId: string): Promise<string[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('run_tags')
      .select('tag')
      .eq('run_id', runId)
      .order('tag', { ascending: true })

    if (error) throw new Error(error.message)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((data as any[]) ?? []).map((row: any) => row.tag as string)
  } catch (err) {
    console.error(`Failed to get tags: ${err}`)
    return []
  }
}

export async function getRunsByTag(tag: string): Promise<SimulationRun[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: tagRows, error: tagError } = await (supabase as any)
      .from('run_tags')
      .select('run_id')
      .eq('tag', tag)

    if (tagError) throw new Error(tagError.message)
    if (!tagRows || tagRows.length === 0) return []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const runIds = ((tagRows as any[]) ?? []).map((row: any) => row.run_id as string)

    const { data: runs, error: runsError } = await supabase
      .from('simulation_runs')
      .select('*')
      .in('id', runIds)

    if (runsError) throw new Error(runsError.message)
    if (!runs) return []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await Promise.all(runs.map((row: any) => fetchFullRun(row)))
  } catch (err) {
    console.error(`Failed to get runs by tag: ${err}`)
    return []
  }
}

// ---------------------------------------------------------------------------
// Run Notes
// ---------------------------------------------------------------------------

export async function updateRunNotes(runId: string, notes: string): Promise<void> {
  const { error } = await supabase
    .from('simulation_runs')
    .update({ notes, updated_at: new Date().toISOString() })
    .eq('id', runId)

  if (error) throw new Error(error.message)

  await logAction('update', 'run', runId, { notes })
  clearSimulationReadCache()
}

// ---------------------------------------------------------------------------
// Density Cells (fine-grained spatial data from simulation)
// ---------------------------------------------------------------------------

export async function saveDensityCells(runId: string, cells: Omit<DensityCell, 'id' | 'runId'>[]): Promise<void> {
  try {
    if (cells.length > MAX_DENSITY_CELLS_PER_RUN) {
      console.error(`Rejected density cells for run ${runId}: ${cells.length} exceeds max ${MAX_DENSITY_CELLS_PER_RUN}`)
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: existingCount, error: countError } = await (supabase as any)
      .from('density_cells')
      .select('id', { count: 'exact', head: true })
      .eq('run_id', runId)

    if (countError) throw new Error(`Failed to check existing density cells: ${countError.message}`)
    if ((existingCount ?? 0) > 0) {
      console.warn(`Rejected duplicate density cells save for run ${runId}`)
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteError } = await (supabase as any).from('density_cells').delete().eq('run_id', runId)
    if (deleteError) throw new Error(`Failed to clear density cells: ${deleteError.message}`)

    if (cells.length === 0) {
      clearAggregateCache()
      clearSimulationReadCache()
      return
    }

    const cellRows = cells.map(c => ({
      run_id: runId,
      cell_x: c.cellX,
      cell_y: c.cellY,
      peak_density: c.peakDensity,
      step: c.step,
    }))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('density_cells').insert(cellRows)

    if (error) throw new Error(`Failed to save density cells: ${error.message}`)
    clearAggregateCache()
    clearSimulationReadCache()
  } catch (err) {
    console.error(`Failed to save density cells: ${err}`)
  }
}

export async function getDensityCells(runId: string): Promise<DensityCell[]> {
  const userKey = await getCurrentUserCacheKey('simulation')
  try {
    return await readCache.get(`${userKey}:density:${runId}`, async () => {
      const { data, error } = await supabase
        .from('density_cells')
        .select('*')
        .eq('run_id', runId)
        .order('step', { ascending: true })

      if (error) throw new Error(`Failed to fetch density cells: ${error.message}`)
      if (!data) return []

      return (data as Row[]).map(row => ({
        id: row.id as string,
        runId: row.run_id as string,
        cellX: row.cell_x as number,
        cellY: row.cell_y as number,
        peakDensity: row.peak_density as number,
        step: row.step as number,
      }))
    })
  } catch (err) {
    console.error(`Failed to get density cells: ${err}`)
    return []
  }
}

