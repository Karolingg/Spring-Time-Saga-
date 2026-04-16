import { supabase } from '@/src/config/supabase'
import type { Building } from '@/src/schema/building.types'
import type { RiskLevel } from '@/src/schema/enums'

type Row = Record<string, unknown>

function toBuilding(row: Row): Building {
  return {
    id: row.id as string,
    name: row.name as string,
    type: row.type as string,
    polygon: (row.polygon as unknown[]).map(p => {
      const arr = p as [number, number]
      return [arr[0], arr[1]]
    }) as [number, number][],
    capacity: row.capacity as number,
    floors: row.floors as number,
    exits: row.exits as number,
    riskLevel: (row.risk_level as RiskLevel) ?? 'LOW',
    lastDrillDate: (row.last_drill_date as string) ?? null,
    notes: (row.notes as string) ?? null,
    createdAt: (row.created_at as string) ?? '',
    updatedAt: (row.updated_at as string) ?? '',
  }
}

export async function getBuildings(): Promise<Building[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('buildings')
      .select('*')
      .order('name', { ascending: true })

    if (error) throw new Error(`Failed to fetch buildings: ${error.message}`)
    if (!data) return []

    return (data as Row[]).map(toBuilding)
  } catch (err) {
    console.error(`Failed to fetch buildings: ${err}`)
    return []
  }
}

export async function getBuilding(buildingId: string): Promise<Building> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('buildings')
    .select('*')
    .eq('id', buildingId)
    .single()

  if (error) throw new Error(`Failed to fetch building: ${error.message}`)
  return toBuilding(data as Row)
}

export async function updateBuilding(
  buildingId: string,
  updates: Partial<Omit<Building, 'id' | 'createdAt' | 'updatedAt'>>,
): Promise<Building> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('buildings')
    .update({
      ...(updates.name && { name: updates.name }),
      ...(updates.type && { type: updates.type }),
      ...(updates.polygon && { polygon: updates.polygon }),
      ...(updates.capacity !== undefined && { capacity: updates.capacity }),
      ...(updates.floors !== undefined && { floors: updates.floors }),
      ...(updates.exits !== undefined && { exits: updates.exits }),
      ...(updates.riskLevel && { risk_level: updates.riskLevel }),
      ...(updates.lastDrillDate !== undefined && { last_drill_date: updates.lastDrillDate }),
      ...(updates.notes !== undefined && { notes: updates.notes }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', buildingId)
    .select()
    .single()

  if (error) throw new Error(`Failed to update building: ${error.message}`)
  return toBuilding(data as Row)
}

export async function createBuilding(building: Omit<Building, 'createdAt' | 'updatedAt'>): Promise<Building> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('buildings')
    .insert({
      id: building.id,
      name: building.name,
      type: building.type,
      polygon: building.polygon,
      capacity: building.capacity,
      floors: building.floors,
      exits: building.exits,
      risk_level: building.riskLevel,
      last_drill_date: building.lastDrillDate,
      notes: building.notes,
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to create building: ${error.message}`)
  return toBuilding(data as Row)
}

export async function deleteBuilding(buildingId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('buildings')
    .delete()
    .eq('id', buildingId)

  if (error) throw new Error(`Failed to delete building: ${error.message}`)
}
