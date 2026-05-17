import { supabase } from '@/src/config/supabase'
import type { AuditLog } from '@/src/schema/building.types'

type Row = Record<string, unknown>

function toAuditLog(row: Row): AuditLog {
  return {
    id: row.id as string,
    userId: (row.user_id as string) ?? null,
    action: row.action as string,
    resourceType: row.resource_type as 'run' | 'profile' | 'building' | 'drill',
    resourceId: row.resource_id as string,
    changesJson: (row.changes_json as Record<string, unknown>) ?? null,
    ipAddress: (row.ip_address as string) ?? null,
    createdAt: (row.created_at as string) ?? '',
  }
}

export async function logAction(
  action: string,
  resourceType: 'run' | 'profile' | 'building' | 'drill',
  resourceId: string,
  changesJson?: Record<string, unknown> | null,
  ipAddress?: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { data: session, error: authError } = await supabase.auth.getUser()
  const userId = session?.user?.id ?? null

  try {
    // Use RPC call to bypass type generation lag after migration
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('audit_logs').insert({
      user_id: userId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      changes_json: changesJson ?? null,
      ip_address: ipAddress ?? null,
    })

    if (error) {
      console.error(`Failed to log audit action: ${error.message}`)
    }
  } catch (err) {
    console.error(`Audit logging error: ${err}`)
    // Don't throw — audit logging should not break main flow
  }
}

export async function getAuditLog(
  resourceType?: 'run' | 'profile' | 'building' | 'drill',
  resourceId?: string,
  limit: number = 100,
): Promise<AuditLog[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any).from('audit_logs').select('*')

    if (resourceType) {
      query = query.eq('resource_type', resourceType)
    }
    if (resourceId) {
      query = query.eq('resource_id', resourceId)
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw new Error(`Failed to fetch audit logs: ${error.message}`)
    if (!data) return []

    return (data as Row[]).map(toAuditLog)
  } catch (err) {
    console.error(`Audit log fetch error: ${err}`)
    return []
  }
}

export async function getUserAuditLog(userId: string, limit: number = 50): Promise<AuditLog[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('audit_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw new Error(`Failed to fetch user audit logs: ${error.message}`)
    if (!data) return []

    return (data as Row[]).map(toAuditLog)
  } catch (err) {
    console.error(`User audit log fetch error: ${err}`)
    return []
  }
}
