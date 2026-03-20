// ============================================
// LinkedIn Scraper V1 - Core Orchestrator
// executeLinkedInSearch: Google → Claude → Supabase
// ============================================

import { createServerClient } from '@/lib/supabase'
import {
  searchGoogle,
  filterLinkedInProfiles,
  normalizeLinkedInUrl,
} from '@/lib/google_search'
import {
  parseLinkedInSnippet,
  validateContact,
  checkDuplicateWithClaude,
} from '@/lib/claude_prompts'
import type {
  SearchFilters,
  ContactRecord,
  SearchExecutionResult,
  ParsedContact,
  ValidatedContact,
} from '@/types'

// ============================================
// VALIDACIÓN EN CÓDIGO (sin LLM, determinista)
// ============================================

// Mapa de equivalencias multilingüe para keywords comunes
const KEYWORD_SYNONYMS: Record<string, string[]> = {
  consultor: ['consultor', 'consultant', 'consulting', 'consultancy', 'consultora', 'advisor', 'adviser', 'asesor', 'asesora'],
  energía:   ['energía', 'energia', 'energy', 'energético', 'energetico', 'renewables', 'renewable', 'clean energy', 'eólica', 'eolica', 'wind', 'fotovoltaica', 'fotovoltaic', 'photovoltaic'],
  solar:     ['solar', 'photovoltaic', 'fotovoltaica', 'pv ', 'solar power', 'solar energy'],
  renovables:['renovables', 'renewables', 'renewable energy', 'clean energy', 'energías renovables'],
  tecnología:['tecnología', 'tecnologia', 'technology', 'tech', 'software', 'digital'],
  finanzas:  ['finanzas', 'finance', 'financial', 'banking', 'investment', 'inversión'],
  marketing: ['marketing', 'growth', 'digital marketing', 'brand'],
}

function keywordMatchesText(keyword: string, text: string): boolean {
  const lowerText = text.toLowerCase()
  const synonyms = KEYWORD_SYNONYMS[keyword.toLowerCase()] ?? [keyword.toLowerCase()]
  return synonyms.some((syn) => lowerText.includes(syn))
}

function validateInCode(
  contact: ParsedContact,
  filters: SearchFilters,
  rawText: string
): { is_valid: boolean; razones_rechazo: string[]; score_cumplimiento: number; notas: string } {
  const razones: string[] = []
  let score = 0

  // Criterio 1: el parsing lo marcó como válido
  if (!contact.es_valido) {
    razones.push('Datos insuficientes en el snippet')
  } else {
    score += 0.25
  }

  // Criterio 2: experiencia mínima (solo rechazar si tenemos el dato Y es claramente inferior)
  if (contact.anos_experiencia !== null && contact.anos_experiencia < filters.years_min) {
    razones.push(`Experiencia insuficiente (${contact.anos_experiencia} < ${filters.years_min} años)`)
  } else {
    score += 0.25 // null = beneficio de la duda
  }

  // Criterio 3: al menos 1 keyword en el texto completo
  const keywordFound = filters.keywords.some((kw) => keywordMatchesText(kw, rawText))
  if (!keywordFound) {
    razones.push(`Ninguna keyword [${filters.keywords.join(', ')}] encontrada en el perfil`)
  } else {
    score += 0.25
  }

  // Criterio 4: ubicación — SOLO rechazar si la ubicación extraída es explícita Y fuera del target
  // No rechazar si es null. Google ya filtra por localización via query + gl param.
  if (filters.location && contact.ubicacion) {
    const targetLower = filters.location.toLowerCase()
    const profileLower = contact.ubicacion.toLowerCase()
    // Verificamos si hay solapamiento básico (país o ciudad mencionada)
    const locationOk = profileLower.includes(targetLower) ||
                       targetLower.includes(profileLower) ||
                       profileLower.includes('spain') ||
                       profileLower.includes('españa')
    if (!locationOk) {
      razones.push(`Ubicación "${contact.ubicacion}" incompatible con "${filters.location}"`)
    } else {
      score += 0.25
    }
  } else {
    score += 0.25 // null = no penalizar
  }

  return {
    is_valid: razones.length === 0,
    razones_rechazo: razones,
    score_cumplimiento: Math.min(score, 1.0),
    notas: razones.length === 0 ? 'Cumple todos los criterios' : razones.join('; '),
  }
}

// ============================================
// DEDUPLICACIÓN (sin Claude, rápida)
// ============================================

/**
 * Comprueba si la URL de LinkedIn ya existe en BD.
 * Nivel 1: URL normalizada exacta
 * Nivel 2: Email exacto (si disponible)
 * Nivel 3: Claude fuzzy match (solo si hay candidatos similares)
 */
