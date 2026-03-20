// ============================================
// LinkedIn Scraper V1 - Google Search via Serper.dev
// ============================================

import type { GoogleSearchResult } from '@/types'

interface SerperOrganicResult {
  title: string
  link: string
  snippet: string
  position?: number
}

interface SerperResponse {
  organic?: SerperOrganicResult[]
  searchParameters?: { q: string; num: number }
  credits?: number
}

/**
 * Busca en Google usando Serper.dev y devuelve resultados orgánicos.
 * Filtra automáticamente para mantener solo URLs de linkedin.com
 */
export async function searchGoogle(
  query: string,
  maxResults: number = 10
): Promise<GoogleSearchResult[]> {
  const apiKey = process.env.SERPER_API_KEY
  if (!apiKey) throw new Error('SERPER_API_KEY not set in environment')

  const response = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: query,
      num: Math.min(maxResults, 100), // Serper max es 100
      gl: 'es', // Google locale España para mejores resultados ES/EN
      hl: 'es',
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Serper API error ${response.status}: ${errorText}`)
  }

  const data: SerperResponse = await response.json()

  const results: GoogleSearchResult[] =
    data.organic?.map((result) => ({
      title: result.title || '',
      link: result.link || '',
      snippet: result.snippet || '',
    })) ?? []

  console.log(
    `[Google Search] Query: "${query}" → ${results.length} resultados`
  )

  return results
}

/**
 * Filtra resultados para asegurarse que son perfiles de LinkedIn válidos.
 * Un perfil válido tiene URL del tipo linkedin.com/in/username
 */
export function filterLinkedInProfiles(
  results: GoogleSearchResult[]
): GoogleSearchResult[] {
  return results.filter((r) => {
    const url = r.link.toLowerCase()
    return (
      url.includes('linkedin.com/in/') &&
      !url.includes('/posts/') &&
      !url.includes('/pulse/')
    )
  })
}

/**
 * Normaliza una URL de LinkedIn para comparación y dedup.
 * linkedin.com/in/john-smith?miniProfile=xxx → linkedin.com/in/john-smith
 */
export function normalizeLinkedInUrl(url: string): string {
  return url
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?/, '')
    .replace(/\/$/, '')
    .replace(/\?.*$/, '') // Quitar query params
    .replace(/#.*$/, '') // Quitar hash
}
