-- ============================================================================
-- Subsistema de Frete — orcamento_volumes, cotações, opções, parâmetros
-- ============================================================================

-- Enum de provedores
DO $$ BEGIN
  CREATE TYPE frete_provedor AS ENUM ('correios', 'braspress', 'proprio');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1. Volumes por orçamento
CREATE TABLE IF NOT EXISTS orcamento_volumes (
  id BIGSERIAL PRIMARY KEY,
  orcamento_id BIGINT NOT NULL REFERENCES orcamentos(id) ON DELETE CASCADE,
  descricao TEXT,
  quantidade INT NOT NULL DEFAULT 1,
  peso_kg NUMERIC(10,3) NOT NULL DEFAULT 0,
  comprimento_cm NUMERIC(8,2) NOT NULL DEFAULT 0,
  largura_cm NUMERIC(8,2) NOT NULL DEFAULT 0,
  altura_cm NUMERIC(8,2) NOT NULL DEFAULT 0,
  ordem INT NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orc_volumes_orcamento ON orcamento_volumes(orcamento_id);

ALTER TABLE orcamento_volumes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_orcamento_volumes" ON orcamento_volumes
  USING (auth.role() = 'service_role');

-- 2. Cotações de frete (cada tentativa de cotação)
CREATE TABLE IF NOT EXISTS orcamento_frete_cotacoes (
  id BIGSERIAL PRIMARY KEY,
  orcamento_id BIGINT NOT NULL REFERENCES orcamentos(id) ON DELETE CASCADE,
  provedor frete_provedor NOT NULL,
  cep_origem TEXT NOT NULL,
  cep_destino TEXT NOT NULL,
  peso_total_kg NUMERIC(10,3),
  peso_cubado_kg NUMERIC(10,3),
  peso_taxado_kg NUMERIC(10,3),
  valor_mercadoria NUMERIC(14,2),
  volumes_json JSONB,
  raw_request JSONB,
  raw_response JSONB,
  sucesso BOOLEAN NOT NULL DEFAULT true,
  erro TEXT,
  cotado_em TIMESTAMPTZ DEFAULT now(),
  cotado_por TEXT,
  valido_ate TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_orc_frete_cot_orcamento ON orcamento_frete_cotacoes(orcamento_id);

ALTER TABLE orcamento_frete_cotacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_orcamento_frete_cotacoes" ON orcamento_frete_cotacoes
  USING (auth.role() = 'service_role');

-- 3. Opções de frete (cada opção retornada por uma cotação)
CREATE TABLE IF NOT EXISTS orcamento_frete_opcoes (
  id BIGSERIAL PRIMARY KEY,
  cotacao_id BIGINT NOT NULL REFERENCES orcamento_frete_cotacoes(id) ON DELETE CASCADE,
  orcamento_id BIGINT NOT NULL REFERENCES orcamentos(id) ON DELETE CASCADE,
  provedor frete_provedor NOT NULL,
  servico TEXT NOT NULL,
  codigo TEXT,
  custo NUMERIC(14,2) NOT NULL DEFAULT 0,
  preco_venda NUMERIC(14,2) NOT NULL DEFAULT 0,
  margem_pct NUMERIC(6,2) GENERATED ALWAYS AS (
    CASE WHEN custo > 0 THEN ROUND((preco_venda - custo) / custo * 100, 2) ELSE 0 END
  ) STORED,
  prazo_dias INT,
  prazo_texto TEXT,
  componentes_json JSONB,
  selecionada BOOLEAN NOT NULL DEFAULT false,
  obs TEXT,
  criado_em TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orc_frete_opc_orcamento ON orcamento_frete_opcoes(orcamento_id);
CREATE INDEX IF NOT EXISTS idx_orc_frete_opc_cotacao ON orcamento_frete_opcoes(cotacao_id);

ALTER TABLE orcamento_frete_opcoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_orcamento_frete_opcoes" ON orcamento_frete_opcoes
  USING (auth.role() = 'service_role');

-- 4. Parâmetros de frete próprio (defaults da empresa)
CREATE TABLE IF NOT EXISTS frete_parametros (
  id BIGSERIAL PRIMARY KEY,
  chave TEXT NOT NULL UNIQUE,
  valor NUMERIC(14,4) NOT NULL DEFAULT 0,
  unidade TEXT,
  descricao TEXT,
  atualizado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_por TEXT
);

ALTER TABLE frete_parametros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_frete_parametros" ON frete_parametros
  USING (auth.role() = 'service_role');

-- Seed defaults
INSERT INTO frete_parametros (chave, valor, unidade, descricao) VALUES
  ('combustivel_km', 1.20, 'R$/km', 'Custo de combustível por km'),
  ('pedagio_medio_km', 0.15, 'R$/km', 'Custo médio de pedágio por km'),
  ('motorista_dia', 250.00, 'R$/dia', 'Diária do motorista'),
  ('ajudante_dia', 150.00, 'R$/dia', 'Diária do ajudante'),
  ('depreciacao_km', 0.30, 'R$/km', 'Depreciação do veículo por km'),
  ('manutencao_km', 0.20, 'R$/km', 'Custo de manutenção por km'),
  ('seguro_pct', 0.30, '%', 'Percentual de seguro sobre valor da mercadoria'),
  ('gris_pct', 0.10, '%', 'GRIS / Risco sobre valor da mercadoria'),
  ('administrativo_pct', 5.00, '%', 'Custo administrativo sobre custo total'),
  ('contingencia_pct', 3.00, '%', 'Contingência / imprevistos sobre custo total'),
  ('margem_pct', 15.00, '%', 'Margem de lucro sobre custo total')
ON CONFLICT (chave) DO NOTHING;

-- 5. Novas colunas denormalizadas no orcamentos (opção selecionada)
ALTER TABLE orcamentos
  ADD COLUMN IF NOT EXISTS frete_modalidade TEXT DEFAULT 'cobrar',
  ADD COLUMN IF NOT EXISTS frete_provedor TEXT,
  ADD COLUMN IF NOT EXISTS frete_servico TEXT,
  ADD COLUMN IF NOT EXISTS frete_custo NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS frete_preco_venda NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS frete_prazo_dias INT,
  ADD COLUMN IF NOT EXISTS frete_opcao_id BIGINT,
  ADD COLUMN IF NOT EXISTS peso_total_kg NUMERIC(10,3),
  ADD COLUMN IF NOT EXISTS volumes_qtd INT;
