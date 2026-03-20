// ============================================
// GET /api/status?search_id=uuid
// Estado en tiempo real de una búsqueda
// Polling: el frontend llama cada 5s mientras status=running
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import type { StatusResponse, ApiError } from '@/types'

export async function GET(
  req: NextRequest
): Promise<NextResponse<StatusResponse | ApiError>> {
  const { searchParams } = new URL(req.url)
  const searchId = searchParams.get('search_id')

  if (!searchId) {
    return NextResponse.json(
      { error: 'Bad Request', message: 'Parámetro requerido: search_id' },
      { status: 400 }
    )
  }

  const supabase = createServerClient()

  // Obtener búsqueda
  const { data: search, error: searchError } = await supabase
    .from('searches')
    .select('*')
    .eq('id', searchId)
    .single()

  if (searchError || !search) {
    return NextResponse.json(
      {
        error: 'Not Found',
        message: `Búsqueda con ID "${searchId}" no encontrada`,
      },
      { status: 404 }
    )
  }

  // Contar contactos asociados (no duplicados, válidos)
  const { count: contactsCount } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .eq('search_id', searchId)
    .eq('is_duplicate', false)
    .eq('is_valid', true)

  return NextResponse.json({
    search,
    contacts_count: contactsCount ?? 0,
  })
}
