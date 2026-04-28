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
  LeadProfile,
  HumanizedMessage,
  MessageDraft,
  MessageStrategy,
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

// Modelo para parsing/validación/enriquecimiento/humanización (rápido y barato)
const MODEL = 'gpt-4o-mini'
// Modelo para generación de mensajes (calidad máxima — upgrade a gpt-4o si es necesario)
const MODEL_MESSAGES = 'gpt-4o-mini'

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
// PROMPT A: enrich_lead_profile_v1
// Fase 1: Extrae insights de venta del perfil del lead
// ============================================

export async function enrichLeadProfile(
  name: string,
  title: string,
  company: string,
  industry: string,
  location: string
): Promise<LeadProfile> {
  const openai = getOpenAI()

  const response = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: 400,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `Eres un analista de ventas B2B senior. Analizas perfiles de LinkedIn para extraer insights accionables que ayuden a personalizar mensajes de cold outreach. Eres específico, no genérico. Piensas como un vendedor de alto rendimiento: qué duele, qué motiva, qué presupuesto manejan. Responde siempre con JSON válido.`,
      },
      {
        role: 'user',
        content: `Analiza este perfil y devuelve insights de venta:

PERFIL:
- Nombre: ${name}
- Título: ${title}
- Empresa: ${company}
- Sector: ${industry}
- Ubicación: ${location}

Devuelve exactamente este JSON:
{
  "likely_pain_points": ["pain1", "pain2", "pain3"],
  "decision_maker_level": "executive" | "manager" | "specialist",
  "likely_priorities": ["priority1", "priority2"],
  "company_size": "small" | "mid" | "enterprise",
  "sector_keywords": ["keyword1", "keyword2", "keyword3"],
  "role_psychology": "Una frase describiendo qué motiva y presiona a esta persona en su rol"
}

Reglas:
- Basa TODO en datos reales del perfil. NUNCA inventar datos sin fundamento.
- decision_maker_level: "executive" si tiene C-level/VP/Director; "manager" si lidera equipo; "specialist" si es individual contributor
- company_size: "enterprise" si es multinacional/gran empresa; "mid" si es mediana empresa; "small" si es startup/pyme
- sector_keywords: términos técnicos/de negocio propios de su sector
- role_psychology: qué le quita el sueño y qué quiere conseguir en su rol`,
      },
    ],
  })

  const text = response.choices[0].message.content ?? '{}'
  return JSON.parse(text) as LeadProfile
}

// ============================================
// PROMPT B: generate_linkedin_messages_v4
// Fase 2: Generación con estrategia de vendedor experto + anti-IA
// ============================================

