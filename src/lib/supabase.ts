// ============================================
// LinkedIn Scraper V1 - Supabase Client
// ============================================

import { createClient } from '@supabase/supabase-js'

// Cliente para operaciones del servidor (service role - bypasa RLS)
// Solo usar en API routes / server-side
export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY'
    )
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

// Cliente para el navegador (anon key - respeta RLS)
// Solo usar en componentes client-side
let browserClient: ReturnType<typeof createClient> | null = null

export function createBrowserClient() {
  if (browserClient) return browserClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error(
      'Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY'
    )
  }

  browserClient = createClient(url, key)
  return browserClient
}
