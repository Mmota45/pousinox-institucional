-- ═══════════════════════════════════════════════════════════════
-- Etapa 3 — Fiscal: Documentos Recebidos e Emitidos
-- NF-e vinculada a processo operacional; movimentação de estoque
-- gerada explicitamente (não automática) via ação do usuário.
-- ═══════════════════════════════════════════════════════════════

-- ─── Documentos Fiscais Recebidos (NF-e de compra) ───────────────
CREATE TABLE IF NOT EXISTS docs_fiscais_recebidos (
  id                BIGSERIAL PRIMARY KEY,
  nf_numero         TEXT,
  nf_serie          TEXT,
  nf_chave          TEXT,
  emitente_cnpj     TEXT,
  emitente_nome     TEXT NOT NULL DEFAULT '',
  data_emissao      DATE,
  data_entrada      DATE NOT NULL DEFAULT CURRENT_DATE,
  valor_total       NUMERIC(12,2) NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'pendente'
                    CHECK (status IN ('pendente','autorizada','cancelada','denegada')),
  recebimento_id    BIGINT REFERENCES recebimentos_compra(id) ON DELETE SET NULL,
  estoque_movimentado BOOLEAN NOT NULL DEFAULT FALSE,
  observacoes       TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS itens_doc_recebido (
  id                BIGSERIAL PRIMARY KEY,
  doc_id            BIGINT NOT NULL REFERENCES docs_fiscais_recebidos(id) ON DELETE CASCADE,
  descricao         TEXT NOT NULL,
  ncm               TEXT,
  cfop              TEXT,
  quantidade        NUMERIC(10,3) NOT NULL DEFAULT 1,
  unidade           TEXT NOT NULL DEFAULT 'un',
  valor_unitario    NUMERIC(12,4) NOT NULL DEFAULT 0,
  valor_total       NUMERIC(12,2) NOT NULL DEFAULT 0,
  estoque_item_id   BIGINT REFERENCES estoque_itens(id) ON DELETE SET NULL,
  ordem             INT NOT NULL DEFAULT 0
);

CREATE TRIGGER trg_docs_fiscais_recebidos_updated_at
  BEFORE UPDATE ON docs_fiscais_recebidos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE docs_fiscais_recebidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY docs_fiscais_recebidos_service ON docs_fiscais_recebidos
  USING (auth.role() = 'service_role');

ALTER TABLE itens_doc_recebido ENABLE ROW LEVEL SECURITY;
CREATE POLICY itens_doc_recebido_service ON itens_doc_recebido
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_dfr_status       ON docs_fiscais_recebidos(status);
CREATE INDEX IF NOT EXISTS idx_dfr_recebimento  ON docs_fiscais_recebidos(recebimento_id);
CREATE INDEX IF NOT EXISTS idx_idr_doc          ON itens_doc_recebido(doc_id);
CREATE INDEX IF NOT EXISTS idx_idr_estoque_item ON itens_doc_recebido(estoque_item_id);

-- ─── Documentos Fiscais Emitidos (NF-e de venda) ─────────────────
CREATE TABLE IF NOT EXISTS docs_fiscais_emitidos (
  id                  BIGSERIAL PRIMARY KEY,
  nf_numero           TEXT,
  nf_serie            TEXT,
  nf_chave            TEXT,
  destinatario_cnpj   TEXT,
  destinatario_nome   TEXT NOT NULL DEFAULT '',
  data_emissao        DATE NOT NULL DEFAULT CURRENT_DATE,
  valor_total         NUMERIC(12,2) NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'rascunho'
                      CHECK (status IN ('rascunho','autorizada','cancelada','denegada')),
  venda_id            UUID REFERENCES vendas(id) ON DELETE SET NULL,
  estoque_movimentado BOOLEAN NOT NULL DEFAULT FALSE,
  observacoes         TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS itens_doc_emitido (
  id                BIGSERIAL PRIMARY KEY,
  doc_id            BIGINT NOT NULL REFERENCES docs_fiscais_emitidos(id) ON DELETE CASCADE,
  descricao         TEXT NOT NULL,
  ncm               TEXT,
  cfop              TEXT,
  quantidade        NUMERIC(10,3) NOT NULL DEFAULT 1,
  unidade           TEXT NOT NULL DEFAULT 'un',
  valor_unitario    NUMERIC(12,4) NOT NULL DEFAULT 0,
  valor_total       NUMERIC(12,2) NOT NULL DEFAULT 0,
  estoque_item_id   BIGINT REFERENCES estoque_itens(id) ON DELETE SET NULL,
  ordem             INT NOT NULL DEFAULT 0
);

CREATE TRIGGER trg_docs_fiscais_emitidos_updated_at
  BEFORE UPDATE ON docs_fiscais_emitidos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE docs_fiscais_emitidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY docs_fiscais_emitidos_service ON docs_fiscais_emitidos
  USING (auth.role() = 'service_role');

ALTER TABLE itens_doc_emitido ENABLE ROW LEVEL SECURITY;
CREATE POLICY itens_doc_emitido_service ON itens_doc_emitido
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_dfe_status       ON docs_fiscais_emitidos(status);
CREATE INDEX IF NOT EXISTS idx_dfe_venda        ON docs_fiscais_emitidos(venda_id);
CREATE INDEX IF NOT EXISTS idx_ide_doc          ON itens_doc_emitido(doc_id);
CREATE INDEX IF NOT EXISTS idx_ide_estoque_item ON itens_doc_emitido(estoque_item_id);
