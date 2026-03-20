// ============================================
// LinkedIn Scraper V1 - 4 Prompts Claude
// ============================================
// Prompts: parse_snippet | validate_contact | check_duplicate | generate_query

import Anthropic from '@anthropic-ai/sdk'
import type {
  ParsedContact,
  ValidatedContact,
  DuplicateCheckResult,
  SearchFilters,
  ContactRecord,
} from '@/types'

// Singleton del cliente Anthropic
let anthropicClient: Anthropic | null = null

function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set in environment')
    anthropicClient = new Anthropic({ apiKey })
  }
  return anthropicClient
}

// Helper: extrae JSON de la respuesta de Claude (maneja markdown ```json ... ```)
function extractJson<T>(responseText: string): T {
  const jsonMatch = responseText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error(
      `No valid JSON found in Claude response: ${responseText.slice(0, 200)}`
    )
  }
  return JSON.parse(jsonMatch[0]) as T
}

// ============================================
// PROMPT 1: parse_linkedin_snippet_v1
// Extrae datos estructurados del snippet de Google
// ============================================

export async function parseLinkedInSnippet(
  snippet: string,
  linkedinUrl: string
): Promise<ParsedContact> {
  const anthropic = getAnthropic()

  const prompt = `Eres un extractor experto de datos de perfiles de LinkedIn desde snippets de Google Search.

**SNIPPET DE GOOGLE:**
${snippet}

**URL LINKEDIN:**
${linkedinUrl}

Extrae los datos disponibles y devuelve SOLO un JSON válido, sin markdown ni explicaciones adicionales.

Estructura requerida:
{
  "nombre": "nombre completo o null si no se encuentra",
  "titulo": "job title/puesto actual o null",
  "empresa": "nombre de la empresa actual o null",
  "ubicacion": "ciudad/país o null",
  "anos_experiencia": número entero o null,
  "palabras_clave_encontradas": ["keyword1", "keyword2"],
  "score_confianza": número entre 0.0 y 1.0,
  "es_valido": true o false,
  "notas": "observaciones relevantes en una frase"
}

Reglas estrictas:
- Si un dato no está claro, devuelve null. NUNCA inventar datos.
- score_confianza: 1.0 = todos los campos presentes y claros. Reduce 0.1 por cada campo null o ambiguo.
- es_valido = false si: falta el nombre, el snippet es spam/irrelevante, o la URL no es linkedin.com/in/
- palabras_clave_encontradas: solo las que aparecen literalmente en el snippet (sector, rol, skills)`

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001', // Haiku es suficiente para parsing, más barato
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  return extractJson<ParsedContact>(text)
}

// ============================================
// PROMPT 2: validate_contact_v1
// Valida que el contacto cumple los filtros de búsqueda
// ============================================

export async function validateContact(
  contact: ParsedContact,
  filters: SearchFilters
): Promise<ValidatedContact> {
  const anthropic = getAnthropic()

  const prompt = `Valida si este contacto cumple los criterios de búsqueda de LinkedIn.

**CONTACTO PARSEADO:**
${JSON.stringify(contact, null, 2)}

**FILTROS DE BÚSQUEDA:**
- Sector objetivo: ${filters.sector}
- Años mínimos de experiencia: ${filters.years_min}
- Palabras clave requeridas: ${filters.keywords.join(', ')}
- Ubicación (opcional): ${filters.location ?? 'No especificada'}

Devuelve SOLO un JSON válido:
{
  "is_valid": true o false,
  "razones_rechazo": ["razón1", "razón2"],
  "score_cumplimiento": número entre 0.0 y 1.0,
  "notas": "explicación breve"
}

Criterios de validación (todos deben cumplirse para is_valid = true):
1. es_valido del contacto es true (datos suficientes)
2. anos_experiencia >= ${filters.years_min} (o null si no se sabe → no rechazar por esto)
3. Al menos 1 palabra clave de [${filters.keywords.join(', ')}] aparece en título o empresa
4. El sector "${filters.sector}" tiene relación con el título/empresa del contacto
5. Si se especificó ubicación y el contacto tiene ubicación, deben ser compatibles

score_cumplimiento: suma 0.25 por criterio cumplido. Máximo 1.0.
Si is_valid = false, razones_rechazo debe explicar cuál criterio falló.`

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const validation = extractJson<{
    is_valid: boolean
    razones_rechazo: string[]
    score_cumplimiento: number
    notas: string
  }>(text)

  return { ...contact, ...validation }
}

