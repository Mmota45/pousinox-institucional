-- Coluna para rastrear última atualização via BrasilAPI
ALTER TABLE prospeccao ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ;

-- Índice para buscar prospects desatualizados (cron de enriquecimento)
CREATE INDEX IF NOT EXISTS idx_prospeccao_atualizado_em ON prospeccao (atualizado_em NULLS FIRST);
