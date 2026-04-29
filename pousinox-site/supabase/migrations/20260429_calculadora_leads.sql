-- ══════════════════════════════════════════════════════════════════════════════
-- Calculadora — Leads com verificação WhatsApp OTP
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS calculadora_leads (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome           TEXT NOT NULL,
  whatsapp       TEXT NOT NULL,
  email          TEXT,
  empresa        TEXT,
  cep            TEXT,
  endereco       TEXT,
  -- OTP
  otp_codigo     TEXT,
  otp_expira     TIMESTAMPTZ,
  otp_tentativas INT NOT NULL DEFAULT 0,
  verificado     BOOLEAN NOT NULL DEFAULT false,
  -- tracking
  calculos       INT NOT NULL DEFAULT 0,
  ultimo_calculo TIMESTAMPTZ,
  ip             TEXT,
  user_agent     TEXT,
  -- meta
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice por whatsapp para lookup rápido
CREATE INDEX IF NOT EXISTS idx_calc_leads_whatsapp ON calculadora_leads (whatsapp);

-- RLS: anon pode inserir/atualizar (público), service_role acesso total
ALTER TABLE calculadora_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_insert_calc_leads" ON calculadora_leads
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_select_calc_leads" ON calculadora_leads
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_update_calc_leads" ON calculadora_leads
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "service_role_calc_leads" ON calculadora_leads
  USING (auth.role() = 'service_role');

CREATE TRIGGER set_updated_at_calc_leads
  BEFORE UPDATE ON calculadora_leads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
