-- Camada externa: separa keywords internas (cadastradas manualmente/por produto)
-- de keywords externas (importadas de Google Keyword Planner, Trends, SEMrush, etc.)

ALTER TABLE market_keywords
  ADD COLUMN IF NOT EXISTS camada TEXT NOT NULL DEFAULT 'interna'
    CHECK (camada IN ('interna', 'externa')),
  ADD COLUMN IF NOT EXISTS trend_score      INT,        -- índice de tendência 0-100 (Google Trends)
  ADD COLUMN IF NOT EXISTS variacao_yoy     INT,        -- variação ano a ano em %
  ADD COLUMN IF NOT EXISTS variacao_3m      INT,        -- variação 3 meses em %
  ADD COLUMN IF NOT EXISTS competicao       TEXT        -- 'baixa' | 'media' | 'alta'
    CHECK (competicao IN ('baixa', 'media', 'alta', null)),
  ADD COLUMN IF NOT EXISTS cpc_max          NUMERIC(8,2); -- lance máximo estimado

-- Índice para filtrar por camada
CREATE INDEX IF NOT EXISTS idx_market_keywords_camada ON market_keywords (camada);

COMMENT ON COLUMN market_keywords.camada IS
  'interna = cadastrada pela equipe Pousinox / externa = importada de ferramentas Google/SEMrush';
