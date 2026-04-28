// ============================================
// POST /api/generate-messages
// Genera 3 borradores de mensaje LinkedIn con IA
// y los persiste en Supabase (leads + message_drafts).
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { generateMessagesWithPipeline } from '@/lib/claude_prompts'
import { saveLeadWithDrafts } from '@/lib/message_store'
import type { GenerateMessagesRequestBody, GenerateMessagesApiResponse, ApiError } from '@/types'

export async function POST(req: NextRequest) {
  // --- Auth ---
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey || apiKey !== process.env.SEARCH_API_KEY) {
    return NextResponse.json<ApiError>(
      { error: 'Unauthorized', message: 'API key inválida o ausente' },
      { status: 401 }
    )
  }

  let body: GenerateMessagesRequestBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json<ApiError>(
      { error: 'Bad Request', message: 'Body JSON inválido' },
      { status: 400 }
    )
  }

  const { name, title, company, industry, location, linkedin_url, profile_snippet, your_product } = body

  if (!name || !title || !company || !industry || !linkedin_url || !your_product) {
    return NextResponse.json<ApiError>(
      {
        error: 'Bad Request',
        message: 'Faltan campos requeridos: name, title, company, industry, linkedin_url, your_product',
      },
      { status: 400 }
    )
  }

  const leadInput = {
    name,
    title,
    company,
    industry,
    location: location ?? '',
    linkedin_url,
    profile_snippet,
    your_product,
  }

  try {
    // 1. Generate 3 drafts via pipeline (enrich → generate → humanize)
    const { drafts, usage } = await generateMessagesWithPipeline(leadInput)

    // 2. Server-side cost log (not exposed to client)
    console.log(
      `[generate-messages] ${name} @ ${company} | ` +
      `tokens: ${usage.prompt_tokens}in + ${usage.completion_tokens}out = ${usage.total_tokens} | ` +
      `cost: $${usage.estimated_cost_usd.toFixed(6)}`
    )

    // 3. Persist lead + drafts to Supabase
    const { lead_id } = await saveLeadWithDrafts(leadInput, drafts)

    // 4. Return response (usage is internal — not sent to client)
    const response: GenerateMessagesApiResponse = { lead_id, drafts }
    return NextResponse.json(response, { status: 200 })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    console.error('[/api/generate-messages] Error:', message)

    return NextResponse.json<ApiError>(
      { error: 'Internal Server Error', message },
      { status: 500 }
    )
  }
}
