import { supabase } from '@/src/config/supabase'

export async function updateUserEmail(newEmail: string) {
  const { error } = await supabase.auth.updateUser({ email: newEmail })
  if (error) throw new Error(error.message)
}

export async function updateUserPassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw new Error(error.message)
}

export async function getUserProfile() {
  const { data: session, error: authError } = await supabase.auth.getUser()
  if (authError || !session.user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function updateUserProfile(displayName: string) {
  const { data: session, error: authError } = await supabase.auth.getUser()
  if (authError || !session.user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('profiles')
    .update({ display_name: displayName, updated_at: new Date().toISOString() })
    .eq('id', session.user.id)

  if (error) throw new Error(error.message)
}
