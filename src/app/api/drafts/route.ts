import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      console.error('[/api/drafts] Missing Supabase env vars')
      return NextResponse.json({ drafts: [] })
    }

    const apiUrl = `${supabaseUrl}/rest/v1/message_drafts?select=id,sequence,draft_text,batch_id,leads(name,linkedin_url,company)&order=created_at.desc&limit=1000`

    console.log('[/api/drafts] Fetching all messages...')

    const response = await fetch(apiUrl, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('[/api/drafts] Supabase error:', response.status, errText)
      return NextResponse.json({ drafts: [] })
    }

    const data = await response.json()
    console.log('[/api/drafts] Fetched', data?.length ?? 0, 'drafts')

    const drafts = (data || []).map((d: any) => ({
      id: d.id,
      lead_name: d.leads?.name ?? '',
      lead_linkedin_url: d.leads?.linkedin_url ?? '',
      lead_company: d.leads?.company ?? null,
      sequence: d.sequence,
      draft_text: d.draft_text,
    }))

    return NextResponse.json({ drafts })
  } catch (error) {
    console.error('[/api/drafts] Error:', error)
    return NextResponse.json({ drafts: [] })
  }
}
