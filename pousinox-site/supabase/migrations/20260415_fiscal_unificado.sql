-- ═══════════════════════════════════════════════════════════════
-- Fiscal Unificado — tabelas únicas docs_fiscais + itens_doc
-- Substitui docs_fiscais_recebidos, docs_fiscais_emitidos,
-- itens_doc_recebido e itens_doc_emitido (todas estavam vazias).
-- ═══════════════════════════════════════════════════════════════

-- ─── Drop legadas (seguro pois estavam vazias) ────────────────────
DROP TABLE IF EXISTS itens_doc_recebido  CASCADE;
DROP TABLE IF EXISTS itens_doc_emitido   CASCADE;
DROP TABLE IF EXISTS docs_fiscais_recebidos CASCADE;
DROP TABLE IF EXISTS docs_fiscais_emitidos  CASCADE;

-- ─── Tabela unificada de documentos fiscais ───────────────────────
CREATE TABLE IF NOT EXISTS docs_fiscais (
  id                  BIGSERIAL PRIMARY KEY,
  tipo                TEXT NOT NULL CHECK (tipo IN ('recebido', 'emitido')),
  nf_numero           TEXT,
  nf_serie            TEXT,
  nf_chave            TEXT,
  contraparte_cnpj    TEXT,
  contraparte_nome    TEXT NOT NULL DEFAULT '',
  data_emissao        DATE,
  data_entrada        DATE,                      -- preenchido apenas para tipo='recebido'
  valor_total         NUMERIC(12,2) NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'pendente'
                      CHECK (status IN ('pendente','rascunho','autorizada','cancelada','denegada')),
  recebimento_id      BIGINT REFERENCES recebimentos_compra(id) ON DELETE SET NULL,
  venda_id            TEXT,                      -- UUID da venda, armazenado como text
  estoque_movimentado BOOLEAN NOT NULL DEFAULT FALSE,
  observacoes         TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_docs_fiscais_updated_at
  BEFORE UPDATE ON docs_fiscais
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE docs_fiscais ENABLE ROW LEVEL SECURITY;
CREATE POLICY docs_fiscais_service ON docs_fiscais
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_df_tipo        ON docs_fiscais(tipo);
CREATE INDEX IF NOT EXISTS idx_df_status      ON docs_fiscais(status);
CREATE INDEX IF NOT EXISTS idx_df_recebimento ON docs_fiscais(recebimento_id);
CREATE INDEX IF NOT EXISTS idx_df_nf_numero   ON docs_fiscais(nf_numero);

-- ─── Tabela unificada de itens ────────────────────────────────────
CREATE TABLE IF NOT EXISTS itens_doc (
  id                BIGSERIAL PRIMARY KEY,
  doc_id            BIGINT NOT NULL REFERENCES docs_fiscais(id) ON DELETE CASCADE,
  codigo_produto    TEXT,
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

ALTER TABLE itens_doc ENABLE ROW LEVEL SECURITY;
CREATE POLICY itens_doc_service ON itens_doc
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_id_doc          ON itens_doc(doc_id);
CREATE INDEX IF NOT EXISTS idx_id_estoque_item ON itens_doc(estoque_item_id);
