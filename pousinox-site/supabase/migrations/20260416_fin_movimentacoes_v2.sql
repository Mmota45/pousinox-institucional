-- ============================================================
-- Fase 1 — fin_movimentacoes v2: refatoração para fonte primária
-- Colunas reais da tabela (verificadas via information_schema):
--   id, lancamento_id, parcela_id, tipo, valor, data, conta,
--   descricao, empresa_id, created_at, updated_at, created_by
-- ============================================================

-- ── 1. Novas colunas (todas com DEFAULT — zero impacto nos dados existentes) ──

-- Empresa / segmentação multi-negócio (texto legível, paralelo ao empresa_id existente)
ALTER TABLE fin_movimentacoes
  ADD COLUMN IF NOT EXISTS negocio TEXT
    CHECK (negocio IN ('pousinox','mp','pouso_inox'))
    DEFAULT 'pousinox';

-- Conta bancária (FK para fin_contas, paralela à coluna conta TEXT legada)
ALTER TABLE fin_movimentacoes
  ADD COLUMN IF NOT EXISTS conta_id BIGINT
    REFERENCES fin_contas(id) ON DELETE SET NULL;

-- Status (alimenta DRE por regime de caixa)
ALTER TABLE fin_movimentacoes
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL
    CHECK (status IN ('realizado','previsto','atrasado','negociado','cancelado'))
    DEFAULT 'realizado';

-- Data de competência (regime competência — futuro)
ALTER TABLE fin_movimentacoes
  ADD COLUMN IF NOT EXISTS data_competencia DATE;

-- Plano de contas
ALTER TABLE fin_movimentacoes
  ADD COLUMN IF NOT EXISTS categoria_id BIGINT
    REFERENCES fin_categorias(id) ON DELETE SET NULL;

ALTER TABLE fin_movimentacoes
  ADD COLUMN IF NOT EXISTS centro_custo_id BIGINT
    REFERENCES fin_centros_custo(id) ON DELETE SET NULL;

-- Forma de pagamento e referência do documento
ALTER TABLE fin_movimentacoes
  ADD COLUMN IF NOT EXISTS tipo_pagamento TEXT
    CHECK (tipo_pagamento IN (
      'pix','boleto','transferencia','dinheiro',
      'cartao_credito','cartao_debito','cheque','outro'
    ));

ALTER TABLE fin_movimentacoes
  ADD COLUMN IF NOT EXISTS documento_ref TEXT;  -- chave PIX, nº boleto, nº cheque

-- Conciliação
ALTER TABLE fin_movimentacoes
  ADD COLUMN IF NOT EXISTS conciliado     BOOLEAN     NOT NULL DEFAULT false;

ALTER TABLE fin_movimentacoes
  ADD COLUMN IF NOT EXISTS conciliado_em  TIMESTAMPTZ;

ALTER TABLE fin_movimentacoes
  ADD COLUMN IF NOT EXISTS conciliado_por TEXT;

-- Transferência interna (FK adicionada na Fase 2)
ALTER TABLE fin_movimentacoes
  ADD COLUMN IF NOT EXISTS transferencia_id BIGINT;

-- Rastreabilidade de origem
ALTER TABLE fin_movimentacoes
  ADD COLUMN IF NOT EXISTS origem_tipo TEXT
    CHECK (origem_tipo IN (
      'manual','nf','venda','projeto','pipeline','folha','sistema'
    ));

ALTER TABLE fin_movimentacoes
  ADD COLUMN IF NOT EXISTS origem_id TEXT;

-- Tags livres
ALTER TABLE fin_movimentacoes
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- ── 2. Trigger updated_at (coluna já existe) ──────────────────

DROP TRIGGER IF EXISTS fin_movimentacoes_updated_at ON fin_movimentacoes;
CREATE TRIGGER fin_movimentacoes_updated_at
  BEFORE UPDATE ON fin_movimentacoes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 3. Índices ────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_fin_mov_status
  ON fin_movimentacoes (status);

CREATE INDEX IF NOT EXISTS idx_fin_mov_conta_data
  ON fin_movimentacoes (conta_id, data);

CREATE INDEX IF NOT EXISTS idx_fin_mov_negocio
  ON fin_movimentacoes (negocio);

CREATE INDEX IF NOT EXISTS idx_fin_mov_conciliado
  ON fin_movimentacoes (conciliado) WHERE conciliado = false;

CREATE INDEX IF NOT EXISTS idx_fin_mov_lancamento
  ON fin_movimentacoes (lancamento_id) WHERE lancamento_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fin_mov_categoria
  ON fin_movimentacoes (categoria_id);