// ============================================
// PROMPT 3: check_duplicate_v1
// Deduplicación inteligente: ¿son la misma persona?
// Solo se llama cuando hay candidatos similares (no URL exacta)
// ============================================

export async function checkDuplicateWithClaude(
  newContact: { nombre: string | null; linkedin_url: string; email?: string | null },
  existingContact: { name: string; linkedin_url: string; email?: string | null }
): Promise<DuplicateCheckResult> {
  const anthropic = getAnthropic()

  const prompt = `Determina si estos dos contactos son la MISMA persona de LinkedIn.

**CONTACTO NUEVO:**
- Nombre: ${newContact.nombre ?? 'desconocido'}
- LinkedIn URL: ${newContact.linkedin_url}
- Email: ${newContact.email ?? 'no disponible'}

**CONTACTO EXISTENTE EN BD:**
- Nombre: ${existingContact.name}
- LinkedIn URL: ${existingContact.linkedin_url}
- Email: ${existingContact.email ?? 'no disponible'}

Devuelve SOLO un JSON válido:
{
  "is_duplicate": true o false,
  "confianza": número entre 0.0 y 1.0,
  "razon": "explicación de la decisión en una frase"
}

Criterios de evaluación (en orden de prioridad):
1. Email exacto igual → duplicado con confianza 1.0
2. LinkedIn URL normalizada igual → duplicado con confianza 0.95
3. Nombre muy similar (variaciones: "J. Smith" ≈ "John Smith") + misma empresa → confianza 0.80
4. Solo nombre parecido sin más datos → confianza ≤ 0.50 → NO marcar como duplicado

Considera duplicado (is_duplicate = true) solo si confianza >= 0.75.`

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const result = extractJson<{
    is_duplicate: boolean
    confianza: number
    razon: string
  }>(text)

  return {
    isDuplicate: result.is_duplicate,
    duplicateConfidence: result.confianza,
  }
}

// ============================================
// PROMPT 4: generate_google_query_v1
// Genera una query de Google óptima para LinkedIn
// ============================================

export async function generateGoogleQuery(filters: SearchFilters): Promise<string> {
  const anthropic = getAnthropic()

  const prompt = `Genera una query de búsqueda de Google para encontrar perfiles de LinkedIn que cumplan estos criterios.

**FILTROS:**
- Sector: ${filters.sector}
- Años mínimos de experiencia: ${filters.years_min}
- Palabras clave: ${filters.keywords.join(', ')}
- Ubicación: ${filters.location ?? 'España (por defecto)'}

Devuelve SOLO la query de búsqueda como string (sin explicaciones, sin comillas externas).

Reglas para construir la query:
1. Siempre empieza con: site:linkedin.com/in
2. Incluye variaciones ES e EN de cada palabra clave conectadas con OR
3. Añade los años de experiencia en formato: "${filters.years_min}+ años" OR "${filters.years_min}+ years"
4. Añade la ubicación al final si se especificó
5. Usa paréntesis para agrupar variaciones
6. Máximo 10 términos para no saturar Google

Ejemplo de estructura:
site:linkedin.com/in (consultor OR consultant) (energía OR energy OR solar) (5+ años OR 5+ years) España`

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  // Limpiar comillas o espacios extra que Claude pueda añadir
  return text.trim().replace(/^["']|["']$/g, '')
}