export async function generateLinkedInMessages(
  lead: LeadInput,
  profile?: LeadProfile
): Promise<GenerateMessagesResponse> {
  const openai = getOpenAI()

  const product = lead.your_product?.trim() || 'Tu Producto/Servicio'

  const snippetSection = lead.profile_snippet?.trim()
    ? `\nCONTEXTO DEL PERFIL: "${lead.profile_snippet}"`
    : ''

  const profileSection = profile
    ? `
PERFIL ENRIQUECIDO:
- Pain points probables: ${profile.likely_pain_points.join(', ')}
- Nivel de decisión: ${profile.decision_maker_level}
- Prioridades: ${profile.likely_priorities.join(', ')}
- Tamaño empresa: ${profile.company_size}
- Keywords del sector: ${profile.sector_keywords.join(', ')}
- Psicología del rol: ${profile.role_psychology}`
    : ''

  const response = await openai.chat.completions.create({
    model: MODEL_MESSAGES,
    max_tokens: 1500,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `Eres un vendedor B2B de élite con 15+ años cerrando deals de 6-7 figuras en cold outreach. Conoces psicología de ventas en profundidad, detectas patrones IA y los evitas instintivamente, y escribes como vendedor de verdad, no como chatbot.

MISIÓN: Generar 3 mensajes LinkedIn que hagan que el lead TENGA QUE responder.

RESTRICCIONES ABSOLUTAS (no negociables):
1. Máx 280 caracteres por mensaje — cuenta siempre antes de entregar
2. Tuteo ("tú", "tu") — más cercano y natural
3. Sin emojis salvo que encajen orgánicamente (máx 1 en toda la secuencia)
4. Sin listas con viñetas, sin markdown, sin asteriscos
5. Sin frases IA: "espero que estés bien", "quería contactarte", "como experto", "además", "por otra parte", "en conclusión"
6. Sin exclamaciones excesivas (máx 1 si es muy necesaria)
7. Lenguaje profesional pero humano — no robótico, no demasiado informal

TÉCNICAS ANTI-IA (aplicar obligatoriamente en cada mensaje):
- Asimetría: mezcla frases cortas y largas (no todas igual de largas)
- Especificidad: menciona datos reales del perfil (nombre, empresa, sector, rol)
- Imperfecciones controladas: puntos suspensivos si hay duda, pregunta al final
- Voz personal: como si lo escribiera un vendedor real, no un template
- Puntuación variada: no todas las frases perfectamente construidas
- Transiciones directas: nada de "además", "por lo tanto", "en conclusión"

ESTRATEGIA POR MENSAJE:
[1 - hook] Pattern interrupt, problema del sector o estadística inesperada. No empieces con "Hola".
[2 - social_proof] Ángulo diferente al primero, caso similar, observación específica de su perfil.
[3 - urgency] "Voy a ser directo" — beneficio claro, cierre educado sin presión, decisión en manos del lead.

Responde ÚNICAMENTE con JSON válido.`,
      },
      {
        role: 'user',
        content: `Genera la secuencia de 3 mensajes para este lead.

DATOS DEL LEAD:
- Nombre: ${lead.name}
- Título: ${lead.title || 'No especificado'}
- Empresa: ${lead.company || 'No especificada'}
- Sector: ${lead.industry || 'No especificado'}
- Ubicación: ${lead.location || 'No especificada'}${snippetSection}${profileSection}

TU PRODUCTO/SERVICIO:
${product}

INSTRUCCIONES ESPECÍFICAS:

[MENSAJE 1 - hook]
Rompe la atención con un problema del sector o dato inesperado.
Conecta con tu producto de forma no obvia. No vendas — genera curiosidad.
No empieces con "Hola ${lead.name}," genérico. Empieza con el hook directamente.

[MENSAJE 2 - social_proof]
Ángulo completamente diferente al mensaje 1 (no repitas el mismo argumento).
Haz una observación específica del perfil/empresa del lead.
Menciona un caso similar que resolviste (sin revelar todo).
Termina con pregunta o propuesta concreta (¿10 min?).

[MENSAJE 3 - urgency]
"Voy a ser directo:" — honestidad sin presión.
Menciona cambios en el sector que hacen urgente actuar.
Beneficio claro y directo. Cierre: decisión en manos del lead.

CHECKLIST (verifica antes de responder):
☐ ¿Cada mensaje ≤280 caracteres? (cuenta y recorta si no)
☐ ¿Menciona datos reales del perfil (nombre, empresa o sector)?
☐ ¿Parece escrito por un vendedor humano? (no IA)
☐ ¿Estrategia diferente en cada mensaje?
☐ ¿Sin frases genéricas de IA?

Devuelve exactamente este JSON:
{
  "sequence_1": { "text": "...", "strategy": "hook", "ai_detector_risk": 0.0, "confidence": 0.0 },
  "sequence_2": { "text": "...", "strategy": "social_proof", "ai_detector_risk": 0.0, "confidence": 0.0 },
  "sequence_3": { "text": "...", "strategy": "urgency", "ai_detector_risk": 0.0, "confidence": 0.0 }
}

ai_detector_risk: 0.0–1.0 (probabilidad de detección como IA; meta < 0.20)
confidence: 0.0–1.0 (qué tan personalizado y efectivo es el mensaje; penaliza −0.08 si sin datos de perfil)`,
      },
    ],
  })

  const raw = response.choices[0].message.content ?? '{}'
  const parsed = JSON.parse(raw) as {
    sequence_1: { text: string; strategy: string; ai_detector_risk: number; confidence: number }
    sequence_2: { text: string; strategy: string; ai_detector_risk: number; confidence: number }
    sequence_3: { text: string; strategy: string; ai_detector_risk: number; confidence: number }
  }

  const drafts: MessageDraft[] = [
    {
      draft_id: 1,
      sequence: 1,
      text: parsed.sequence_1?.text ?? '',
      confidence: normalizeConfidence(parsed.sequence_1?.confidence),
      strategy: (parsed.sequence_1?.strategy as MessageStrategy) ?? 'hook',
      ai_detector_risk: parsed.sequence_1?.ai_detector_risk ?? 0,
    },
    {
      draft_id: 2,
      sequence: 2,
      text: parsed.sequence_2?.text ?? '',
      confidence: normalizeConfidence(parsed.sequence_2?.confidence),
      strategy: (parsed.sequence_2?.strategy as MessageStrategy) ?? 'social_proof',
      ai_detector_risk: parsed.sequence_2?.ai_detector_risk ?? 0,
    },
    {
      draft_id: 3,
      sequence: 3,
      text: parsed.sequence_3?.text ?? '',
      confidence: normalizeConfidence(parsed.sequence_3?.confidence),
      strategy: (parsed.sequence_3?.strategy as MessageStrategy) ?? 'urgency',
      ai_detector_risk: parsed.sequence_3?.ai_detector_risk ?? 0,
    },
  ]

  const usage = calcUsage(
    response.usage?.prompt_tokens ?? 0,
    response.usage?.completion_tokens ?? 0
  )

  return { drafts, usage }
}

