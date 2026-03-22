// ============================================
// POST /api/search
// Dispara una búsqueda de LinkedIn (Streaming / SSE)
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
// Asumimos que refactorizaremos executeLinkedInSearch para aceptar un callback (onProgress)
import { executeLinkedInSearch } from '@/lib/linkedin_scraper'
import { generateGoogleQuery } from '@/lib/claude_prompts'
import type { SearchFilters, ApiError } from '@/types'

interface SearchRequestBody {
  search_name: string
  filters: SearchFilters
  google_query?: string
  max_results?: number
  description?: string
}

// Forzamos que sea dinámica para que Vercel no cachee la respuesta
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // --- Auth ---
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey || apiKey !== process.env.SEARCH_API_KEY) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'API key inválida o ausente' },
      { status: 401 }
    )
  }

  let body: SearchRequestBody;
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: 'Bad Request', message: 'Body JSON inválido' },
      { status: 400 }
    )
  }

  const { search_name, filters, google_query, max_results = 30, description } = body

  if (!search_name || !filters || !filters.jobTitle || !filters.experience || !filters.industry || !filters.location) {
    return NextResponse.json(
      { error: 'Bad Request', message: 'Faltan campos requeridos o filtros inválidos.' },
      { status: 400 }
    )
  }

  const supabase = createServerClient()
  const { data: existing } = await supabase
    .from('searches')
    .select('id')
    .eq('name', search_name)
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { error: 'Conflict', message: `Ya existe una búsqueda con el nombre "${search_name}".` },
      { status: 409 }
    )
  }

  // --- Inicializar el Stream (Server-Sent Events) ---
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Función auxiliar para enviar eventos al frontend
      const sendEvent = (event: string, data: any) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        sendEvent('status', { message: 'Iniciando búsqueda...' });

        // 1. Generar Query
        let finalQuery = google_query;
        if (!finalQuery) {
          sendEvent('status', { message: 'Generando query con IA...' });
          finalQuery = await generateGoogleQuery(filters);
        }

        // 2. Crear registro en BD
        sendEvent('status', { message: 'Creando registro en base de datos...' });
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

        if (createError || !searchRecord) throw new Error(`Error BD: ${createError?.message}`);

        const searchId: string = searchRecord.id;
        sendEvent('search_created', { search_id: searchId, query: finalQuery });

        // 3. Ejecutar búsqueda y AWAIT (AQUÍ ESTÁ LA MAGIA DEL STREAMING)
        // Pasamos un callback para que el scraper nos avise cada vez que saca un lead válido
        sendEvent('status', { message: 'Scrapeando y validando leads...' });

        const result = await executeLinkedInSearch(search_name, finalQuery, filters, max_results, searchId, (newLead) => {
          // Cada vez que el scraper extrae un lead, lo mandamos al frontend
          sendEvent('lead_found', newLead);
        });

        // 4. Finalizar
        sendEvent('done', { 
          message: 'Búsqueda completada con éxito.',
          search_id: searchId,
          total_created: result.total_created,
          total_processed: result.total_processed
        });
        controller.close();

      } catch (err: any) {
        console.error(`❌ [API] Error en el stream:`, err);
        sendEvent('error', { message: err.message || 'Error desconocido' });
        controller.close();
      }
    }
  });

  // Devolver la respuesta configurada para SSE
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}