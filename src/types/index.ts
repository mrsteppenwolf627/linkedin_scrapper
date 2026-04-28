// ============================================
// LinkedIn Scraper V1 - Tipos compartidos
// ============================================

// --- Filtros de búsqueda ---
export interface SearchFilters {
  jobTitle: string
  experience: string
  industry: string
  location: string
  maxResults?: number
}

// --- Resultado de Google Search ---
export interface GoogleSearchResult {
  title: string
  link: string
  snippet: string
}

// --- Contacto parseado por Claude ---
export interface ParsedContact {
  nombre: string | null
  titulo: string | null
  empresa: string | null
  ubicacion: string | null
  anos_experiencia: number | null
  palabras_clave_encontradas: string[]
  score_confianza: number
  es_valido: boolean
  notas: string
}

// --- Contacto validado contra filtros ---
export interface ValidatedContact extends ParsedContact {
  is_valid: boolean
  razones_rechazo: string[]
  score_cumplimiento: number
}

// --- Resultado de dedup ---
export interface DuplicateCheckResult {
  isDuplicate: boolean
  existingContactId?: string
  duplicateConfidence?: number
}

// --- Resultado del orquestador ---
export interface SearchExecutionResult {
  search_id: string
  total_processed: number
  total_created: number
  total_duplicates: number
  total_invalid: number
  results: ContactRecord[]
}

// --- Registros de BD (lo que devuelve Supabase) ---
export interface SearchRecord {
  id: string
  created_at: string
  updated_at: string
  name: string
  description?: string
  filters: SearchFilters
  google_query: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused'
  error_message?: string
  total_results_google: number
  total_results_processed: number
  total_contacts_created: number
  total_duplicates_found: number
  total_invalid: number
  notes?: string
}

export interface ContactRecord {
  id: string
  created_at: string
  updated_at: string
  linkedin_url: string
  email?: string
  name: string
  job_title?: string
  company?: string
  location?: string
  headline?: string
  years_experience?: number
  is_valid: boolean
  validation_notes?: string
  confidence_score: number
  matching_keywords?: { matches: string[]; count: number }
  search_id: string
  status: 'new' | 'contacted' | 'converted' | 'skipped' | 'bounced'
  contact_notes?: string
  is_duplicate: boolean
  duplicate_of_id?: string
  duplicate_confidence?: number
  raw_google_snippet?: string
  raw_parsed_data?: ParsedContact
  raw_validation_result?: ValidatedContact
}

// --- Message Generator ---
export interface LeadInput {
  name: string
  title: string
  company: string
  industry: string
  location: string
  linkedin_url: string
  profile_snippet?: string
  your_product?: string  // Required for single endpoint; omitted in batch mode
}

// --- Lead Profile Enrichment (Phase 1 of pipeline) ---
export type DecisionMakerLevel = 'executive' | 'manager' | 'specialist'
export type CompanySize = 'small' | 'mid' | 'enterprise'
export type MessageStrategy = 'hook' | 'social_proof' | 'urgency'

export interface LeadProfile {
  likely_pain_points: string[]
  decision_maker_level: DecisionMakerLevel
  likely_priorities: string[]
  company_size: CompanySize
  sector_keywords: string[]
  role_psychology: string
}

// --- Humanized Message (Phase 3 of pipeline) ---
export interface HumanizedMessage {
  original: string
  humanized: string
  changes_made: string[]
  ai_score_before: number
  ai_score_after: number
  confidence: number
}

export type MessageSequence = 1 | 2 | 3

export interface MessageDraft {
  draft_id: number
  sequence: MessageSequence
  text: string
  confidence: number
  strategy?: MessageStrategy
  ai_detector_risk?: number
}

export interface TokenUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  estimated_cost_usd: number
}

export interface GenerateMessagesResponse {
  drafts: MessageDraft[]
  usage: TokenUsage
}

// API response includes the persisted lead_id from Supabase
export interface GenerateMessagesApiResponse {
  lead_id: string
  drafts: MessageDraft[]
}

export interface GenerateMessagesRequestBody extends LeadInput {
  lead_id?: string // Optional: future use — link to an existing lead record
}

// --- Batch Message Generation ---

export interface BatchGenerateRequestBody {
  search_id: string
  your_product?: string
}

export interface BatchItemResult {
  contact_id: string
  contact_name: string
  status: 'ok' | 'failed'
  lead_id?: string
  error?: string
  usage?: TokenUsage
}

export interface BatchGenerateResult {
  search_id: string
  total_contacts: number
  processed: number
  failed: number
  cost_total_usd: number
  time_ms: number
  items: BatchItemResult[]
}

// --- Respuestas API ---
export interface ApiError {
  error: string
  message: string
}

export interface SearchStartedResponse {
  search_id: string
  status: 'running'
  message: string
}

export interface ContactsListResponse {
  contacts: ContactRecord[]
  total: number
  page: number
  page_size: number
}

export interface SearchesListResponse {
  searches: SearchRecord[]
  total: number
}

export interface StatusResponse {
  search: SearchRecord
  contacts_count: number
}
