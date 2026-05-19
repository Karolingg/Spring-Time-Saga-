import { supabase } from '@/src/config/supabase'
import { getCurrentUserCacheKey, ReadThroughCache } from '@/src/services/read-cache'

const profileCache = new ReadThroughCache()

function clearProfileCache() {
  profileCache.clear()
}

export async function updateUserEmail(newEmail: string) {
  const { error } = await supabase.auth.updateUser({ email: newEmail })
  if (error) throw new Error(error.message)
  clearProfileCache()
}

export async function updateUserPassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw new Error(error.message)
}

export async function getUserProfile() {
  const userKey = await getCurrentUserCacheKey('profile')
  return profileCache.get(userKey, async () => {
    const { data: session, error: authError } = await supabase.auth.getUser()
    if (authError || !session.user) throw new Error('Not authenticated')

    const user = session.user

    // Use maybeSingle so we don't throw when the profile row doesn't exist yet
    // (happens occasionally on first OAuth login if the trigger hasn't fired).
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (data) return data

    // Self-heal: create the profile row from the auth session metadata.
    // Mirrors the handle_new_user trigger so the result looks identical.
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>
    const displayName =
      (meta.full_name as string | undefined) ??
      (meta.name as string | undefined) ??
      (user.email ? user.email.split('@')[0] : null)

    const { data: created, error: insertError } = await supabase
      .from('profiles')
      .upsert(
        { id: user.id, email: user.email ?? null, display_name: displayName },
        { onConflict: 'id' },
      )
      .select('*')
      .single()

    if (insertError) throw new Error(insertError.message)
    return created
  })
}

export async function updateUserProfile(displayName: string) {
  const { data: session, error: authError } = await supabase.auth.getUser()
  if (authError || !session.user) throw new Error('Not authenticated')

  // The profile update rate limit is enforced by the profiles trigger.
  const { error } = await supabase
    .from('profiles')
    .update({ display_name: displayName, updated_at: new Date().toISOString() })
    .eq('id', session.user.id)

  if (error) throw new Error(error.message)
  clearProfileCache()
}
