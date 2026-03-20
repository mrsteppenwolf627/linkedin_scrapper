-- ============================================
-- LINKEDIN SCRAPER V1 - SCHEMA SUPABASE (corregido)
-- Usar este archivo, NO el original
-- Los INDEX van fuera del CREATE TABLE (sintaxis PostgreSQL)
-- ============================================

-- Extensión necesaria para búsqueda fuzzy por nombre/empresa
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================
-- 1. TABLA: SEARCHES
-- ============================================
CREATE TABLE searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  filters JSONB NOT NULL,
  google_query TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  total_results_google INT DEFAULT 0,
  total_results_processed INT DEFAULT 0,
  total_contacts_created INT DEFAULT 0,
  total_duplicates_found INT DEFAULT 0,
  total_invalid INT DEFAULT 0,
  user_id UUID,
  notes TEXT
);

CREATE INDEX idx_searches_status ON searches(status);
CREATE INDEX idx_searches_created_at ON searches(created_at);
CREATE INDEX idx_searches_name_trgm ON searches USING gin(name gin_trgm_ops);

-- ============================================
-- 2. TABLA: CONTACTS
-- ============================================
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  linkedin_url TEXT NOT NULL,
  email TEXT,
  name TEXT NOT NULL,
  job_title TEXT,
  company TEXT,
  location TEXT,
  headline TEXT,
  years_experience INT,
  is_valid BOOLEAN DEFAULT TRUE,
  validation_notes TEXT,
  confidence_score NUMERIC(3,2) DEFAULT 0.00,
  matching_keywords JSONB,
  search_id UUID NOT NULL REFERENCES searches(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'new',
  contact_notes TEXT,
  contacted_at TIMESTAMP,
  converted_at TIMESTAMP,
  raw_google_snippet TEXT,
  raw_parsed_data JSONB,
  raw_validation_result JSONB,
  is_duplicate BOOLEAN DEFAULT FALSE,
  duplicate_of_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  duplicate_confidence NUMERIC(3,2),

  CONSTRAINT unique_linkedin_url UNIQUE(linkedin_url),
  CONSTRAINT email_if_not_null CHECK(
    email IS NULL OR email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  )
);

CREATE INDEX idx_contacts_search_id ON contacts(search_id);
CREATE INDEX idx_contacts_linkedin_url ON contacts(linkedin_url);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_status ON contacts(status);
CREATE INDEX idx_contacts_is_valid ON contacts(is_valid);
CREATE INDEX idx_contacts_created_at ON contacts(created_at);
CREATE INDEX idx_contacts_is_duplicate ON contacts(is_duplicate);
CREATE INDEX idx_contacts_updated_at ON contacts(updated_at DESC);
CREATE INDEX idx_contacts_name_trgm ON contacts USING gin(name gin_trgm_ops);
CREATE INDEX idx_contacts_company_trgm ON contacts USING gin(company gin_trgm_ops);

-- ============================================
-- 3. TABLA: CONTACTS_HISTORY
-- ============================================
CREATE TABLE contacts_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP DEFAULT NOW(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  notes TEXT
);

CREATE INDEX idx_history_contact_id ON contacts_history(contact_id);
CREATE INDEX idx_history_created_at ON contacts_history(created_at);

-- ============================================
-- 4. TABLA: API_LOGS
-- ============================================
CREATE TABLE api_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP DEFAULT NOW(),
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INT,
  request_body JSONB,
  response_body JSONB,
  error_message TEXT,
  duration_ms INT,
  search_id UUID REFERENCES searches(id) ON DELETE SET NULL,
  user_id UUID
);

CREATE INDEX idx_logs_created_at ON api_logs(created_at);
CREATE INDEX idx_logs_endpoint ON api_logs(endpoint);
CREATE INDEX idx_logs_status_code ON api_logs(status_code);

-- ============================================
-- 5. TABLA: COST_TRACKING
-- ============================================
CREATE TABLE cost_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP DEFAULT NOW(),
  service TEXT NOT NULL,
  operation TEXT NOT NULL,
  units INT,
  unit_cost NUMERIC(10,6),
  total_cost NUMERIC(10,4),
  currency TEXT DEFAULT 'EUR',
  search_id UUID REFERENCES searches(id) ON DELETE SET NULL
);

CREATE INDEX idx_cost_service ON cost_tracking(service);
CREATE INDEX idx_cost_created_at ON cost_tracking(created_at);

-- ============================================
-- 6. VISTA: UNIQUE_CONTACTS
-- ============================================
CREATE VIEW unique_contacts AS
SELECT DISTINCT ON (linkedin_url)
  c.*
FROM contacts c
WHERE c.is_duplicate = FALSE
ORDER BY linkedin_url, c.created_at DESC;

-- ============================================
-- 7. VISTA: SEARCH_STATS
-- ============================================
CREATE VIEW search_stats AS
SELECT
  s.id,
  s.name,
  s.status,
  COUNT(c.id) AS total_contacts,
  COUNT(CASE WHEN c.is_valid THEN 1 END) AS valid_contacts,
  COUNT(CASE WHEN c.is_duplicate THEN 1 END) AS duplicate_count,
  COUNT(CASE WHEN c.status = 'contacted' THEN 1 END) AS contacted_count,
  COUNT(CASE WHEN c.status = 'converted' THEN 1 END) AS converted_count,
  AVG(c.confidence_score) AS avg_confidence,
  s.created_at,
  s.updated_at
FROM searches s
LEFT JOIN contacts c ON s.id = c.search_id
GROUP BY s.id, s.name, s.status, s.created_at, s.updated_at;

-- ============================================
-- 8. TRIGGERS: updated_at automático
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER searches_updated_at_trigger
BEFORE UPDATE ON searches
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER contacts_updated_at_trigger
BEFORE UPDATE ON contacts
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 9. TRIGGER: Historial de cambios de status
-- ============================================
CREATE OR REPLACE FUNCTION log_contact_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO contacts_history (contact_id, action, old_value, new_value)
    VALUES (
      NEW.id,
      'status_change',
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contact_status_change_trigger
AFTER UPDATE ON contacts
FOR EACH ROW EXECUTE FUNCTION log_contact_status_change();
