-- ── fin_budget ────────────────────────────────────────────────────────────────
-- Orçamento por categoria/mês. MVP foca despesas.
--
-- Regra do REALIZADO (despesas):
--   SELECT SUM(valor) FROM fin_lancamentos
--   WHERE tipo = 'despesa'
--     AND status IN ('pendente', 'pago', 'parcial')   -- exclui 'cancelado'
--     AND EXTRACT(year  FROM data_competencia) = budget.ano
--     AND (budget.mes IS NULL OR EXTRACT(month FROM data_competencia) = budget.mes)
--     AND categoria_id = budget.categoria_id
--     AND (budget.centro_custo_id IS NULL OR centro_custo_id = budget.centro_custo_id)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fin_budget (
  id               BIGSERIAL PRIMARY KEY,
  ano              SMALLINT    NOT NULL,
  mes              SMALLINT    NULL CHECK (mes BETWEEN 1 AND 12),  -- NULL = orçamento anual
  categoria_id     BIGINT      NOT NULL REFERENCES fin_categorias(id) ON DELETE CASCADE,
  centro_custo_id  BIGINT      NULL     REFERENCES fin_centros_custo(id) ON DELETE SET NULL,
  valor_orcado     NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (valor_orcado >= 0),
  observacao       TEXT        NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique: um orçamento por ano + mês + categoria + centro de custo
-- COALESCE(mes, 0) e COALESCE(centro_custo_id, 0) garantem unicidade mesmo com NULLs
CREATE UNIQUE INDEX IF NOT EXISTS fin_budget_unique_idx
  ON fin_budget (ano, COALESCE(mes, 0), categoria_id, COALESCE(centro_custo_id, 0));

-- updated_at automático (reusa trigger function existente)
CREATE TRIGGER fin_budget_updated_at
  BEFORE UPDATE ON fin_budget
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE fin_budget ENABLE ROW LEVEL SECURITY;
CREATE POLICY fin_budget_service_role ON fin_budget
  USING (auth.role() = 'service_role');

-- Index de leitura por ano/mês (queries frequentes)
CREATE INDEX IF NOT EXISTS fin_budget_ano_mes_idx ON fin_budget (ano, mes);
