// ============================================
// POST /api/search
// Dispara una búsqueda de LinkedIn
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { executeLinkedInSearch } from '@/lib/linkedin_scraper'
import { generateGoogleQuery } from '@/lib/claude_prompts'
import type { SearchFilters, ApiError, SearchStartedResponse } from '@/types'

interface SearchRequestBody {
  search_name: string
  filters: SearchFilters
  google_query?: string // Opcional: si no se pasa, Claude lo genera
  max_results?: number
  description?: string
}

export async function POST(
  req: NextRequest
): Promise<NextResponse<SearchStartedResponse | ApiError>> {
  // --- Auth ---
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey || apiKey !== process.env.SEARCH_API_KEY) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'API key inválida o ausente' },
      { status: 401 }
    )
  }

  // --- Parse body ---
  let body: SearchRequestBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: 'Bad Request', message: 'Body JSON inválido' },
      { status: 400 }
    )
  }

  const { search_name, filters, google_query, max_results = 30, description } = body

  // --- Validación ---
  if (!search_name || !filters) {
    return NextResponse.json(
      {
        error: 'Bad Request',
        message: 'Campos requeridos: search_name, filters',
      },
      { status: 400 }
    )
  }

  if (!filters.sector || filters.years_min === undefined || !Array.isArray(filters.keywords)) {
    return NextResponse.json(
      {
        error: 'Bad Request',
        message: 'filters requeridos: sector (string), years_min (number), keywords (array)',
      },
      { status: 400 }
    )
  }

  // --- Verificar que el nombre de búsqueda no existe ya ---
  const supabase = createServerClient()
  const { data: existing } = await supabase
    .from('searches')
    .select('id')
    .eq('name', search_name)
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json(
      {
        error: 'Conflict',
        message: `Ya existe una búsqueda con el nombre "${search_name}". Usa un nombre único.`,
      },
      { status: 409 }
    )
  }

  // --- Generar query Google si no se proporciona ---
  let finalQuery: string
  if (google_query) {
    finalQuery = google_query
  } else {
    try {
      finalQuery = await generateGoogleQuery(filters)
      console.log(`[API /search] Query generada por Claude: ${finalQuery}`)
    } catch (err) {
      return NextResponse.json(
        {
          error: 'Query Generation Failed',
          message: `Error generando query: ${String(err)}`,
        },
        { status: 500 }
      )
    }
  }

  // --- Crear registro inicial en BD con status=running ---
  const { data: searchRecord, error: createError } = await supabase
    .from('searches')
    .insert({
      name: search_name,
      description: description ?? null,
      filters,
      google_query: finalQuery,
      status: 'running',
    })
    .select('id')
    .single()

  if (createError || !searchRecord) {
    return NextResponse.json(
      {
        error: 'Database Error',
        message: `Error creando registro: ${createError?.message}`,
      },
      { status: 500 }
    )
  }

  const searchId: string = searchRecord.id

  // --- Ejecutar búsqueda en background (sin await) ---
  // En producción usar una cola (Bull/BullMQ), aquí fire-and-forget
  executeLinkedInSearch(search_name, finalQuery, filters, max_results)
    .then(() => {
      console.log(`✅ [API] Búsqueda "${search_name}" completada`)
    })
    .catch((err) => {
      console.error(`❌ [API] Búsqueda "${search_name}" falló:`, err)
    })

  // Responder inmediatamente con el search_id
  return NextResponse.json(
    {
      search_id: searchId,
      status: 'running',
      message: `Búsqueda "${search_name}" iniciada. Consulta el estado en GET /api/status?search_id=${searchId}`,
    },
    { status: 202 }
  )
}
