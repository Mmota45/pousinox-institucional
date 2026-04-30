-- ══════════════════════════════════════════════════════════════════
-- Normas regulatórias vinculadas ao portfólio de produtos inox
-- Argumentação de venda baseada em compliance
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS portfolio_normas (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  norma TEXT NOT NULL,                    -- ex: "RDC 216/2004"
  orgao TEXT NOT NULL DEFAULT 'ANVISA',   -- ANVISA, MAPA, CVS, ABNT, Bombeiros
  titulo TEXT,                            -- "Boas Práticas para Serviços de Alimentação"
  status TEXT DEFAULT 'vigente',          -- vigente | revogada | atualizada
  substituida_por TEXT,                   -- norma que substituiu (se aplicável)
  segmentos TEXT[] NOT NULL DEFAULT '{}', -- segmentos que a norma abrange
  penalidade TEXT,                        -- "Multa + interdição"
  observacao TEXT,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now(),
  UNIQUE(norma)
);

-- Exigências específicas de cada norma → produto inox
CREATE TABLE IF NOT EXISTS portfolio_norma_exigencias (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  norma_id BIGINT REFERENCES portfolio_normas(id) ON DELETE CASCADE,
  artigo TEXT,                            -- "Art. 4.1.1"
  texto_resumido TEXT NOT NULL,           -- resumo da exigência
  produto_id BIGINT REFERENCES portfolio_produtos(id) ON DELETE SET NULL, -- produto inox relacionado
  criado_em TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_portfolio_normas_segmentos ON portfolio_normas USING GIN(segmentos);
CREATE INDEX IF NOT EXISTS idx_norma_exigencias_norma ON portfolio_norma_exigencias(norma_id);

-- RLS
ALTER TABLE portfolio_normas ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_norma_exigencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_portfolio_normas ON portfolio_normas;
CREATE POLICY admin_portfolio_normas ON portfolio_normas USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS admin_norma_exigencias ON portfolio_norma_exigencias;
CREATE POLICY admin_norma_exigencias ON portfolio_norma_exigencias USING (auth.role() = 'service_role');

CREATE TRIGGER set_portfolio_normas_updated_at
  BEFORE UPDATE ON portfolio_normas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
