-- Cron: prospecção automática via WhatsApp
-- Roda a cada 30 minutos, seg-sex, 8h-18h (horário de Brasília = UTC-3 → 11h-21h UTC)
-- Envia 20 mensagens por execução (~640/dia útil)

SELECT cron.schedule(
  'prospectar-whatsapp-auto',
  '*/30 11-21 * * 1-5',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/prospectar-whatsapp',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{"limit":20}'::jsonb
  );
  $$
);
