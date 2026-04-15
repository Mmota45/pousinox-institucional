-- ═══════════════════════════════════════════════════════════════
-- Etapa 2 — Estoque Industrial (MP / PA / Inventário)
-- Separado do estoque de outlet (tabela produtos)
-- estoque_movimentacoes é fonte de verdade; saldo_atual é cache
-- ═══════════════════════════════════════════════════════════════

-- ─── Cadastro de Itens ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS estoque_itens (
  id              BIGSERIAL PRIMARY KEY,
  codigo          TEXT,
  nome            TEXT NOT NULL,
  tipo            TEXT NOT NULL
                  CHECK (tipo IN ('mp','pa','semiacabado')),
  unidade         TEXT NOT NULL DEFAULT 'un',
  saldo_atual     NUMERIC(12,3) NOT NULL DEFAULT 0,
  estoque_minimo  NUMERIC(12,3) NOT NULL DEFAULT 0,
  custo_medio     NUMERIC(12,4) NOT NULL DEFAULT 0,
  localizacao     TEXT,
  lote_padrao     TEXT,
  ativo           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_estoque_itens_updated_at
  BEFORE UPDATE ON estoque_itens
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE estoque_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY estoque_itens_service ON estoque_itens
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_estoque_itens_tipo ON estoque_itens(tipo);
CREATE INDEX IF NOT EXISTS idx_estoque_itens_ativo ON estoque_itens(ativo);

-- ─── Movimentações (fonte de verdade) ────────────────────────────
CREATE TABLE IF NOT EXISTS estoque_movimentacoes (
  id                BIGSERIAL PRIMARY KEY,
  item_id           BIGINT NOT NULL REFERENCES estoque_itens(id) ON DELETE RESTRICT,
  tipo_movimentacao TEXT NOT NULL
                    CHECK (tipo_movimentacao IN (
                      'entrada','saida',
                      'ajuste_positivo','ajuste_negativo',
                      'transferencia_entrada','transferencia_saida'
                    )),
  quantidade        NUMERIC(12,3) NOT NULL CHECK (quantidade > 0),
  custo_unitario    NUMERIC(12,4) NOT NULL DEFAULT 0,
  valor_total       NUMERIC(12,2) NOT NULL DEFAULT 0,
  saldo_anterior    NUMERIC(12,3) NOT NULL DEFAULT 0,
  saldo_posterior   NUMERIC(12,3) NOT NULL DEFAULT 0,
  lote              TEXT,
  localizacao       TEXT,
  origem_tipo       TEXT,   -- 'recebimento_compra' | 'ordem_producao' | 'inventario' | 'manual'
  origem_id         BIGINT, -- sem FK rígida — flexibilidade cross-tabela
  origem_label      TEXT,   -- texto legível para display
  responsavel       TEXT,
  observacoes       TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE estoque_movimentacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY estoque_movimentacoes_service ON estoque_movimentacoes
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_estmov_item     ON estoque_movimentacoes(item_id);
CREATE INDEX IF NOT EXISTS idx_estmov_tipo     ON estoque_movimentacoes(tipo_movimentacao);
CREATE INDEX IF NOT EXISTS idx_estmov_origem   ON estoque_movimentacoes(origem_tipo, origem_id);
CREATE INDEX IF NOT EXISTS idx_estmov_created  ON estoque_movimentacoes(created_at DESC);

-- ─── Inventário (sessões de contagem física) ──────────────────────
CREATE SEQUENCE IF NOT EXISTS estoque_inventario_numero_seq START 1;

CREATE TABLE IF NOT EXISTS estoque_inventario (
  id               BIGSERIAL PRIMARY KEY,
  numero           TEXT UNIQUE NOT NULL
                   DEFAULT 'INV-' || LPAD(nextval('estoque_inventario_numero_seq')::TEXT, 4, '0'),
  data_inventario  DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo_inventario  TEXT NOT NULL DEFAULT 'geral'
                   CHECK (tipo_inventario IN ('geral','mp','pa')),
  responsavel      TEXT NOT NULL DEFAULT '',
  status           TEXT NOT NULL DEFAULT 'aberto'
                   CHECK (status IN ('aberto','em_contagem','finalizado','cancelado')),
  observacoes      TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_estoque_inventario_updated_at
  BEFORE UPDATE ON estoque_inventario
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE estoque_inventario ENABLE ROW LEVEL SECURITY;
CREATE POLICY estoque_inventario_service ON estoque_inventario
  USING (auth.role() = 'service_role');

-- ─── Itens do Inventário ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS estoque_inventario_itens (
  id              BIGSERIAL PRIMARY KEY,
  inventario_id   BIGINT NOT NULL REFERENCES estoque_inventario(id) ON DELETE CASCADE,
  item_id         BIGINT NOT NULL REFERENCES estoque_itens(id) ON DELETE RESTRICT,
  saldo_sistema   NUMERIC(12,3) NOT NULL DEFAULT 0,  -- snapshot na abertura
  saldo_contado   NUMERIC(12,3),                      -- preenchido na contagem
  diferenca       NUMERIC(12,3),                      -- atualizado pelo frontend ao salvar
  ajustado        BOOLEAN NOT NULL DEFAULT FALSE,
  lote            TEXT,
  localizacao     TEXT,
  observacao      TEXT
);

ALTER TABLE estoque_inventario_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY estoque_inventario_itens_service ON estoque_inventario_itens
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_estinv_itens_inv  ON estoque_inventario_itens(inventario_id);
CREATE INDEX IF NOT EXISTS idx_estinv_itens_item ON estoque_inventario_itens(item_id);
