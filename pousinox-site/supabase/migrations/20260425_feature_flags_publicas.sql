-- Adicionar coluna descricao e publica às feature_flags
ALTER TABLE feature_flags ADD COLUMN IF NOT EXISTS descricao TEXT;
ALTER TABLE feature_flags ADD COLUMN IF NOT EXISTS publica BOOLEAN DEFAULT false;

-- Flags para controle do e-commerce
INSERT INTO feature_flags (flag, habilitado, descricao, publica) VALUES
  ('checkout', false, 'Habilita carrinho, checkout e pagamento Pix na loja', true),
  ('pagina_produto', true, 'Habilita página individual de produto (/produto/:id)', true),
  ('frete_calculadora', true, 'Habilita calculadora de frete nos produtos', true),
  ('banner_lgpd', false, 'Exibe banner de consentimento LGPD/cookies', true)
ON CONFLICT (flag) DO NOTHING;

-- Permitir leitura anon para flags públicas
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_read_public_flags' AND tablename = 'feature_flags') THEN
    CREATE POLICY "anon_read_public_flags" ON feature_flags FOR SELECT TO anon USING (publica = true);
  END IF;
END $$;
