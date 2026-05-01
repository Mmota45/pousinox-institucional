-- Cron: validar WhatsApp automaticamente a cada 30 minutos
-- Chama edge function validar-whatsapp com action=auto (50 pendentes por vez)

SELECT cron.schedule(
  'validar-whatsapp-auto',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/validar-whatsapp',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{"action":"auto"}'::jsonb
  );
  $$
);
