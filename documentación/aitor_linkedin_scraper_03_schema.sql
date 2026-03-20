-- ============================================
-- LINKEDIN SCRAPER V1 - SCHEMA SUPABASE
-- ============================================

-- ============================================
-- 1. TABLA: SEARCHES (Campañas de búsqueda)
-- ============================================
CREATE TABLE searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Identidad
  name TEXT NOT NULL UNIQUE, -- ej: "energy_consultant_spain_v1"
  description TEXT,
  
  -- Configuración
  filters JSONB NOT NULL, -- {"sector": "energía", "years": 5, "keywords": [...]}
  google_query TEXT NOT NULL, -- La query exacta que se ejecutó
  
  -- Estado
  status TEXT DEFAULT 'pending', -- pending, running, completed, failed, paused
  error_message TEXT,
  
  -- Estadísticas
  total_results_google INT DEFAULT 0, -- Total de resultados devueltos por Google
  total_results_processed INT DEFAULT 0, -- Procesados por Claude
  total_contacts_created INT DEFAULT 0, -- Guardados en tabla contacts
  total_duplicates_found INT DEFAULT 0, -- Rechazados por duplicado
  total_invalid INT DEFAULT 0, -- Rechazados por validación
  
  -- Rastreabilidad
  user_id UUID, -- Futuro: para multi-user
  notes TEXT,
  
  INDEX idx_searches_status (status),
  INDEX idx_searches_created_at (created_at)
);

-- ============================================
-- 2. TABLA: CONTACTS (Contactos encontrados)
-- ============================================
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Identificadores únicos (para dedup)
  linkedin_url TEXT NOT NULL,
  email TEXT, -- Puede ser NULL si no se extrajo
  
  -- Datos extraídos del snippet
  name TEXT NOT NULL,
  job_title TEXT,
  company TEXT,
  location TEXT,
  headline TEXT, -- Headline completo de LinkedIn (si se pudo extraer)
  years_experience INT,
  
  -- Validación y scoring
  is_valid BOOLEAN DEFAULT TRUE,
  validation_notes TEXT, -- Razón si no es válido
  confidence_score NUMERIC(3,2) DEFAULT 0.00, -- 0.00 a 1.00
  
  -- Keywords que cumple
  matching_keywords JSONB, -- {"matches": ["consultor", "energía"], "count": 2}
  
  -- Relación con búsqueda
  search_id UUID NOT NULL REFERENCES searches(id) ON DELETE CASCADE,
  
  -- Prospección y seguimiento
  status TEXT DEFAULT 'new', -- new, contacted, converted, skipped, bounced
  contact_notes TEXT,
  contacted_at TIMESTAMP,
  converted_at TIMESTAMP,
  
  -- Raw data para auditoría
  raw_google_snippet TEXT, -- El snippet exacto de Google
  raw_parsed_data JSONB, -- Output de Claude parsing
  raw_validation_result JSONB, -- Output de Claude validación
  
  -- Dedup control
  is_duplicate BOOLEAN DEFAULT FALSE,
  duplicate_of_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  duplicate_confidence NUMERIC(3,2),
  
  CONSTRAINT unique_linkedin_url UNIQUE(linkedin_url),
  CONSTRAINT email_if_not_null CHECK(email IS NULL OR email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$'),
  
  INDEX idx_contacts_search_id (search_id),
  INDEX idx_contacts_linkedin_url (linkedin_url),
  INDEX idx_contacts_email (email),
  INDEX idx_contacts_status (status),
  INDEX idx_contacts_is_valid (is_valid),
  INDEX idx_contacts_created_at (created_at),
  INDEX idx_contacts_is_duplicate (is_duplicate)
);

-- ============================================
-- 3. TABLA: CONTACTS_HISTORY (Auditoría)
-- ============================================
CREATE TABLE contacts_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP DEFAULT NOW(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  
  -- Qué cambió
  action TEXT NOT NULL, -- created, updated_status, contacted, converted, etc
  old_value JSONB,
  new_value JSONB,
  notes TEXT,
  
  INDEX idx_history_contact_id (contact_id),
  INDEX idx_history_created_at (created_at)
);

-- ============================================
-- 4. VISTA: UNIQUE_CONTACTS (Dedup)
-- ============================================
-- Devuelve solo contactos únicos por LinkedIn URL
-- (el más reciente si hay múltiples)
CREATE VIEW unique_contacts AS
SELECT DISTINCT ON (linkedin_url) 
  c.*
FROM contacts c
WHERE c.is_duplicate = FALSE
ORDER BY linkedin_url, c.created_at DESC;

