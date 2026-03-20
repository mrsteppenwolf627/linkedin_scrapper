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
  maxResults: number = 30
): Promise<SearchExecutionResult> {
  const supabase = createServerClient()

  console.log(`\n🔍 [Scraper] Iniciando búsqueda: "${searchName}"`)
  console.log(`📝 [Scraper] Query: ${googleQuery}`)
  console.log(`⚙️  [Scraper] Filtros:`, filters)

  // --- PASO 1: Crear registro en BD ---
  const { data: searchRecord, error: searchInsertError } = await supabase
    .from('searches')
    .insert({
      name: searchName,
      filters,
      google_query: googleQuery,
      status: 'running',
    })
    .select()
    .single()

  if (searchInsertError || !searchRecord) {
    throw new Error(`Error creando búsqueda en BD: ${searchInsertError?.message}`)
  }

  const searchId: string = searchRecord.id
  console.log(`✅ [Scraper] Search ID: ${searchId}`)

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
      console.log(`   URL: ${result.link}`)

      // PASO 3a: Parsear snippet con Claude
      let parsed: ParsedContact
      try {
        parsed = await parseLinkedInSnippet(result.snippet, result.link)
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

      // PASO 3b: Validar contra filtros con Claude
      let validated: ValidatedContact
      try {
        validated = await validateContact(parsed, filters)
        console.log(
          `   Validación: válido=${validated.is_valid} | cumplimiento=${validated.score_cumplimiento}`
        )
      } catch (err) {
        console.error(`   ❌ Validation error:`, err)
        totalInvalid++
        continue
      }

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
      const normalizedUrl = normalizeLinkedInUrl(result.link)
      const contactData = {
        linkedin_url: normalizedUrl,
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
