-- ═══════════════════════════════════════════════════════════════
-- Etapa 1 — Compras: Solicitações, Cotações, Pedidos, Recebimentos
-- ═══════════════════════════════════════════════════════════════

-- ─── Solicitações de Compra ──────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS solicitacoes_compra_numero_seq START 1;

CREATE TABLE IF NOT EXISTS solicitacoes_compra (
  id              BIGSERIAL PRIMARY KEY,
  numero          TEXT UNIQUE NOT NULL
                  DEFAULT 'SC-' || LPAD(nextval('solicitacoes_compra_numero_seq')::TEXT, 4, '0'),
  data_solicitacao DATE NOT NULL DEFAULT CURRENT_DATE,
  data_necessidade DATE,
  solicitante     TEXT NOT NULL DEFAULT '',
  departamento    TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'pendente'
                  CHECK (status IN ('rascunho','pendente','aprovada','reprovada','atendida')),
  observacoes     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS itens_solicitacao (
  id              BIGSERIAL PRIMARY KEY,
  solicitacao_id  BIGINT NOT NULL REFERENCES solicitacoes_compra(id) ON DELETE CASCADE,
  descricao       TEXT NOT NULL,
  quantidade      NUMERIC(10,3) NOT NULL DEFAULT 1,
  unidade         TEXT NOT NULL DEFAULT 'un',
  observacao      TEXT,
  ordem           INT NOT NULL DEFAULT 0
);

CREATE TRIGGER trg_solicitacoes_compra_updated_at
  BEFORE UPDATE ON solicitacoes_compra
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE solicitacoes_compra ENABLE ROW LEVEL SECURITY;
CREATE POLICY solicitacoes_compra_service ON solicitacoes_compra
  USING (auth.role() = 'service_role');

ALTER TABLE itens_solicitacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY itens_solicitacao_service ON itens_solicitacao
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_itens_solicitacao_sol ON itens_solicitacao(solicitacao_id);

-- ─── Cotações de Compra ───────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS cotacoes_compra_numero_seq START 1;

CREATE TABLE IF NOT EXISTS cotacoes_compra (
  id                  BIGSERIAL PRIMARY KEY,
  numero              TEXT UNIQUE NOT NULL
                      DEFAULT 'CQ-' || LPAD(nextval('cotacoes_compra_numero_seq')::TEXT, 4, '0'),
  solicitacao_id      BIGINT REFERENCES solicitacoes_compra(id) ON DELETE SET NULL,
  fornecedor_id       BIGINT REFERENCES fornecedores(id) ON DELETE SET NULL,
  fornecedor_nome     TEXT NOT NULL DEFAULT '',
  data_cotacao        DATE NOT NULL DEFAULT CURRENT_DATE,
  validade_ate        DATE,
  status              TEXT NOT NULL DEFAULT 'rascunho'
                      CHECK (status IN ('rascunho','enviada','recebida','aprovada','reprovada','expirada')),
  condicao_pagamento  TEXT,
  prazo_entrega_dias  INT,
  observacoes         TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS itens_cotacao (
  id              BIGSERIAL PRIMARY KEY,
  cotacao_id      BIGINT NOT NULL REFERENCES cotacoes_compra(id) ON DELETE CASCADE,
  descricao       TEXT NOT NULL,
  quantidade      NUMERIC(10,3) NOT NULL DEFAULT 1,
  unidade         TEXT NOT NULL DEFAULT 'un',
  valor_unitario  NUMERIC(12,4) NOT NULL DEFAULT 0,
  ordem           INT NOT NULL DEFAULT 0
);

CREATE TRIGGER trg_cotacoes_compra_updated_at
  BEFORE UPDATE ON cotacoes_compra
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE cotacoes_compra ENABLE ROW LEVEL SECURITY;
CREATE POLICY cotacoes_compra_service ON cotacoes_compra
  USING (auth.role() = 'service_role');

ALTER TABLE itens_cotacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY itens_cotacao_service ON itens_cotacao
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_cotacoes_solicitacao ON cotacoes_compra(solicitacao_id);
CREATE INDEX IF NOT EXISTS idx_cotacoes_fornecedor ON cotacoes_compra(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_itens_cotacao_cot ON itens_cotacao(cotacao_id);

-- ─── Pedidos de Compra ────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS pedidos_compra_numero_seq START 1;

CREATE TABLE IF NOT EXISTS pedidos_compra (
  id                  BIGSERIAL PRIMARY KEY,
  numero              TEXT UNIQUE NOT NULL
                      DEFAULT 'PC-' || LPAD(nextval('pedidos_compra_numero_seq')::TEXT, 4, '0'),
  cotacao_id          BIGINT REFERENCES cotacoes_compra(id) ON DELETE SET NULL,
  fornecedor_id       BIGINT REFERENCES fornecedores(id) ON DELETE SET NULL,
  fornecedor_nome     TEXT NOT NULL DEFAULT '',
  data_pedido         DATE NOT NULL DEFAULT CURRENT_DATE,
  previsao_entrega    DATE,
  status              TEXT NOT NULL DEFAULT 'rascunho'
                      CHECK (status IN ('rascunho','enviado','confirmado','parcialmente_recebido','recebido','cancelado')),
  condicao_pagamento  TEXT,
  valor_total         NUMERIC(12,2) NOT NULL DEFAULT 0,
  observacoes         TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS itens_pedido (
  id                  BIGSERIAL PRIMARY KEY,
  pedido_id           BIGINT NOT NULL REFERENCES pedidos_compra(id) ON DELETE CASCADE,
  descricao           TEXT NOT NULL,
  quantidade          NUMERIC(10,3) NOT NULL DEFAULT 1,
  unidade             TEXT NOT NULL DEFAULT 'un',
  valor_unitario      NUMERIC(12,4) NOT NULL DEFAULT 0,
  quantidade_recebida NUMERIC(10,3) NOT NULL DEFAULT 0,
  ordem               INT NOT NULL DEFAULT 0
);

CREATE TRIGGER trg_pedidos_compra_updated_at
  BEFORE UPDATE ON pedidos_compra
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE pedidos_compra ENABLE ROW LEVEL SECURITY;
CREATE POLICY pedidos_compra_service ON pedidos_compra
  USING (auth.role() = 'service_role');

ALTER TABLE itens_pedido ENABLE ROW LEVEL SECURITY;
CREATE POLICY itens_pedido_service ON itens_pedido
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_pedidos_cotacao ON pedidos_compra(cotacao_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_fornecedor ON pedidos_compra(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_itens_pedido_ped ON itens_pedido(pedido_id);

-- ─── Recebimentos de Compra ───────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS recebimentos_compra_numero_seq START 1;

CREATE TABLE IF NOT EXISTS recebimentos_compra (
  id               BIGSERIAL PRIMARY KEY,
  numero           TEXT UNIQUE NOT NULL
                   DEFAULT 'RC-' || LPAD(nextval('recebimentos_compra_numero_seq')::TEXT, 4, '0'),
  pedido_id        BIGINT NOT NULL REFERENCES pedidos_compra(id) ON DELETE RESTRICT,
  data_recebimento DATE NOT NULL DEFAULT CURRENT_DATE,
  nf_numero        TEXT,
  nf_chave         TEXT,
  status           TEXT NOT NULL DEFAULT 'pendente'
                   CHECK (status IN ('pendente','conferido','divergente','aceito','recusado')),
  observacoes      TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS itens_recebimento (
  id                 BIGSERIAL PRIMARY KEY,
  recebimento_id     BIGINT NOT NULL REFERENCES recebimentos_compra(id) ON DELETE CASCADE,
  item_pedido_id     BIGINT REFERENCES itens_pedido(id) ON DELETE SET NULL,
  descricao          TEXT NOT NULL,
  quantidade_recebida NUMERIC(10,3) NOT NULL DEFAULT 0,
  unidade            TEXT NOT NULL DEFAULT 'un',
  valor_unitario     NUMERIC(12,4) NOT NULL DEFAULT 0,
  ordem              INT NOT NULL DEFAULT 0
);

CREATE TRIGGER trg_recebimentos_compra_updated_at
  BEFORE UPDATE ON recebimentos_compra
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE recebimentos_compra ENABLE ROW LEVEL SECURITY;
CREATE POLICY recebimentos_compra_service ON recebimentos_compra
  USING (auth.role() = 'service_role');

ALTER TABLE itens_recebimento ENABLE ROW LEVEL SECURITY;
CREATE POLICY itens_recebimento_service ON itens_recebimento
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_recebimentos_pedido ON recebimentos_compra(pedido_id);
CREATE INDEX IF NOT EXISTS idx_itens_recebimento_rec ON itens_recebimento(recebimento_id);