-- ============================================
-- 5. VISTA: SEARCH_STATS (Estadísticas)
-- ============================================
CREATE VIEW search_stats AS
SELECT
  s.id,
  s.name,
  s.status,
  COUNT(c.id) as total_contacts,
  COUNT(CASE WHEN c.is_valid THEN 1 END) as valid_contacts,
  COUNT(CASE WHEN c.is_duplicate THEN 1 END) as duplicate_count,
  COUNT(CASE WHEN c.status = 'contacted' THEN 1 END) as contacted_count,
  COUNT(CASE WHEN c.status = 'converted' THEN 1 END) as converted_count,
  AVG(c.confidence_score) as avg_confidence,
  s.created_at,
  s.updated_at
FROM searches s
LEFT JOIN contacts c ON s.id = c.search_id
GROUP BY s.id, s.name, s.status, s.created_at, s.updated_at;

-- ============================================
-- 6. TABLA: API_LOGS (Observabilidad)
-- ============================================
CREATE TABLE api_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Request info
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL, -- GET, POST, PUT, DELETE
  status_code INT,
  
  -- Contenido
  request_body JSONB,
  response_body JSONB,
  error_message TEXT,
  
  -- Duración
  duration_ms INT,
  
  -- Rastreabilidad
  search_id UUID REFERENCES searches(id) ON DELETE SET NULL,
  user_id UUID,
  
  INDEX idx_logs_created_at (created_at),
  INDEX idx_logs_endpoint (endpoint),
  INDEX idx_logs_status_code (status_code)
);

-- ============================================
-- 7. TABLA: COST_TRACKING (Control de costes)
-- ============================================
CREATE TABLE cost_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Qué API se usó
  service TEXT NOT NULL, -- google_search, claude_api, supabase, vercel
  operation TEXT NOT NULL, -- search_query, parsing, storage, etc
  
  -- Coste
  units INT, -- Ej: número de queries, tokens, etc
  unit_cost NUMERIC(10,6), -- Costo por unidad
  total_cost NUMERIC(10,4),
  currency TEXT DEFAULT 'EUR',
  
  -- Relación
  search_id UUID REFERENCES searches(id) ON DELETE SET NULL,
  
  INDEX idx_cost_service (service),
  INDEX idx_cost_created_at (created_at)
);

-- ============================================
-- ÍNDICES ADICIONALES PARA PERFORMANCE
-- ============================================

CREATE INDEX idx_contacts_name_trgm ON contacts USING gin(name gin_trgm_ops);
CREATE INDEX idx_contacts_company_trgm ON contacts USING gin(company gin_trgm_ops);
CREATE INDEX idx_contacts_updated_at ON contacts(updated_at DESC);
CREATE INDEX idx_searches_name_trgm ON searches USING gin(name gin_trgm_ops);

-- ============================================
-- POLÍTICAS RLS (Row Level Security)
-- ============================================
-- TODO: Añadir cuando haya multi-user
-- ALTER TABLE searches ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- ============================================
-- TRIGGERS PARA AUDITORÍA
-- ============================================

-- Trigger: Actualizar updated_at en searches
CREATE OR REPLACE FUNCTION update_searches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER searches_updated_at_trigger
BEFORE UPDATE ON searches
FOR EACH ROW
EXECUTE FUNCTION update_searches_updated_at();

-- Trigger: Actualizar updated_at en contacts
CREATE OR REPLACE FUNCTION update_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contacts_updated_at_trigger
BEFORE UPDATE ON contacts
FOR EACH ROW
EXECUTE FUNCTION update_contacts_updated_at();

-- Trigger: Crear entrada en history cuando cambias status
CREATE OR REPLACE FUNCTION log_contact_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO contacts_history (contact_id, action, old_value, new_value)
    VALUES (NEW.id, 'status_change', jsonb_build_object('status', OLD.status), jsonb_build_object('status', NEW.status));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contact_status_change_trigger
AFTER UPDATE ON contacts
FOR EACH ROW
EXECUTE FUNCTION log_contact_status_change();

-- ============================================
-- DATOS INICIALES (Opcional)
-- ============================================
-- INSERT INTO searches (name, description, filters, google_query, status)
-- VALUES (
--   'test_energy_consultants_spain',
--   'Búsqueda piloto: consultores energéticos con 5+ años en España',
--   '{"sector": "energía", "years": 5, "keywords": ["consultor", "consultoría", "solar"]}',
--   'site:linkedin.com/in (consultor OR consultant) (energía OR energy OR solar) (5+ años OR 5+ years) España',
--   'pending'
-- );
