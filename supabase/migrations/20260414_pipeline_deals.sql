-- ══════════════════════════════════════════════════════════════════════════════
-- Pipeline comercial individual — deals por prospect/cliente
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Tabela principal de deals
CREATE TABLE IF NOT EXISTS pipeline_deals (
  id                bigserial PRIMARY KEY,
  titulo            text        NOT NULL,
  empresa_nome      text,
  empresa_cnpj      text,
  -- FKs opcionais para vinculação futura
  prospect_id       bigint      REFERENCES prospeccao(id) ON DELETE SET NULL,
  cliente_id        bigint      REFERENCES clientes(id)   ON DELETE SET NULL,
  estagio           text        NOT NULL DEFAULT 'entrada'
    CHECK (estagio IN ('entrada','qualificado','proposta','negociacao','ganho','perdido')),
  valor_estimado    numeric(12,2),
  observacao        text,
  motivo_perda      text,
  fin_lancamento_id bigint      REFERENCES fin_lancamentos(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER pipeline_deals_updated_at
  BEFORE UPDATE ON pipeline_deals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_pipeline_deals_estagio  ON pipeline_deals(estagio);
CREATE INDEX IF NOT EXISTS idx_pipeline_deals_prospect ON pipeline_deals(prospect_id) WHERE prospect_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pipeline_deals_cliente  ON pipeline_deals(cliente_id)  WHERE cliente_id  IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pipeline_deals_lanc     ON pipeline_deals(fin_lancamento_id) WHERE fin_lancamento_id IS NOT NULL;

-- RLS
ALTER TABLE pipeline_deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON pipeline_deals
  FOR ALL USING (auth.role() = 'service_role');

-- 2. Adiciona 'pipeline' como origem válida em fin_lancamentos
ALTER TABLE fin_lancamentos
  DROP CONSTRAINT IF EXISTS fin_lancamentos_origem_check;

ALTER TABLE fin_lancamentos
  ADD CONSTRAINT fin_lancamentos_origem_check
  CHECK (origem IN ('manual','venda','nf','projeto','sistema','pipeline'));
