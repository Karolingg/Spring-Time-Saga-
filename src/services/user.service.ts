'use client'

import { supabase } from '../config/supabase'

export async function updateUserEmail(newEmail: string) {
  const { error } = await supabase.auth.updateUser({ email: newEmail })
  if (error) {
    throw new Error(error.message)
  }
}

export async function updateUserPassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) {
    throw new Error(error.message)
  }
}
