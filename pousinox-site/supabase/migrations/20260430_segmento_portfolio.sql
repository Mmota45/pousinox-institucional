-- ══════════════════════════════════════════════════════════════════
-- Hub de Portfólio por Segmento
-- Mapeia produtos inox que cada segmento tipicamente demanda
-- ══════════════════════════════════════════════════════════════════

-- Catálogo de produtos inox da Pousinox
CREATE TABLE IF NOT EXISTS portfolio_produtos (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  categoria TEXT NOT NULL DEFAULT 'fabricacao', -- fabricacao | fixadores | acessorios
  foto_url TEXT,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

-- Mapeamento segmento → produtos
CREATE TABLE IF NOT EXISTS segmento_portfolio (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  segmento TEXT NOT NULL,
  produto_id BIGINT REFERENCES portfolio_produtos(id) ON DELETE CASCADE,
  relevancia INTEGER DEFAULT 5 CHECK (relevancia BETWEEN 1 AND 10), -- 10 = essencial, 1 = eventual
  destaque BOOLEAN DEFAULT false, -- produto principal para esse segmento
  criado_em TIMESTAMPTZ DEFAULT now(),
  UNIQUE(segmento, produto_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_segmento_portfolio_segmento ON segmento_portfolio(segmento);
CREATE INDEX IF NOT EXISTS idx_portfolio_produtos_categoria ON portfolio_produtos(categoria);

-- RLS
ALTER TABLE portfolio_produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE segmento_portfolio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_portfolio_produtos ON portfolio_produtos;
CREATE POLICY admin_portfolio_produtos ON portfolio_produtos USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS admin_segmento_portfolio ON segmento_portfolio;
CREATE POLICY admin_segmento_portfolio ON segmento_portfolio USING (auth.role() = 'service_role');

-- Trigger updated_at
CREATE TRIGGER set_portfolio_produtos_updated_at
  BEFORE UPDATE ON portfolio_produtos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
