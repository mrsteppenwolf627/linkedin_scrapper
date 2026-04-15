-- ============================================
-- MIGRATION: Replace tone (enum text) with sequence (int 1-3)
-- Rationale: messages are now a 3-step sequence, not 3 style variants
-- ============================================

ALTER TABLE message_drafts DROP COLUMN tone;
ALTER TABLE message_drafts ADD COLUMN sequence INT NOT NULL DEFAULT 1 CHECK (sequence IN (1, 2, 3));
DROP INDEX IF EXISTS idx_drafts_tone;
CREATE INDEX idx_drafts_sequence ON message_drafts(sequence);
