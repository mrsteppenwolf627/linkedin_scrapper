import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const authHeader = req.headers.get('authorization') || ''

    if (!supabaseUrl || !supabaseKey) {
      console.error('[/api/drafts] Missing Supabase env vars')
      return NextResponse.json({ drafts: [] })
    }

    const url = new URL(req.url)
    const params = new URLSearchParams(url.search)

    console.log('[/api/drafts] Fetching from Supabase:', supabaseUrl)
    console.log('[/api/drafts] Params:', Object.fromEntries(params))

    const response = await fetch(
      `${supabaseUrl}/rest/v1/message_drafts?select=*&order=created_at.desc&limit=1000`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      const errText = await response.text()
      console.error('[/api/drafts] Supabase error:', response.status, errText)
      return NextResponse.json({ drafts: [] })
    }

    const data = await response.json()
    console.log('[/api/drafts] Fetched', data.length, 'drafts')

    return NextResponse.json({ drafts: data || [] })
  } catch (error) {
    console.error('[/api/drafts] Error:', error)
    return NextResponse.json({ drafts: [] })
  }
}