async function checkDuplicate(
  supabase: ReturnType<typeof createServerClient>,
  linkedinUrl: string,
  contactName: string | null,
  email?: string | null
): Promise<{ isDuplicate: boolean; existingContactId?: string }> {
  const normalizedUrl = normalizeLinkedInUrl(linkedinUrl)

  // Nivel 1: URL exacta normalizada
  const { data: byUrl } = await supabase
    .from('contacts')
    .select('id, name, linkedin_url, email')
    .eq('linkedin_url', normalizedUrl)
    .limit(1)

  if (byUrl && byUrl.length > 0) {
    return { isDuplicate: true, existingContactId: byUrl[0].id }
  }

  // Nivel 2: URL sin normalizar (por si acaso)
  const { data: byRawUrl } = await supabase
    .from('contacts')
    .select('id')
    .eq('linkedin_url', linkedinUrl)
    .limit(1)

  if (byRawUrl && byRawUrl.length > 0) {
    return { isDuplicate: true, existingContactId: byRawUrl[0].id }
  }

  // Nivel 3: Email exacto
  if (email) {
    const { data: byEmail } = await supabase
      .from('contacts')
      .select('id, name, linkedin_url, email')
      .eq('email', email.toLowerCase())
      .limit(1)

    if (byEmail && byEmail.length > 0) {
      return { isDuplicate: true, existingContactId: byEmail[0].id }
    }
  }

  // Nivel 4: Fuzzy con Claude (solo si hay candidatos por nombre similar)
  // Solo activar si el nombre es conocido para no gastar tokens innecesariamente
  if (contactName) {
    const firstName = contactName.split(' ')[0]
    const { data: candidates } = await supabase
      .from('contacts')
      .select('id, name, linkedin_url, email')
      .ilike('name', `${firstName}%`)
      .limit(5)

    if (candidates && candidates.length > 0) {
      for (const candidate of candidates) {
        const result = await checkDuplicateWithClaude(
          { nombre: contactName, linkedin_url: linkedinUrl, email },
          { name: candidate.name, linkedin_url: candidate.linkedin_url, email: candidate.email }
        )
        if (result.isDuplicate) {
          return { isDuplicate: true, existingContactId: candidate.id }
        }
      }
    }
  }

  return { isDuplicate: false }
}

// ============================================
// ORQUESTADOR PRINCIPAL
// ============================================

