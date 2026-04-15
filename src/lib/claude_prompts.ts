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
  LeadInput,
  GenerateMessagesResponse,
  TokenUsage,
} from '@/types'

// gpt-4o-mini pricing (USD per token, April 2026 reference)
const COST_INPUT_PER_TOKEN  = 0.15  / 1_000_000
const COST_OUTPUT_PER_TOKEN = 0.60  / 1_000_000

function calcUsage(
  prompt_tokens: number,
  completion_tokens: number
): TokenUsage {
  return {
    prompt_tokens,
    completion_tokens,
    total_tokens: prompt_tokens + completion_tokens,
    estimated_cost_usd:
      prompt_tokens * COST_INPUT_PER_TOKEN +
      completion_tokens * COST_OUTPUT_PER_TOKEN,
  }
}

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

// ── Confidence normalizer ────────────────────────────────────────────────────
// OpenAI sometimes returns confidence as "90%", 90, "0.9", or 0.9.
// This function always produces a float in [0, 1], with 0.85 as fallback.
const CONFIDENCE_FALLBACK = 0.85

function normalizeConfidence(raw: unknown): number {
  if (raw === null || raw === undefined) return CONFIDENCE_FALLBACK

  let n: number

  if (typeof raw === 'string') {
    const cleaned = raw.trim()
    // "90%" → parse as 90 then divide
    n = cleaned.endsWith('%')
      ? parseFloat(cleaned)          // gives 90
      : parseFloat(cleaned)          // gives 0.9 or 90
    if (isNaN(n)) return CONFIDENCE_FALLBACK
    // If the raw string had a % sign, it was a 0-100 value
    if (cleaned.endsWith('%')) n = n / 100
    // If it's still >1 it was on a 0-100 scale without the % sign
    else if (n > 1) n = n / 100
  } else if (typeof raw === 'number') {
    n = raw > 1 ? raw / 100 : raw
  } else {
    return CONFIDENCE_FALLBACK
  }

  return isNaN(n) ? CONFIDENCE_FALLBACK : Math.min(1, Math.max(0, n))
}

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

// ============================================
// PROMPT 5: generate_linkedin_messages_v3
// Secuencia de 3 mensajes B2B orientados a cerrar conversaciones
// ============================================

export async function generateLinkedInMessages(
  lead: LeadInput
): Promise<GenerateMessagesResponse> {
  const openai = getOpenAI()

  const hasSnippet = Boolean(lead.profile_snippet?.trim())
  const snippetSection = hasSnippet
    ? `\nCONTEXTO ADICIONAL DEL PERFIL: "${lead.profile_snippet}"`
    : ''

  const product = lead.your_product?.trim() || 'Tu Producto/Servicio'

  const response = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: 1200,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `Eres un experto en ventas B2B por LinkedIn. Tu objetivo: generar 3 mensajes de secuencia que CIERREN CONVERSACIONES.

Cada mensaje debe:
1. SER ESPECÍFICO: Menciona el rol, empresa o industria del lead
2. CREAR CURIOSIDAD: No vendas directo, haz preguntas que generen respuesta
3. SER BREVE: máx 280 caracteres (LinkedIn friendly)
4. TENER CTA CLARA: ¿15 min de chat? ¿Explorar juntos? ¿Agendar call?

SECUENCIA:

[MENSAJE 1 - PRIMER CONTACTO] (Objetivo: Abrir conversación)
- Hook: Algo que lo sorprenda (estadística, dato, problema común)
- Relevancia: ¿Por qué tú específicamente?
- CTA: Suave (¿curiosidad? ¿explorar?)

[MENSAJE 2 - FOLLOW-UP DÍA 3] (Objetivo: Recordar + ángulo diferente)
- Alude al anterior sin sonar desesperado
- Nuevo ángulo: Diferente razón para responder
- Social proof: Empresas similares lo usan
- CTA: Más directa

[MENSAJE 3 - FOLLOW-UP DÍA 7] (Objetivo: Último push con urgencia)
- Urgencia implícita (oportunidad, cambios próximos)
- Beneficio claro: ¿Qué pierde sin actuar?
- Cierre educado: Sin ser agresivo

USO DE {your_product} — MUY IMPORTANTE:
{your_product} puede contener hasta 1000 caracteres con casos de éxito, métricas,
features y problemas específicos que resuelve. Debes:
- EXTRAER los datos más relevantes (cifras, resultados, problemas concretos)
- DISTRIBUIR ese valor en los 3 mensajes con ángulos distintos:
  → Mensaje 1: usa el problema o gancho más potente
  → Mensaje 2: usa una métrica o caso de éxito diferente
  → Mensaje 3: usa el beneficio o urgencia más directa
- NO repetir el mismo argumento en dos mensajes
- NO mencionar el nombre del producto/empresa directamente si suena a spam

REGLAS:
- Personaliza con {name}, {company}, {role}, {sector}
- No sonar robótico: usa contracciones ("te", "tu")
- No vender directo: haz preguntas, crea curiosidad
- Cada mensaje es independiente (lead podría responder a cualquiera)
- Máx 280 caracteres CADA UNO (cuenta antes de responder; recorta si hace falta)
- Tono profesional pero humano
- NO usar: "Hola {name}, soy de X empresa"
- SÍ usar: datos de {your_product}, problemas, métricas, urgencia
- Tuteo ("tú") siempre
- Sin emojis salvo que encajen muy naturalmente
- Responde ÚNICAMENTE con JSON válido`,
      },
      {
        role: 'user',
        content: `Genera la secuencia de 3 mensajes para este lead.

DATOS DEL LEAD:
- {name}: ${lead.name}
- {company}: ${lead.company || 'No especificada'}
- {role}: ${lead.title || 'No especificado'}
- {sector}: ${lead.industry || 'No especificado'}
- {your_product}: ${product}${snippetSection}

Devuelve este JSON exacto:
{
  "sequence_1": { "text": "...", "confidence": 0.0 },
  "sequence_2": { "text": "...", "confidence": 0.0 },
  "sequence_3": { "text": "...", "confidence": 0.0 }
}

confidence: 0.0–1.0 según qué tan personalizado y efectivo es el mensaje.
Penaliza −0.08 si no tienes contexto de perfil disponible.`,
      },
    ],
  })

  const raw = response.choices[0].message.content ?? '{}'
  const parsed = JSON.parse(raw) as {
    sequence_1: { text: string; confidence: number }
    sequence_2: { text: string; confidence: number }
    sequence_3: { text: string; confidence: number }
  }

  const drafts = [
    { draft_id: 1, sequence: 1 as const, text: parsed.sequence_1?.text ?? '', confidence: normalizeConfidence(parsed.sequence_1?.confidence) },
    { draft_id: 2, sequence: 2 as const, text: parsed.sequence_2?.text ?? '', confidence: normalizeConfidence(parsed.sequence_2?.confidence) },
    { draft_id: 3, sequence: 3 as const, text: parsed.sequence_3?.text ?? '', confidence: normalizeConfidence(parsed.sequence_3?.confidence) },
  ]

  const usage = calcUsage(
    response.usage?.prompt_tokens ?? 0,
    response.usage?.completion_tokens ?? 0
  )

  return { drafts, usage }
}
