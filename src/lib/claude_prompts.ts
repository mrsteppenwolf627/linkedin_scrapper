// ============================================
// LinkedIn Scraper V1 - 4 Prompts AI (OpenAI)
// ============================================
// Prompts: parse_snippet | validate_contact | check_duplicate | generate_query

import OpenAI from 'openai'
import type {
  ParsedContact,
  ValidatedContact,
  DuplicateCheckResult,
  SearchFilters,
} from '@/types'

// Singleton del cliente OpenAI
let openaiClient: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('OPENAI_API_KEY not set in environment')
    openaiClient = new OpenAI({ apiKey })
  }
  return openaiClient
}

// Modelo a usar: gpt-4o-mini (rápido, barato, suficiente para parsing estructurado)
const MODEL = 'gpt-4o-mini'

// ============================================
// PROMPT 1: parse_linkedin_snippet_v1
// Extrae datos estructurados del snippet de Google
// ============================================

export async function parseLinkedInSnippet(
  snippet: string,
  linkedinUrl: string
): Promise<ParsedContact> {
  const openai = getOpenAI()

  const response = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: 400,
    response_format: { type: 'json_object' }, // Garantiza JSON válido sin regex
    messages: [
      {
        role: 'system',
        content:
          'Eres un extractor experto de datos de perfiles de LinkedIn desde snippets de Google Search. Siempre respondes con JSON válido.',
      },
      {
        role: 'user',
        content: `Extrae los datos del siguiente snippet y devuelve un JSON con esta estructura exacta:
{
  "nombre": "nombre completo o null",
  "titulo": "job title/puesto actual o null",
  "empresa": "nombre de la empresa actual o null",
  "ubicacion": "ciudad/país o null",
  "anos_experiencia": número entero o null,
  "palabras_clave_encontradas": ["keyword1", "keyword2"],
  "score_confianza": número entre 0.0 y 1.0,
  "es_valido": true o false,
  "notas": "observación en una frase"
}

SNIPPET: ${snippet}
URL LINKEDIN: ${linkedinUrl}

Reglas:
- Si un dato no está claro → null. NUNCA inventar.
- score_confianza: 1.0 = todos los campos claros. Reduce 0.1 por cada campo null/ambiguo.
- es_valido = false si: falta nombre, snippet es spam, o URL no es linkedin.com/in/
- palabras_clave_encontradas: solo las que aparecen literalmente en el snippet.`,
      },
    ],
  })

  const text = response.choices[0].message.content ?? '{}'
  return JSON.parse(text) as ParsedContact
}

// ============================================
// PROMPT 2: validate_contact_v1
// Valida que el contacto cumple los filtros de búsqueda
// ============================================

export async function validateContact(
  contact: ParsedContact,
  filters: SearchFilters,
  rawText?: string  // Texto original completo (title + snippet) para mejor matching
): Promise<ValidatedContact> {
  const openai = getOpenAI()

  const response = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: 300,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'Eres un validador de contactos de LinkedIn. Evalúas si un perfil cumple los criterios de búsqueda. Siempre respondes con JSON válido.',
      },
      {
        role: 'user',
        content: `Valida si este contacto cumple los criterios y devuelve JSON:
{
  "is_valid": true o false,
  "razones_rechazo": ["razón1"],
  "score_cumplimiento": número entre 0.0 y 1.0,
  "notas": "explicación breve"
}

DATOS EXTRAÍDOS: ${JSON.stringify(contact)}
${rawText ? `TEXTO COMPLETO DEL PERFIL: "${rawText}"` : ''}

FILTROS:
- Sector: ${filters.sector}
- Años mínimos: ${filters.years_min}
- Keywords: ${filters.keywords.join(', ')}
- Ubicación requerida: ${filters.location ?? 'No especificada'}

Criterios para is_valid = true:
1. es_valido del contacto es true
2. anos_experiencia >= ${filters.years_min} — si es null, NO rechazar
3. Al menos 1 keyword aparece en el TEXTO COMPLETO (no solo campos extraídos). Acepta equivalentes multilingüe:
   "consultor/a" = consultant, consulting, consultancy, advisor, asesor
   "energía" = energy, energético, renewables, renewable, clean energy, solar, eólica, wind
   "solar" = solar, photovoltaic, PV, fotovoltaica
4. El sector "${filters.sector}" tiene relación semántica con el perfil
5. Ubicación: solo rechazar si la ubicación del contacto es explícita Y claramente fuera de ${filters.location ?? 'España'}. Si es null → NO rechazar.

score_cumplimiento: 0.25 por criterio cumplido.`,
      },
    ],
  })

  const text = response.choices[0].message.content ?? '{}'
  const validation = JSON.parse(text) as {
    is_valid: boolean
    razones_rechazo: string[]
    score_cumplimiento: number
    notas: string
  }

  return { ...contact, ...validation }
}

