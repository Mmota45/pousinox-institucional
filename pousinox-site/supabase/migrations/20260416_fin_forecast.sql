-- ============================================================
-- Fase 5 — forecast: projeção de saldo diário por conta
-- Módulo Fluxo de Caixa v2
-- ============================================================

-- ── 1. View: forecast diário por conta ───────────────────────
-- Projeta saldo acumulado dia a dia combinando:
--   - Realizadas: movimentações com status = 'realizado'
--   - Previstas:  movimentações com status IN ('previsto','negociado')
-- Útil para gráfico de fluxo de caixa projetado.

CREATE OR REPLACE VIEW vw_fin_forecast_diario AS
WITH movs AS (
  SELECT
    conta_id,
    negocio,
    data,
    CASE WHEN tipo = 'entrada' THEN valor ELSE -valor END AS valor_sinal,
    status
  FROM fin_movimentacoes
  WHERE status IN ('realizado','previsto','negociado')
),
dias AS (
  -- Todos os dias com movimentação por conta
  SELECT DISTINCT conta_id, negocio, data FROM movs
),
acumulado AS (
  SELECT
    d.conta_id,
    d.negocio,
    d.data,
    -- Realizado acumulado até este dia
    COALESCE((
      SELECT SUM(m.valor_sinal)
      FROM movs m
      WHERE m.conta_id = d.conta_id
        AND m.data    <= d.data
        AND m.status   = 'realizado'
    ), 0) AS realizado_acumulado,
    -- Previsto/negociado acumulado até este dia
    COALESCE((
      SELECT SUM(m.valor_sinal)
      FROM movs m
      WHERE m.conta_id = d.conta_id
        AND m.data    <= d.data
        AND m.status  IN ('previsto','negociado')
    ), 0) AS previsto_acumulado
  FROM dias d
)
SELECT
  a.conta_id,
  c.nome                                        AS conta_nome,
  a.negocio,
  a.data,
  -- Saldo realizado = saldo_inicial + realizado acumulado
  c.saldo_inicial + a.realizado_acumulado       AS saldo_realizado,
  -- Saldo projetado = saldo realizado + previsto acumulado
  c.saldo_inicial
    + a.realizado_acumulado
    + a.previsto_acumulado                      AS saldo_projetado,
  a.realizado_acumulado,
  a.previsto_acumulado
FROM acumulado a
JOIN fin_contas c ON c.id = a.conta_id
ORDER BY a.conta_id, a.data;

COMMENT ON VIEW vw_fin_forecast_diario IS
  'Projeção de saldo diário por conta. '
  'saldo_realizado = saldo_inicial + Σ realizadas até o dia. '
  'saldo_projetado = saldo_realizado + Σ previstas/negociadas até o dia. '
  'Filtrar por conta_id e intervalo de data no frontend.';

-- ── 2. View: forecast em janelas 30 / 60 / 90 dias ───────────

CREATE OR REPLACE VIEW vw_fin_forecast_janelas AS
SELECT
  m.conta_id,
  c.nome                                          AS conta_nome,
  m.negocio,
  CASE
    WHEN m.data <= CURRENT_DATE + 30  THEN '+30d'
    WHEN m.data <= CURRENT_DATE + 60  THEN '+60d'
    WHEN m.data <= CURRENT_DATE + 90  THEN '+90d'
    ELSE '+90d+'
  END                                             AS janela,
  m.tipo,
  SUM(m.valor)                                    AS total_previsto
FROM fin_movimentacoes m
JOIN fin_contas c ON c.id = m.conta_id
WHERE m.status IN ('previsto','negociado')
  AND m.data   > CURRENT_DATE
  AND m.data  <= CURRENT_DATE + 90
GROUP BY m.conta_id, c.nome, m.negocio, janela, m.tipo
ORDER BY m.conta_id, janela, m.tipo;

COMMENT ON VIEW vw_fin_forecast_janelas IS
  'Totais previstos/negociados por conta agrupados em janelas +30/+60/+90 dias. '
  'Entrada e saída separadas para calcular saldo líquido por janela no frontend.';

-- ── 3. Função: saldo projetado em uma data específica ─────────

CREATE OR REPLACE FUNCTION fn_fin_saldo_projetado(
  p_conta_id BIGINT,
  p_data     DATE DEFAULT CURRENT_DATE + 30
)
RETURNS TABLE (
  conta_id         BIGINT,
  conta_nome       TEXT,
  data_projecao    DATE,
  saldo_realizado  NUMERIC,
  saldo_projetado  NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    c.id,
    c.nome,
    p_data,
    c.saldo_inicial + COALESCE(SUM(
      CASE WHEN m.tipo = 'entrada' THEN m.valor ELSE -m.valor END
    ) FILTER (WHERE m.status = 'realizado' AND m.data <= p_data), 0),
    c.saldo_inicial + COALESCE(SUM(
      CASE WHEN m.tipo = 'entrada' THEN m.valor ELSE -m.valor END
    ) FILTER (WHERE m.status IN ('realizado','previsto','negociado') AND m.data <= p_data), 0)
  FROM fin_contas c
  LEFT JOIN fin_movimentacoes m ON m.conta_id = c.id
  WHERE c.id = p_conta_id
  GROUP BY c.id, c.nome;
$$;

COMMENT ON FUNCTION fn_fin_saldo_projetado IS
  'Retorna saldo realizado e projetado de uma conta em uma data específica. '
  'Uso: SELECT * FROM fn_fin_saldo_projetado(1, ''2026-05-31'');';
