// ============================================
// POST /api/generate-messages/batch
// Genera 3 drafts para cada contacto de una búsqueda.
//
// Body:    { search_id: string }
// Source:  contacts table (name, job_title, company, industry, location,
//          linkedin_url, raw_google_snippet) — sin your_product
// Process: max 5 concurrent → OpenAI → Supabase leads + message_drafts
// Response:{ processed, failed, cost_total_usd, time_ms, items[] }
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { generateLinkedInMessages } from '@/lib/claude_prompts'
import { saveLeadWithDrafts } from '@/lib/message_store'
import type {
  BatchGenerateRequestBody,
  BatchGenerateResult,
  BatchItemResult,
  LeadInput,
  SearchFilters,
  ApiError,
} from '@/types'

const CONCURRENCY = 5

async function runConcurrent<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = []
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const chunk = items.slice(i, i + CONCURRENCY)
    const settled = await Promise.allSettled(chunk.map(fn))
    results.push(...settled)
  }
  return results
}

export async function POST(req: NextRequest) {
  const t0 = Date.now()

  // --- Auth ---
  const receivedKey = req.headers.get('x-api-key')
  const expectedKey = process.env.SEARCH_API_KEY
  console.log('[batch] Received key:', receivedKey)
  console.log('[batch] Expected key:', expectedKey)

  if (!receivedKey || receivedKey !== expectedKey) {
    const reason = !receivedKey
      ? 'Header x-api-key ausente'
      : 'API key no coincide con SEARCH_API_KEY'
    console.warn(`[batch] Auth failed — ${reason}`)
    return NextResponse.json<ApiError>(
      { error: 'Unauthorized', message: reason },
      { status: 401 }
    )
  }

  // --- Parse body ---
  let body: BatchGenerateRequestBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json<ApiError>(
      { error: 'Bad Request', message: 'Body JSON inválido' },
      { status: 400 }
    )
  }

  const { search_id, your_product: rawProduct } = body
  const your_product = rawProduct?.trim() || 'Tu Producto/Servicio'

  if (!search_id) {
    return NextResponse.json<ApiError>(
      { error: 'Bad Request', message: 'Campo requerido: search_id' },
      { status: 400 }
    )
  }

  const supabase = createServerClient()

  // --- 1. Verify search exists and get industry ---
  const { data: search, error: searchErr } = await supabase
    .from('searches')
    .select('id, filters')
    .eq('id', search_id)
    .single()

  if (searchErr || !search) {
    return NextResponse.json<ApiError>(
      { error: 'Not Found', message: `Búsqueda no encontrada: ${search_id}` },
      { status: 404 }
    )
  }

  // filters is JSONB; support both current (industry) and legacy (sector) shapes
  const filters = search.filters as SearchFilters & { sector?: string }
  const industry = filters.industry ?? filters.sector ?? ''

  // --- 2. Fetch ALL contacts for this search ---
  const { data: contacts, error: contactsErr } = await supabase
    .from('contacts')
    .select('id, name, job_title, company, location, linkedin_url, raw_google_snippet')
    .eq('search_id', search_id)
    .order('confidence_score', { ascending: false })

  if (contactsErr) {
    return NextResponse.json<ApiError>(
      { error: 'Database Error', message: contactsErr.message },
      { status: 500 }
    )
  }

  if (!contacts || contacts.length === 0) {
    return NextResponse.json<BatchGenerateResult>({
      search_id,
      total_contacts: 0,
      processed: 0,
      failed: 0,
      cost_total_usd: 0,
      time_ms: Date.now() - t0,
      items: [],
    })
  }

  type RawContact = (typeof contacts)[0]

  // --- 3. Process all contacts (max CONCURRENCY parallel) ---
  const settled = await runConcurrent(contacts, async (contact: RawContact) => {
    const leadInput: LeadInput = {
      name:            contact.name ?? '',
      title:           contact.job_title ?? '',
      company:         contact.company ?? '',
      industry,
      location:        contact.location ?? '',
      linkedin_url:    contact.linkedin_url,
      profile_snippet: contact.raw_google_snippet ?? undefined,
      your_product,
    }

    const { drafts, usage } = await generateLinkedInMessages(leadInput)
    const { lead_id } = await saveLeadWithDrafts(leadInput, drafts, { search_id })

    return { lead_id, usage }
  })

  // --- 4. Map results ---
  const items: BatchItemResult[] = settled.map((result, i) => {
    const contact = contacts[i]
    if (result.status === 'fulfilled') {
      return {
        contact_id:   contact.id,
        contact_name: contact.name ?? '(sin nombre)',
        status:       'ok',
        lead_id:      result.value.lead_id,
        usage:        result.value.usage,
      }
    }
    const errMsg =
      result.reason instanceof Error ? result.reason.message : String(result.reason)
    console.error(`[batch] ❌ ${contact.name} @ ${contact.company}: ${errMsg}`)
    return {
      contact_id:   contact.id,
      contact_name: contact.name ?? '(sin nombre)',
      status:       'failed',
      error:        errMsg,
    }
  })

  // --- 5. Aggregate ---
  const processed      = items.filter(r => r.status === 'ok').length
  const failed         = items.filter(r => r.status === 'failed').length
  const cost_total_usd = items
    .filter(r => r.status === 'ok')
    .reduce((sum, r) => sum + (r.usage?.estimated_cost_usd ?? 0), 0)
  const time_ms = Date.now() - t0

  console.log(
    `[batch] search=${search_id} | processed=${processed} failed=${failed} | ` +
    `cost=$${cost_total_usd.toFixed(6)} time=${time_ms}ms`
  )

  return NextResponse.json<BatchGenerateResult>({
    search_id,
    total_contacts: contacts.length,
    processed,
    failed,
    cost_total_usd,
    time_ms,
    items,
  })
}
