import { supabase } from '@/src/config/supabase'

export async function loginWithEmail(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
}

export async function signUpWithEmail(email: string, password: string) {
  const { error } = await supabase.auth.signUp({ email, password })
  if (error) throw new Error(error.message)
}

export async function logout() {
  const { error } = await supabase.auth.signOut()
  if (error) throw new Error(error.message)
}

export async function getCurrentSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

export async function getCurrentUser() {
  const { data } = await supabase.auth.getUser()
  return data.user
}

export function onAuthStateChange(callback: (event: string, session: unknown) => void) {
  return supabase.auth.onAuthStateChange(callback)
}
