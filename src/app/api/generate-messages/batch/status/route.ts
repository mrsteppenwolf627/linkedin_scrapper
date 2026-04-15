// ============================================
// GET /api/generate-messages/batch/status?search_id=uuid
//
// total      = COUNT(*) FROM contacts WHERE search_id = :search_id
// processed  = COUNT(DISTINCT lead_id) FROM message_drafts
//              where the lead belongs to this search_id
// status     = "complete" when processed === total (and total > 0)
//            = "processing" otherwise
// percentage = Math.round((processed / total) * 100), capped at 100
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import type { ApiError } from '@/types'

interface BatchStatusResponse {
  search_id:  string
  status:     'complete' | 'processing'
  processed:  number
  total:      number
  percentage: number
}

export async function GET(req: NextRequest) {
  // --- Auth ---
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey || apiKey !== process.env.SEARCH_API_KEY) {
    return NextResponse.json<ApiError>(
      { error: 'Unauthorized', message: 'API key inválida o ausente' },
      { status: 401 }
    )
  }

  const search_id = new URL(req.url).searchParams.get('search_id')

  if (!search_id) {
    return NextResponse.json<ApiError>(
      { error: 'Bad Request', message: 'Query param requerido: search_id' },
      { status: 400 }
    )
  }

  const supabase = createServerClient()

  // total = number of contacts for this search
  const { count: total, error: contactsErr } = await supabase
    .from('contacts')
    .select('id', { count: 'exact', head: true })
    .eq('search_id', search_id)

  if (contactsErr) {
    console.error('[status] contacts query error:', contactsErr.message)
    return NextResponse.json<ApiError>(
      { error: 'Database Error', message: contactsErr.message },
      { status: 500 }
    )
  }

  // processed = COUNT(DISTINCT lead_id) from message_drafts joined to leads of this search
  const { data: draftLeads, error: draftsErr } = await supabase
    .from('message_drafts')
    .select('lead_id, leads!inner(search_id)')
    .eq('leads.search_id', search_id)

  if (draftsErr) {
    console.error('[status] drafts query error:', draftsErr.message)
    return NextResponse.json<ApiError>(
      { error: 'Database Error', message: draftsErr.message },
      { status: 500 }
    )
  }

  const totalContacts = total ?? 0
  const processed     = new Set(draftLeads?.map(r => r.lead_id) ?? []).size
  const percentage    = totalContacts > 0
    ? Math.min(100, Math.round((processed / totalContacts) * 100))
    : 0
  const status: BatchStatusResponse['status'] =
    totalContacts > 0 && processed >= totalContacts ? 'complete' : 'processing'

  console.log(`[status] processed=${processed}, total=${totalContacts}, status=${status}`)

  return NextResponse.json<BatchStatusResponse>({
    search_id,
    status,
    processed,
    total: totalContacts,
    percentage,
  })
}
