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
import { logAction } from '@/src/services/audit.service'

type Row = Record<string, unknown>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Ensures the authenticated user has a profiles row (handles pre-migration users). */
async function ensureProfile(userId: string, email: string | undefined): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, email: email ?? null }, { onConflict: 'id' })

  if (error) throw new Error(`Failed to ensure profile: ${error.message}`)
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

export async function createSimulationRun(config: SimulationConfig, buildingId?: string): Promise<string> {
  const { data: session, error: authError } = await supabase.auth.getUser()
  if (authError || !session.user) throw new Error('Not authenticated')

  const user = session.user
  await ensureProfile(user.id, user.email)

  const { data: run, error: runError } = await supabase
    .from('simulation_runs')
    .insert({ user_id: user.id, disaster_type: config.disasterType, status: 'running', building_id: buildingId ?? null })
    .select('id')
    .single()
  if (runError) throw new Error(runError.message)

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

export async function getSimulationRun(runId: string): Promise<SimulationRun> {
  const { data, error } = await supabase
    .from('simulation_runs')
    .select('*')
    .eq('id', runId)
    .single()

  if (error) throw new Error(error.message)
  return fetchFullRun(data)
}

export async function getLatestSimulationRun(): Promise<SimulationRun | null> {
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
}

export async function getSimulationHistory(limit: number = 5): Promise<SimulationRun[]> {
  const { data, error } = await supabase
    .from('simulation_runs')
    .select('*')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  if (!data || data.length === 0) return []

  const runs = await Promise.all(data.map(row => fetchFullRun(row)))
  return runs
}

export async function deleteSimulationRun(runId: string): Promise<void> {
  const { error } = await supabase
    .from('simulation_runs')
    .delete()
    .eq('id', runId)

  if (error) throw new Error(error.message)

  // Log the action
  await logAction('delete', 'run', runId)
}

export async function resetAllSimulationData(): Promise<void> {
  const { data: session, error: authError } = await supabase.auth.getUser()
  if (authError || !session.user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('simulation_runs')
    .delete()
    .eq('user_id', session.user.id)

  if (error) throw new Error(error.message)

  // Log the action
  await logAction('reset', 'run', 'all')
}

export async function getAggregateSimulationStats(): Promise<{
  totalRuns: number
  avgEvacuationRate: number
  totalAgentsSimulated: number
  avgBottlenecksPerRun: number
  avgEvacuationTime: number
}> {
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
}

export async function getAggregateZoneStats(): Promise<{
  zoneName: string
  avgIntensity: number
  avgAgentCount: number
  totalBottlenecks: number
  dominantRiskLevel: RiskLevel
}[]> {
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
}

// ---------------------------------------------------------------------------
// Density Cells (fine-grained spatial data from simulation)
// ---------------------------------------------------------------------------

export async function saveDensityCells(runId: string, cells: Omit<DensityCell, 'id' | 'runId'>[]): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteError } = await (supabase as any).from('density_cells').delete().eq('run_id', runId)
    if (deleteError) throw new Error(`Failed to clear density cells: ${deleteError.message}`)

    if (cells.length === 0) return

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
  } catch (err) {
    console.error(`Failed to save density cells: ${err}`)
  }
}

export async function getDensityCells(runId: string): Promise<DensityCell[]> {
  try {
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
  } catch (err) {
    console.error(`Failed to get density cells: ${err}`)
    return []
  }
}

