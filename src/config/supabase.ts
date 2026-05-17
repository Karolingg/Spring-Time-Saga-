'use client'

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/src/schema/database.types'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.error(
    '[EVACSIM] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.\n' +
    'Copy .env.example to .env.local and fill in your Supabase credentials.\n' +
    'See: https://supabase.com/dashboard → Project Settings → API',
  )
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY)
