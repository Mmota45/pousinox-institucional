-- ============================================================
-- Fase 4 — cron job: previsto → atrasado
-- Módulo Fluxo de Caixa v2
-- Requer extensão pg_cron (habilitada no Supabase por padrão)
-- ============================================================

-- ── 1. Função de atualização de status ───────────────────────

CREATE OR REPLACE FUNCTION fn_fin_atualizar_status_atrasado()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total INT;
BEGIN
  UPDATE fin_movimentacoes
  SET    status = 'atrasado'
  WHERE  status = 'previsto'
    AND  data   < CURRENT_DATE;

  GET DIAGNOSTICS v_total = ROW_COUNT;

  -- Registra execução no log de sistema (opcional — visível no Supabase Logs)
  RAISE NOTICE 'fn_fin_atualizar_status_atrasado: % movimentação(ões) marcada(s) como atrasada(s)', v_total;
END;
$$;

COMMENT ON FUNCTION fn_fin_atualizar_status_atrasado IS
  'Muda status de previsto → atrasado para movimentações com data anterior a hoje. '
  'Executada diariamente via pg_cron às 01:00 BRT (04:00 UTC).';

-- ── 2. Agendamento via pg_cron ────────────────────────────────
-- Executa todo dia às 04:00 UTC (01:00 BRT)
-- Supabase usa UTC internamente.

SELECT cron.schedule(
  'fin_atualizar_status_atrasado',          -- nome do job (único)
  '0 4 * * *',                              -- cron expression: 04:00 UTC diário
  $$ SELECT fn_fin_atualizar_status_atrasado(); $$
);

-- ── 3. Execução imediata para corrigir dados históricos ───────
-- Marca como atrasado tudo que já estava previsto e vencido antes desta migration.

SELECT fn_fin_atualizar_status_atrasado();
