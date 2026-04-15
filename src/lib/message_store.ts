// ============================================
// Message Store — DB helpers for leads + message_drafts
// ============================================

import { createServerClient } from '@/lib/supabase'
import type { LeadInput, MessageDraft } from '@/types'

interface SaveResult {
  lead_id: string
  draft_ids: string[]
}

/**
 * Inserts a lead record and its 3 AI-generated drafts in a single transaction.
 * Returns the new lead_id and the list of draft UUIDs.
 * Pass options.search_id to link the lead to an existing search record.
 */
export async function saveLeadWithDrafts(
  lead: LeadInput,
  drafts: MessageDraft[],
  options?: { search_id?: string }
): Promise<SaveResult> {
  const supabase = createServerClient()

  // 1. Insert lead
  const { data: leadRow, error: leadErr } = await supabase
    .from('leads')
    .insert({
      name:         lead.name,
      title:        lead.title    || null,
      company:      lead.company  || null,
      industry:     lead.industry || null,
      location:     lead.location || null,
      linkedin_url: lead.linkedin_url,
      your_product: lead.your_product ?? null,
      search_id:    options?.search_id ?? null,
    })
    .select('id')
    .single()

  if (leadErr || !leadRow) {
    throw new Error(`Error al guardar lead en Supabase: ${leadErr?.message ?? 'sin datos'}`)
  }

  // 2. Insert 3 drafts
  const draftsPayload = drafts.map((d) => ({
    lead_id:    leadRow.id,
    sequence:   d.sequence,
    draft_text: d.text,
    confidence: d.confidence,
  }))

  const { data: draftRows, error: draftsErr } = await supabase
    .from('message_drafts')
    .insert(draftsPayload)
    .select('id')

  if (draftsErr || !draftRows) {
    throw new Error(`Error al guardar drafts en Supabase: ${draftsErr?.message ?? 'sin datos'}`)
  }

  return {
    lead_id:   leadRow.id,
    draft_ids: draftRows.map((r: { id: string }) => r.id),
  }
}