CREATE INDEX IF NOT EXISTS idx_fin_mov_transferencia
  ON fin_movimentacoes (transferencia_id) WHERE transferencia_id IS NOT NULL;

-- ── 4. Recriar vw_fin_saldo_conta com cálculo real ───────────

DROP VIEW IF EXISTS vw_fin_saldo_conta;
CREATE VIEW vw_fin_saldo_conta AS
SELECT
  c.id                AS conta_id,
  c.nome,
  c.banco,
  c.tipo,
  c.negocio,
  c.saldo_inicial,
  c.saldo_inicial_em,
  c.saldo_inicial
    + COALESCE(
        SUM(
          CASE
            WHEN m.tipo = 'entrada' THEN  m.valor
            WHEN m.tipo = 'saida'   THEN -m.valor
            ELSE 0
          END
        ) FILTER (
          WHERE m.status = 'realizado'
            AND m.data >= c.saldo_inicial_em
        ),
        0
      )               AS saldo_atual,
  c.ativo
FROM fin_contas c
LEFT JOIN fin_movimentacoes m ON m.conta_id = c.id
GROUP BY c.id;

COMMENT ON VIEW vw_fin_saldo_conta IS
  'Saldo atual por conta = saldo_inicial + Σ movimentações realizadas após saldo_inicial_em';

-- ── 5. View: extrato cronológico ──────────────────────────────

CREATE OR REPLACE VIEW vw_fin_extrato AS
SELECT
  m.id,
  m.conta_id,
  c.nome                                        AS conta_nome,
  m.negocio,
  m.data,
  m.descricao,
  m.tipo,
  m.valor,
  CASE WHEN m.tipo = 'entrada' THEN m.valor ELSE -m.valor END AS valor_sinal,
  m.status,
  m.tipo_pagamento,
  m.documento_ref,
  m.conciliado,
  m.categoria_id,
  cat.nome                                      AS categoria_nome,
  cat.grupo                                     AS categoria_grupo,
  m.centro_custo_id,
  cc.nome                                       AS centro_custo_nome,
  m.lancamento_id,
  m.transferencia_id,
  m.origem_tipo,
  m.origem_id,
  m.tags,
  m.created_at
FROM fin_movimentacoes m
LEFT JOIN fin_contas        c   ON c.id   = m.conta_id
LEFT JOIN fin_categorias    cat ON cat.id = m.categoria_id
LEFT JOIN fin_centros_custo cc  ON cc.id  = m.centro_custo_id
WHERE m.status != 'cancelado'
ORDER BY m.data DESC, m.id DESC;

COMMENT ON VIEW vw_fin_extrato IS
  'Extrato enriquecido de movimentações (exceto canceladas)';

-- ── 6. View: fila de conciliação ─────────────────────────────

CREATE OR REPLACE VIEW vw_fin_conciliacao_pendente AS
SELECT
  m.id,
  m.conta_id,
  c.nome    AS conta_nome,
  m.negocio,
  m.data,
  m.descricao,
  m.tipo,
  m.valor,
  m.tipo_pagamento,
  m.documento_ref,
  m.lancamento_id,
  m.origem_tipo,
  m.created_at
FROM fin_movimentacoes m
LEFT JOIN fin_contas c ON c.id = m.conta_id
WHERE m.conciliado = false
  AND m.status     = 'realizado'
ORDER BY m.data ASC;

COMMENT ON VIEW vw_fin_conciliacao_pendente IS
  'Movimentações realizadas ainda não conciliadas';

-- ── 7. View: DRE por status ───────────────────────────────────

CREATE OR REPLACE VIEW vw_fin_dre AS
SELECT
  m.negocio,
  COALESCE(cat.grupo, 'Sem categoria')          AS grupo,
  COALESCE(cat.tipo,
    CASE WHEN m.tipo = 'entrada' THEN 'receita' ELSE 'despesa' END
  )                                             AS tipo_lancamento,
  m.status,
  DATE_TRUNC('month', m.data)                   AS mes,
  SUM(m.valor)                                  AS total
FROM fin_movimentacoes m
LEFT JOIN fin_categorias cat ON cat.id = m.categoria_id
WHERE m.status != 'cancelado'
GROUP BY m.negocio, cat.grupo, cat.tipo, m.tipo, m.status,
         DATE_TRUNC('month', m.data);

COMMENT ON VIEW vw_fin_dre IS
  'DRE por regime de caixa: agrupa por negócio, grupo de categoria, status e mês';

COMMENT ON TABLE fin_movimentacoes IS
  'Fonte primária de verdade do módulo financeiro. '
  'Toda transação financeira real ou prevista reside aqui. '
  'fin_lancamentos é documento de origem — referenciado via lancamento_id.';
