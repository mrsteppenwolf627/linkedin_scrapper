// ============================================
// GET /api/drafts?search_id=uuid
// Devuelve todos los drafts (flat array) con info del lead y búsqueda.
//
// Query params:
//   search_id  (optional) — uuid de la búsqueda; si se omite, devuelve todos
//
// Response: array plano ordenado por search_id → lead_id → sequence (1, 2, 3)
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import type { ApiError } from '@/types'

interface DraftItem {
  id:                string
  lead_id:           string
  lead_name:         string
  lead_linkedin_url: string
  lead_company:      string | null
  search_name:       string | null
  sequence:          number
  draft_text:        string
  confidence:        number
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

  const { searchParams } = new URL(req.url)
  const search_id = searchParams.get('search_id')

  const supabase = createServerClient()

  // Fetch leads (+ nested drafts + search name), ordered by search_id then lead id
  let query = supabase
    .from('leads')
    .select(
      `id,
       name,
       linkedin_url,
       company,
       search_id,
       searches (name),
       message_drafts (
         id,
         sequence,
         draft_text,
         confidence
       )`
    )
    .order('search_id', { ascending: true })
    .order('id', { ascending: true })

  if (search_id) {
    query = query.eq('search_id', search_id)
  }

  const { data, error } = await query

  if (error) {
    console.error('[/api/drafts] Supabase error:', error.message)
    return NextResponse.json<ApiError>(
      { error: 'Database Error', message: error.message },
      { status: 500 }
    )
  }

  // Flatten leads → drafts, sorting drafts by sequence within each lead
  const drafts: DraftItem[] = []

  for (const lead of data ?? []) {
    const searchName = Array.isArray(lead.searches)
      ? (lead.searches[0]?.name ?? null)
      : (lead.searches as { name: string } | null)?.name ?? null

    const sortedDrafts = [...(lead.message_drafts ?? [])].sort(
      (a, b) => (a.sequence ?? 0) - (b.sequence ?? 0)
    )

    for (const d of sortedDrafts) {
      drafts.push({
        id:                d.id,
        lead_id:           lead.id,
        lead_name:         lead.name,
        lead_linkedin_url: lead.linkedin_url,
        lead_company:      lead.company ?? null,
        search_name:       searchName,
        sequence:          d.sequence,
        draft_text:        d.draft_text,
        confidence:        d.confidence,
      })
    }
  }

  return NextResponse.json(drafts)
}
