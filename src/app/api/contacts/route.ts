// ============================================
// GET /api/contacts
// Lista contactos con filtros y paginación
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import type { ContactsListResponse, ApiError } from '@/types'

export async function GET(
  req: NextRequest
): Promise<NextResponse<ContactsListResponse | ApiError>> {
  // --- Auth ---
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey || apiKey !== process.env.SEARCH_API_KEY) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'API key inválida o ausente' },
      { status: 401 }
    )
  }

  const { searchParams } = new URL(req.url)

  // Parámetros de consulta
  const search_id = searchParams.get('search_id') // Filtrar por búsqueda
  const status = searchParams.get('status') // new | contacted | converted | skipped | bounced
  const is_valid = searchParams.get('is_valid') // true | false
  const exclude_duplicates = searchParams.get('exclude_duplicates') !== 'false' // default true
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const page_size = Math.min(100, Math.max(1, parseInt(searchParams.get('page_size') ?? '50')))
  const search_text = searchParams.get('q') // Búsqueda por nombre o empresa

  const supabase = createServerClient()

  // Construir query base
  let query = supabase
    .from('contacts')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  // Aplicar filtros
  if (search_id) query = query.eq('search_id', search_id)
  if (status) query = query.eq('status', status)
  if (is_valid !== null) query = query.eq('is_valid', is_valid === 'true')
  if (exclude_duplicates) query = query.eq('is_duplicate', false)
  if (search_text) {
    query = query.or(`name.ilike.%${search_text}%,company.ilike.%${search_text}%`)
  }

  // Paginación
  const from = (page - 1) * page_size
  const to = from + page_size - 1
  query = query.range(from, to)

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json(
      { error: 'Database Error', message: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    contacts: data ?? [],
    total: count ?? 0,
    page,
    page_size,
  })
}

// ============================================
// PATCH /api/contacts?id=uuid
// Actualiza el status de un contacto
// ============================================

export async function PATCH(
  req: NextRequest
): Promise<NextResponse<{ success: boolean } | ApiError>> {
  // --- Auth ---
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey || apiKey !== process.env.SEARCH_API_KEY) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'API key inválida o ausente' },
      { status: 401 }
    )
  }

  const { searchParams } = new URL(req.url)
  const contactId = searchParams.get('id')

  if (!contactId) {
    return NextResponse.json(
      { error: 'Bad Request', message: 'Parámetro requerido: id' },
      { status: 400 }
    )
  }

  let body: { status?: string; contact_notes?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: 'Bad Request', message: 'Body JSON inválido' },
      { status: 400 }
    )
  }

  const validStatuses = ['new', 'contacted', 'converted', 'skipped', 'bounced']
  if (body.status && !validStatuses.includes(body.status)) {
    return NextResponse.json(
      {
        error: 'Bad Request',
        message: `Status inválido. Opciones: ${validStatuses.join(', ')}`,
      },
      { status: 400 }
    )
  }

  const supabase = createServerClient()
  const updateData: Record<string, unknown> = {}
  if (body.status) {
    updateData.status = body.status
    if (body.status === 'contacted') updateData.contacted_at = new Date().toISOString()
    if (body.status === 'converted') updateData.converted_at = new Date().toISOString()
  }
  if (body.contact_notes !== undefined) updateData.contact_notes = body.contact_notes

  const { error } = await supabase
    .from('contacts')
    .update(updateData)
    .eq('id', contactId)

  if (error) {
    return NextResponse.json(
      { error: 'Database Error', message: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