// ============================================
// PROMPT C: humanize_message_v1
// Fase 3: Post-procesamiento para reducir AI detection score
// Solo se llama cuando ai_detector_risk > 0.30
// ============================================

export async function humanizeMessage(text: string): Promise<HumanizedMessage> {
  const openai = getOpenAI()

  const response = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: 500,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `Eres editor de copywriting experto en cold outreach. Tu trabajo: hacer que un mensaje generado por IA parezca escrito por un vendedor humano de verdad. Sin perder el hook ni la estrategia del original. Sin superar 280 caracteres. Responde siempre con JSON válido.`,
      },
      {
        role: 'user',
        content: `Humaniza este mensaje LinkedIn para reducir su detección como IA:

MENSAJE: "${text}"

Analiza y corrige:
1. Palabras o frases que suenan robóticas o genéricas
2. Estructura demasiado perfecta (todas las frases igual de largas)
3. Transiciones explícitas de IA ("además", "por lo tanto", "en conclusión")
4. Falta de especificidad o imperfecciones naturales

Devuelve exactamente este JSON:
{
  "original": "${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}",
  "humanized": "...",
  "changes_made": ["cambio 1", "cambio 2"],
  "ai_score_before": 0.0,
  "ai_score_after": 0.0,
  "confidence": 0.0
}

Reglas:
- humanized ≤ 280 caracteres (obligatorio)
- Preserva el hook y la estrategia del original
- ai_score_after debe ser < 0.20
- Solo haz cambios que reduzcan detección IA (no reescribas sin razón)
- Añade asimetría: frases de longitud variada, pregunta al final, puntos suspensivos si encajan`,
      },
    ],
  })

  const raw = response.choices[0].message.content ?? '{}'
  return JSON.parse(raw) as HumanizedMessage
}

// ============================================
// PIPELINE: enrich → generate → humanize
// Orquestador completo de generación de mensajes (v4)
// ============================================

const AI_RISK_HUMANIZE_THRESHOLD = 0.30

export async function generateMessagesWithPipeline(
  lead: LeadInput
): Promise<GenerateMessagesResponse> {
  // Fase 1: Enriquecer perfil del lead
  const profile = await enrichLeadProfile(
    lead.name,
    lead.title,
    lead.company,
    lead.industry,
    lead.location
  )

  // Fase 2: Generar mensajes con perfil enriquecido
  const { drafts, usage } = await generateLinkedInMessages(lead, profile)

  // Fase 3: Humanizar mensajes con alto riesgo de detección IA
  const finalDrafts = await Promise.all(
    drafts.map(async (draft) => {
      if ((draft.ai_detector_risk ?? 0) > AI_RISK_HUMANIZE_THRESHOLD) {
        try {
          const result = await humanizeMessage(draft.text)
          return {
            ...draft,
            text: result.humanized || draft.text,
            ai_detector_risk: result.ai_score_after,
          }
        } catch {
          return draft
        }
      }
      return draft
    })
  )

  return { drafts: finalDrafts, usage }
}
