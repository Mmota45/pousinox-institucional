ALTER TABLE orcamento_links ADD COLUMN IF NOT EXISTS short_code TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_orcamento_links_short_code ON orcamento_links (short_code);