export async function executeLinkedInSearch(
  searchName: string,
  googleQuery: string,
  filters: SearchFilters,
  maxResults: number = 30,
  existingSearchId?: string  // Si se pasa, no crea registro nuevo en BD
): Promise<SearchExecutionResult> {
  const supabase = createServerClient()

  console.log(`\n🔍 [Scraper] Iniciando búsqueda: "${searchName}"`)
  console.log(`📝 [Scraper] Query: ${googleQuery}`)

  // --- PASO 1: Usar ID existente o crear registro nuevo ---
  let searchId: string

  if (existingSearchId) {
    searchId = existingSearchId
    console.log(`✅ [Scraper] Usando Search ID existente: ${searchId}`)
  } else {
    const { data: searchRecord, error: searchInsertError } = await supabase
      .from('searches')
      .insert({ name: searchName, filters, google_query: googleQuery, status: 'running' })
      .select()
      .single()

    if (searchInsertError || !searchRecord) {
      throw new Error(`Error creando búsqueda en BD: ${searchInsertError?.message}`)
    }
    searchId = searchRecord.id
    console.log(`✅ [Scraper] Search ID creado: ${searchId}`)
  }

  let totalProcessed = 0
  let totalCreated = 0
  let totalDuplicates = 0
  let totalInvalid = 0
  const results: ContactRecord[] = []

  try {
    // --- PASO 2: Buscar en Google ---
    console.log(`\n🌐 [Scraper] Buscando en Google...`)
    const allGoogleResults = await searchGoogle(googleQuery, maxResults)
    const googleResults = filterLinkedInProfiles(allGoogleResults)

    console.log(
      `[Scraper] Google: ${allGoogleResults.length} total, ${googleResults.length} perfiles LinkedIn válidos`
    )

    // Actualizar conteo de resultados Google
    await supabase
      .from('searches')
      .update({ total_results_google: allGoogleResults.length })
      .eq('id', searchId)

    // --- PASO 3: Procesar cada resultado ---
    for (const result of googleResults) {
      totalProcessed++
      console.log(`\n📌 [${totalProcessed}/${googleResults.length}] ${result.title}`)
      console.log(`   URL:     ${result.link}`)
      console.log(`   Snippet: ${result.snippet.slice(0, 80)}...`)

      // PASO 3a: Parsear snippet con OpenAI
      // Combinamos title + snippet: el title de Google siempre tiene "Nombre - Cargo | Empresa"
      const fullText = `${result.title}\n${result.snippet}`
      let parsed: ParsedContact
      try {
        parsed = await parseLinkedInSnippet(fullText, result.link)
        console.log(
          `   Parse: ${parsed.nombre ?? 'sin nombre'} | válido=${parsed.es_valido} | score=${parsed.score_confianza}`
        )
      } catch (err) {
        console.error(`   ❌ Parse error:`, err)
        totalInvalid++
        continue
      }

      if (!parsed.es_valido) {
        console.log(`   ⚠️  Inválido en parse: ${parsed.notas}`)
        totalInvalid++
        continue
      }

      // PASO 3b: Validación en código (fiable) + LLM solo para sector semántico
      const validation = validateInCode(parsed, filters, fullText)
      const validated: ValidatedContact = { ...parsed, ...validation }

      console.log(
        `   Validación: válido=${validated.is_valid} | cumplimiento=${validated.score_cumplimiento}`
      )

      if (!validated.is_valid) {
        console.log(`   ⚠️  Rechazado: ${validated.razones_rechazo.join(', ')}`)
        totalInvalid++
        continue
      }

      // PASO 3c: Comprobar duplicados
      const { isDuplicate, existingContactId } = await checkDuplicate(
        supabase,
        result.link,
        validated.nombre,
        null // email no disponible en snippets de Google
      )

      if (isDuplicate) {
        console.log(`   🔄 Duplicado (ID existente: ${existingContactId})`)
        totalDuplicates++
        continue
      }

      // PASO 3d: Guardar en BD
      // Guardamos la URL original con https:// para que sea clickeable
      // normalizeLinkedInUrl() solo se usa para comparación en checkDuplicate()
      const contactData = {
        linkedin_url: result.link,
        name: validated.nombre ?? 'Desconocido',
        job_title: validated.titulo ?? null,
        company: validated.empresa ?? null,
        location: validated.ubicacion ?? null,
        years_experience: validated.anos_experiencia ?? null,
        is_valid: true,
        confidence_score: validated.score_confianza,
        matching_keywords: {
          matches: validated.palabras_clave_encontradas,
          count: validated.palabras_clave_encontradas.length,
        },
        search_id: searchId,
        raw_google_snippet: result.snippet,
        raw_parsed_data: parsed,
        raw_validation_result: validated,
        status: 'new',
        is_duplicate: false,
      }

      try {
        const { data: created, error: insertError } = await supabase
          .from('contacts')
          .insert(contactData)
          .select()
          .single()

        if (insertError) {
          // Unique constraint violation = duplicado que no detectamos antes
          if (insertError.code === '23505') {
            console.log(`   🔄 Duplicado (constraint DB): ${result.link}`)
            totalDuplicates++
          } else {
            console.error(`   ❌ Insert error:`, insertError.message)
            totalInvalid++
          }
        } else {
          console.log(`   ✅ Guardado: ${validated.nombre}`)
          totalCreated++
          if (created) results.push(created as ContactRecord)
        }
      } catch (err) {
        console.error(`   ❌ Save error:`, err)
        totalInvalid++
      }
    }

    // --- PASO 4: Actualizar estadísticas finales ---
    await supabase
      .from('searches')
      .update({
        status: 'completed',
        total_results_processed: totalProcessed,
        total_contacts_created: totalCreated,
        total_duplicates_found: totalDuplicates,
        total_invalid: totalInvalid,
      })
      .eq('id', searchId)

    console.log(`\n✨ [Scraper] ¡Búsqueda completada!`)
    console.log(`   Procesados:  ${totalProcessed}`)
    console.log(`   Creados:     ${totalCreated}`)
    console.log(`   Duplicados:  ${totalDuplicates}`)
    console.log(`   Inválidos:   ${totalInvalid}`)
  } catch (err) {
    // Error fatal: marcar búsqueda como fallida
    console.error(`\n💥 [Scraper] Error fatal:`, err)

    await supabase
      .from('searches')
      .update({
        status: 'failed',
        error_message: String(err),
        total_results_processed: totalProcessed,
        total_contacts_created: totalCreated,
        total_duplicates_found: totalDuplicates,
        total_invalid: totalInvalid,
      })
      .eq('id', searchId)

    throw err
  }

  return {
    search_id: searchId,
    total_processed: totalProcessed,
    total_created: totalCreated,
    total_duplicates: totalDuplicates,
    total_invalid: totalInvalid,
    results,
  }
}
