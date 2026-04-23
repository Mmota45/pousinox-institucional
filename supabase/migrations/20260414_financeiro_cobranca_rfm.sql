-- ══════════════════════════════════════════════════════════════════════════════
-- Financeiro Fase 2: Aging, Cobrança e base RFM
-- ══════════════════════════════════════════════════════════════════════════════


-- ── 1. Colunas de cobrança em fin_lancamentos ─────────────────────────────────
-- Registro operacional simples — sem tabela de histórico nesta fase

ALTER TABLE fin_lancamentos
  ADD COLUMN IF NOT EXISTS prioridade      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cobranca_status text    DEFAULT 'nao_cobrado'
    CHECK (cobranca_status IN ('nao_cobrado','cobrado','negociado','prometido','inadimplente')),
  ADD COLUMN IF NOT EXISTS cobranca_obs    text,
  ADD COLUMN IF NOT EXISTS cobranca_em     timestamptz;

CREATE INDEX IF NOT EXISTS idx_fin_lanc_prioridade    ON fin_lancamentos(prioridade) WHERE prioridade = true;
CREATE INDEX IF NOT EXISTS idx_fin_lanc_cobr_status   ON fin_lancamentos(cobranca_status);


-- ── 2. View de aging de recebíveis ────────────────────────────────────────────
-- Classifica lançamentos tipo=receita, status=pendente em faixas de atraso.
-- Consultada em tempo real — sem materialização.

CREATE OR REPLACE VIEW vw_fin_aging AS
SELECT
  id,
  descricao,
  valor,
  data_vencimento,
  origem,
  prioridade,
  cobranca_status,
  cobranca_obs,
  cobranca_em,
  cliente_id,
  CURRENT_DATE - data_vencimento AS dias_atraso,
  CASE
    WHEN data_vencimento >= CURRENT_DATE               THEN 'a_vencer'
    WHEN data_vencimento >= CURRENT_DATE - INTERVAL '7 days'  THEN 'vencido_1_7'
    WHEN data_vencimento >= CURRENT_DATE - INTERVAL '30 days' THEN 'vencido_8_30'
    ELSE                                                        'vencido_31_plus'
  END AS faixa
FROM fin_lancamentos
WHERE tipo = 'receita'
  AND status = 'pendente';

-- Resumo por faixa (usado no painel)
CREATE OR REPLACE VIEW vw_fin_aging_resumo AS
SELECT
  faixa,
  COUNT(*)   AS quantidade,
  SUM(valor) AS total,
  COUNT(*) FILTER (WHERE prioridade = true) AS prioritarios
FROM vw_fin_aging
GROUP BY faixa;


-- ── 3. Função de cálculo de RFM ───────────────────────────────────────────────
-- Recalcula rfm_* em todos os clientes com histórico de compras.
-- Baseado em: ultima_compra (R), total_nfs (F), total_gasto (V).
-- Execução manual via botão no admin — sem trigger.

CREATE OR REPLACE FUNCTION fn_calcular_rfm()
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  total_atualizados int;
BEGIN
  WITH base AS (
    SELECT id, ultima_compra, total_nfs, total_gasto, primeira_compra
    FROM clientes
    WHERE ultima_compra IS NOT NULL AND total_nfs > 0
  ),
  scores AS (
    SELECT
      id,
      primeira_compra,
      -- Recência: dias desde última compra — menos dias = score maior
      NTILE(5) OVER (ORDER BY ultima_compra ASC)   AS r_score,
      -- Frequência: mais NFs = score maior
      NTILE(5) OVER (ORDER BY total_nfs ASC)       AS f_score,
      -- Valor: mais gasto = score maior
      NTILE(5) OVER (ORDER BY total_gasto ASC)     AS v_score
    FROM base
  ),
  segmentado AS (
    SELECT
      id,
      r_score,
      f_score,
      v_score,
      r_score + f_score + v_score AS score_total,
      CASE
        WHEN r_score >= 4 AND f_score >= 4 AND v_score >= 4         THEN 'VIP'
        WHEN CURRENT_DATE - primeira_compra::date <= 90             THEN 'Novo'
        WHEN r_score <= 2 AND (f_score >= 3 OR v_score >= 3)       THEN 'Em Risco'
        WHEN r_score = 1                                            THEN 'Inativo'
        WHEN f_score >= 3                                           THEN 'Recorrente'
        ELSE                                                             'Regular'
      END AS segmento
    FROM scores
  )
  UPDATE clientes c
  SET
    rfm_recencia     = s.r_score,
    rfm_frequencia   = s.f_score,
    rfm_valor        = s.v_score,
    rfm_score        = s.score_total,
    rfm_segmento     = s.segmento,
    rfm_calculado_em = now()
  FROM segmentado s
  WHERE c.id = s.id;

  GET DIAGNOSTICS total_atualizados = ROW_COUNT;
  RETURN jsonb_build_object('atualizados', total_atualizados, 'calculado_em', now());
END;
$$;

COMMENT ON FUNCTION fn_calcular_rfm() IS
  'Recalcula RFM de todos os clientes com histórico. Chamar manualmente via supabase.rpc(''fn_calcular_rfm'').';
