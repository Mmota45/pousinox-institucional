ALTER TABLE pipeline_deals ADD COLUMN IF NOT EXISTS orcamento_id BIGINT REFERENCES orcamentos(id);
CREATE INDEX IF NOT EXISTS idx_pipeline_deals_orcamento_id ON pipeline_deals (orcamento_id);
