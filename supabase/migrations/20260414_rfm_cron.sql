-- ══════════════════════════════════════════════════════════════════════════════
-- Agendamento automático do RFM via pg_cron
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Habilita a extensão (disponível em todos os planos Supabase)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Concede uso ao role postgres (necessário no Supabase)
GRANT USAGE ON SCHEMA cron TO postgres;

-- 3. Remove agendamento anterior se existir (idempotente)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'rfm-recalculo-diario') THEN
    PERFORM cron.unschedule('rfm-recalculo-diario');
  END IF;
END;
$$;

-- 4. Agenda recálculo todo dia às 03:00 UTC
SELECT cron.schedule(
  'rfm-recalculo-diario',
  '0 3 * * *',
  $$ SELECT fn_calcular_rfm() $$
);
