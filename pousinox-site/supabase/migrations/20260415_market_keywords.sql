-- Tabela de inteligência de busca regional para Estudo de Mercado
CREATE TABLE IF NOT EXISTS market_keywords (
  id              BIGSERIAL PRIMARY KEY,
  termo           TEXT NOT NULL,
  cluster         TEXT,                          -- ex: 'fixador porcelanato', 'bancada inox'
  uf              TEXT,
  mesorregiao     TEXT,
  cidade          TEXT,
  segmento        TEXT,                          -- ex: 'hospitalar', 'food service'
  familia_produto TEXT,                          -- ex: 'fixador', 'bancada', 'coifa'
  volume_mensal   INT DEFAULT 0,                 -- buscas/mês estimadas
  cpc_estimado    NUMERIC(8,2),
  intencao        TEXT CHECK (intencao IN ('comercial','informacional','transacional','navegacional')) DEFAULT 'comercial',
  fonte           TEXT DEFAULT 'manual',         -- 'manual', 'csv', 'google_ads', 'semrush'
  periodo         DATE,                          -- mês de referência
  ativo           BOOLEAN DEFAULT true,
  criado_em       TIMESTAMPTZ DEFAULT now(),
  atualizado_em   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_market_keywords_uf ON market_keywords (uf);
CREATE INDEX idx_market_keywords_mesorregiao ON market_keywords (mesorregiao);
CREATE INDEX idx_market_keywords_cluster ON market_keywords (cluster);
CREATE INDEX idx_market_keywords_segmento ON market_keywords (segmento);

ALTER TABLE market_keywords ENABLE ROW LEVEL SECURITY;
CREATE POLICY market_keywords_service ON market_keywords USING (auth.role() = 'service_role');

-- Trigger updated_at
CREATE TRIGGER market_keywords_updated_at
  BEFORE UPDATE ON market_keywords
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
