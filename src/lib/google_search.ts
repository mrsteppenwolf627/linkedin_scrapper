// ============================================
// LinkedIn Scraper V1 - SearchApi.io Engine (Google Proxy)
// ============================================

import type { GoogleSearchResult } from '@/types'

/**
 * Busca en Google usando la API de SearchApi.io y devuelve resultados orgánicos.
 * SearchApi.io maneja el proxy y la rotación para evitar bloqueos.
 */
export async function searchGoogle(
  query: string,
  maxResults: number = 30,
  page: number = 1
): Promise<GoogleSearchResult[]> {
  const apiKey = process.env.SEARCHAPI_IO_KEY
  
  if (!apiKey) {
    throw new Error('❌ SEARCHAPI_IO_KEY no configurada en .env.local')
  }

  // SearchApi.io API endpoint - Usando la clase URL
  const url = new URL('https://www.searchapi.io/api/v1/search')
  url.searchParams.append('engine', 'google')
  url.searchParams.append('q', query)
  url.searchParams.append('num', maxResults.toString())
  url.searchParams.append('page', page.toString())
  url.searchParams.append('api_key', apiKey)
  url.searchParams.append('gl', 'es') // Google locale España
  url.searchParams.append('hl', 'es') // Idioma español

  console.log(`🌐 [SearchApi] Realizando búsqueda para: "${query}" (Página ${page})`)

  // Cache: 'no-store' es crítica para asegurar resultados frescos y evitar bloqueos
  const response = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store'
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`🚨 SearchApi error ${response.status}: ${errorText}`)
  }

  const data = await response.json()
  
  // SearchApi devuelve los resultados orgánicos en organic_results
  const organicResults = data.organic_results || []

  // Mapeo respetando la interfaz original
  const results: GoogleSearchResult[] = organicResults.map((item: any) => ({
    title: item.title || '',
    link: item.link || '',
    snippet: item.snippet || '',
  }))

  console.log(
    `✨ [SearchApi Search] Query: "${query}" → ${results.length} resultados orgánicos encontrados`
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
