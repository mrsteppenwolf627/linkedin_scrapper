import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const API_KEY = process.env.NEXT_PUBLIC_SEARCH_API_KEY ?? ''

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('x-api-key')

  if (!authHeader || authHeader !== API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  try {
    const { data, error } = await supabase
      .from('message_batches')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching batches:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (err) {
    console.error('Error in GET /api/batches:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
