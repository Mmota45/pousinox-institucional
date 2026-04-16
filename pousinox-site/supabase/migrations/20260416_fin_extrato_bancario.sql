-- Migration: fin_extrato_bancario
-- Armazena entradas importadas do extrato bancário (OFX/CSV)
-- para cruzamento com fin_movimentacoes (conciliação bancária)

CREATE TABLE IF NOT EXISTS fin_extrato_bancario (
  id             BIGSERIAL PRIMARY KEY,
  conta_id       BIGINT REFERENCES fin_contas(id) ON DELETE SET NULL,
  data           DATE        NOT NULL,
  valor          NUMERIC(14,2) NOT NULL,  -- positivo = crédito, negativo = débito
  descricao      TEXT,
  tipo_lancamento TEXT,                   -- OFX TRNTYPE: CREDIT, DEBIT, CHECK, etc.
  fitid          TEXT,                    -- OFX FITID — identificador único da transação
  status         TEXT NOT NULL DEFAULT 'pendente'
                 CHECK (status IN ('pendente','conciliado','ignorado')),
  movimentacao_id BIGINT REFERENCES fin_movimentacoes(id) ON DELETE SET NULL,
  confianca      TEXT CHECK (confianca IN ('alta','media','baixa')),  -- resultado do auto-match
  importado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_extrato_conta    ON fin_extrato_bancario(conta_id);
CREATE INDEX IF NOT EXISTS idx_extrato_data     ON fin_extrato_bancario(data);
CREATE INDEX IF NOT EXISTS idx_extrato_status   ON fin_extrato_bancario(status);
CREATE INDEX IF NOT EXISTS idx_extrato_fitid    ON fin_extrato_bancario(fitid) WHERE fitid IS NOT NULL;

-- Dedup por FITID + conta (evita reimportar a mesma transação)
CREATE UNIQUE INDEX IF NOT EXISTS idx_extrato_fitid_conta
  ON fin_extrato_bancario(conta_id, fitid)
  WHERE fitid IS NOT NULL;

-- RLS
ALTER TABLE fin_extrato_bancario ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON fin_extrato_bancario
  USING (auth.role() = 'service_role');

-- View de resumo por conta/mês para o painel
CREATE OR REPLACE VIEW vw_fin_conciliacao_resumo AS
SELECT
  e.conta_id,
  c.nome                              AS conta_nome,
  COUNT(*)                            AS total,
  COUNT(*) FILTER (WHERE e.status = 'pendente')    AS pendentes,
  COUNT(*) FILTER (WHERE e.status = 'conciliado')  AS conciliados,
  COUNT(*) FILTER (WHERE e.status = 'ignorado')    AS ignorados,
  MIN(e.data)                         AS data_min,
  MAX(e.data)                         AS data_max
FROM fin_extrato_bancario e
LEFT JOIN fin_contas c ON c.id = e.conta_id
GROUP BY e.conta_id, c.nome;
