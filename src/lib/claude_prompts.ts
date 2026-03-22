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
- Puesto: ${filters.jobTitle}
- Experiencia: ${filters.experience}
- Sector: ${filters.industry}
- Ubicación: ${filters.location}

Criterios para is_valid = true:
1. es_valido del contacto es true
2. El título del contacto o su snippet tiene relación semántica clara con el puesto "${filters.jobTitle}"
3. La experiencia del contacto encaja con el criterio "${filters.experience}".
4. El sector "${filters.industry}" tiene relación semántica con el perfil
5. Ubicación: solo rechazar si la ubicación del contacto es explícita Y claramente fuera de "${filters.location}". Si es ambiguo → NO rechazar.

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
          'Generas queries de Google efectivas para encontrar perfiles de LinkedIn. Respondes SOLO con la query limpia, sin bloques de código ni explicaciones.',
      },
      {
        role: 'user',
        content: `Crea una búsqueda de Google para encontrar estos perfiles en LinkedIn:
- Puesto: ${filters.jobTitle}
- Sector: ${filters.industry}
- Ubicación: ${filters.location}

Reglas CRÍTICAS:
1. Empieza SIEMPRE con el operador: site:linkedin.com/in/
2. Ignora completamente los años de experiencia para esta query (se filtrarán después).
3. Incluye solo el puesto, el sector y la localización.
4. Usa comillas para términos compuestos si es necesario.
5. NO uses el operador intitle.

Ejemplo de salida: site:linkedin.com/in/ "Director de Marketing" "Salud" Madrid`,
      },
    ],
  })

  const text = response.choices[0].message.content ?? ''
  
  return text.trim()
    .replace(/^["']|["']$/g, '') 
    .replace(/\s+/g, ' '); 
}
