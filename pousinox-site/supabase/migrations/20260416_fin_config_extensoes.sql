-- Migration: fin_config_extensoes
-- Extensões para configuração financeira:
-- 1. Subcategorias em fin_categorias (parent_id)
-- 2. Tabela de negócios (unidades de negócio / entidades)
-- 3. Tabela de formas de pagamento (com bandeira e modalidade para cartões)

-- ── 1. Subcategorias ──────────────────────────────────────────────────────────
ALTER TABLE fin_categorias
  ADD COLUMN IF NOT EXISTS parent_id BIGINT REFERENCES fin_categorias(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fin_categorias_parent ON fin_categorias(parent_id);

-- ── 2. Negócios ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fin_negocios (
  id          SERIAL PRIMARY KEY,
  nome        TEXT NOT NULL UNIQUE,
  descricao   TEXT,
  ativo       BOOLEAN NOT NULL DEFAULT true,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed com os negócios já usados em fin_contas
INSERT INTO fin_negocios (nome) VALUES ('pousinox'), ('pouso_inox'), ('mp')
  ON CONFLICT (nome) DO NOTHING;

ALTER TABLE fin_negocios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON fin_negocios
  USING (auth.role() = 'service_role');

-- ── 3. Formas de Pagamento ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fin_formas_pagamento (
  id          SERIAL PRIMARY KEY,
  nome        TEXT NOT NULL,
  tipo        TEXT NOT NULL CHECK (tipo IN ('dinheiro','pix','boleto','transferencia','cartao','cheque','outro')),
  bandeira    TEXT,       -- Visa, Mastercard, Elo, etc. (só para tipo='cartao')
  modalidade  TEXT CHECK (modalidade IN ('credito','debito','voucher') OR modalidade IS NULL),
  ativo       BOOLEAN NOT NULL DEFAULT true,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seeds usuais
INSERT INTO fin_formas_pagamento (nome, tipo) VALUES
  ('Dinheiro',      'dinheiro'),
  ('PIX',           'pix'),
  ('Boleto',        'boleto'),
  ('Transferência', 'transferencia'),
  ('Cheque',        'cheque')
ON CONFLICT DO NOTHING;

INSERT INTO fin_formas_pagamento (nome, tipo, bandeira, modalidade) VALUES
  ('Visa Crédito',        'cartao', 'Visa',       'credito'),
  ('Visa Débito',         'cartao', 'Visa',       'debito'),
  ('Mastercard Crédito',  'cartao', 'Mastercard', 'credito'),
  ('Mastercard Débito',   'cartao', 'Mastercard', 'debito'),
  ('Elo Crédito',         'cartao', 'Elo',        'credito'),
  ('Elo Débito',          'cartao', 'Elo',        'debito'),
  ('Hipercard Crédito',   'cartao', 'Hipercard',  'credito'),
  ('American Express',    'cartao', 'American Express', 'credito')
ON CONFLICT DO NOTHING;

ALTER TABLE fin_formas_pagamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON fin_formas_pagamento
  USING (auth.role() = 'service_role');
