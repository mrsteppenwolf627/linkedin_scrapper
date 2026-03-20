// ============================================
// GET /api/searches
// Lista todas las búsquedas con estadísticas
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import type { SearchesListResponse, ApiError } from '@/types'

export async function GET(
  req: NextRequest
): Promise<NextResponse<SearchesListResponse | ApiError>> {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') // pending | running | completed | failed
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20')))

  const supabase = createServerClient()

  let query = supabase
    .from('searches')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status) query = query.eq('status', status)

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json(
      { error: 'Database Error', message: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    searches: data ?? [],
    total: count ?? 0,
  })
}
