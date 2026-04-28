-- Evoluir frete_proprio_config → frete_config
ALTER TABLE frete_proprio_config
  ADD COLUMN IF NOT EXISTS horario_corte_transportadora TIME NOT NULL DEFAULT '15:00',
  ADD COLUMN IF NOT EXISTS nome TEXT NOT NULL DEFAULT 'Configuração Padrão';

ALTER TABLE frete_proprio_config RENAME TO frete_config;

-- Tabela de regras condicionais de frete
CREATE TABLE frete_regras (
  id BIGSERIAL PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('frete_gratis','desconto_pct','desconto_fixo','acrescimo_fixo','bloqueio')),
  descricao TEXT NOT NULL,
  condicao_estados TEXT[],
  condicao_produto_id BIGINT,
  condicao_categoria TEXT,
  condicao_valor_min NUMERIC(14,2),
  condicao_valor_max NUMERIC(14,2),
  valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  prioridade INT NOT NULL DEFAULT 10,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE frete_regras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "frete_regras_service" ON frete_regras USING (auth.role() = 'service_role');
CREATE POLICY "frete_regras_anon_read" ON frete_regras FOR SELECT USING (true);

CREATE TRIGGER set_frete_regras_updated_at BEFORE UPDATE ON frete_regras
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