// ============================================
// PROMPT 3: check_duplicate_v1
// Deduplicación inteligente: ¿son la misma persona?
// Solo se llama cuando hay candidatos similares por nombre
// ============================================

export async function checkDuplicateWithClaude(
  newContact: { nombre: string | null; linkedin_url: string; email?: string | null },
  existingContact: { name: string; linkedin_url: string; email?: string | null }
): Promise<DuplicateCheckResult> {
  const openai = getOpenAI()

  const response = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: 150,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'Determinas si dos contactos de LinkedIn son la misma persona. Respondes siempre con JSON válido.',
      },
      {
        role: 'user',
        content: `¿Son la misma persona? Devuelve JSON:
{
  "is_duplicate": true o false,
  "confianza": número entre 0.0 y 1.0,
  "razon": "explicación en una frase"
}

NUEVO: nombre="${newContact.nombre}", url="${newContact.linkedin_url}", email="${newContact.email ?? 'n/a'}"
EXISTENTE: nombre="${existingContact.name}", url="${existingContact.linkedin_url}", email="${existingContact.email ?? 'n/a'}"

Criterios:
- Email exacto igual → confianza 1.0
- URL normalizada igual → confianza 0.95
- Nombre muy similar + misma empresa → confianza 0.80
- Solo nombre parecido → confianza ≤ 0.50

Marcar duplicado solo si confianza >= 0.75.`,
      },
    ],
  })

  const text = response.choices[0].message.content ?? '{}'
  const result = JSON.parse(text) as {
    is_duplicate: boolean
    confianza: number
    razon: string
  }

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
  const openai = getOpenAI()

  // Este prompt devuelve texto plano (la query), no JSON
  const response = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: 150,
    messages: [
      {
        role: 'system',
        content:
          'Generas queries de Google para encontrar perfiles de LinkedIn. Respondes SOLO con la query, sin explicaciones ni comillas.',
      },
      {
        role: 'user',
        content: `Genera una query de Google para estos filtros:
- Sector: ${filters.sector}
- Años mínimos: ${filters.years_min}
- Keywords: ${filters.keywords.join(', ')}
- Ubicación: ${filters.location ?? 'España'}

Reglas:
1. Empieza siempre con: site:linkedin.com/in
2. Incluye variaciones ES e EN de cada keyword con OR
3. Años: ${filters.years_min}+ años OR ${filters.years_min}+ years
4. Añade ubicación al final
5. Usa paréntesis para agrupar variaciones
6. Máximo 10 términos
7. MUY IMPORTANTE: NO uses comillas dobles en ninguna parte de la query

Ejemplo: site:linkedin.com/in (consultor OR consultant) (energía OR energy) (5+ años OR 5+ years) España`,
      },
    ],
  })

  const text = response.choices[0].message.content ?? ''
  // Eliminar comillas externas Y comillas internas — Serper las rechaza con site:
  return text.trim().replace(/^["']|["']$/g, '').replace(/"/g, '')
}
