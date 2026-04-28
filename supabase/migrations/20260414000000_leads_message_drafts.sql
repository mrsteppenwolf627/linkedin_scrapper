-- ============================================
-- MIGRATION: leads + message_drafts
-- Sprint 1-2: Message Generator
-- ============================================

-- ============================================
-- 1. TABLA: LEADS
-- ============================================
CREATE TABLE leads (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   TIMESTAMP   DEFAULT NOW(),

  search_id    UUID        REFERENCES searches(id) ON DELETE SET NULL,

  name         TEXT        NOT NULL,
  title        TEXT,
  company      TEXT,
  industry     TEXT,
  location     TEXT,
  linkedin_url TEXT        NOT NULL,

  your_product TEXT
);

CREATE INDEX idx_leads_search_id    ON leads(search_id);
CREATE INDEX idx_leads_linkedin_url ON leads(linkedin_url);
CREATE INDEX idx_leads_created_at   ON leads(created_at);

-- ============================================
-- 2. TABLA: MESSAGE_DRAFTS
-- ============================================
CREATE TABLE message_drafts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMP   DEFAULT NOW(),

  lead_id     UUID        NOT NULL REFERENCES leads(id) ON DELETE CASCADE,

  tone        TEXT        NOT NULL CHECK (tone IN ('direct', 'consultative', 'value_first')),
  draft_text  TEXT        NOT NULL,
  confidence  NUMERIC(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),

  is_selected BOOLEAN     DEFAULT FALSE,
  sent_at     TIMESTAMP
);

CREATE INDEX idx_drafts_lead_id    ON message_drafts(lead_id);
CREATE INDEX idx_drafts_tone       ON message_drafts(tone);
CREATE INDEX idx_drafts_created_at ON message_drafts(created_at);
