-- Refatoração orçamento v2 → proposta comercial B2B
-- Novos campos no cliente, frete, instalação, visibilidade

-- Campos adicionais do cliente
ALTER TABLE orcamentos
  ADD COLUMN IF NOT EXISTS cliente_tipo_pessoa   TEXT DEFAULT 'pj' CHECK (cliente_tipo_pessoa IN ('pf','pj')),
  ADD COLUMN IF NOT EXISTS cliente_whatsapp      TEXT,
  ADD COLUMN IF NOT EXISTS cliente_cargo         TEXT,
  ADD COLUMN IF NOT EXISTS cliente_inscricao_est TEXT,
  ADD COLUMN IF NOT EXISTS cliente_cep           TEXT,
  ADD COLUMN IF NOT EXISTS cliente_cidade        TEXT,
  ADD COLUMN IF NOT EXISTS cliente_uf            TEXT,
  ADD COLUMN IF NOT EXISTS cliente_endereco_ent  TEXT;  -- endereço de entrega separado

-- Frete
ALTER TABLE orcamentos
  ADD COLUMN IF NOT EXISTS frete_tipo   TEXT DEFAULT '' CHECK (frete_tipo IN ('','CIF','FOB','retirada','cliente','a_combinar')),
  ADD COLUMN IF NOT EXISTS frete_valor  NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS frete_prazo  TEXT,
  ADD COLUMN IF NOT EXISTS frete_obs    TEXT;

-- Instalação/montagem
ALTER TABLE orcamentos
  ADD COLUMN IF NOT EXISTS inst_inclui  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS inst_texto   TEXT,
  ADD COLUMN IF NOT EXISTS inst_valor   NUMERIC(14,2) DEFAULT 0;

-- Campos internos
ALTER TABLE orcamentos
  ADD COLUMN IF NOT EXISTS obs_internas TEXT,
  ADD COLUMN IF NOT EXISTS origem_lead  TEXT;

-- Configuração de visibilidade da proposta (JSON)
ALTER TABLE orcamentos
  ADD COLUMN IF NOT EXISTS exibir_config JSONB DEFAULT '{}';

-- Obs. técnica por item
ALTER TABLE itens_orcamento
  ADD COLUMN IF NOT EXISTS obs_tecnica TEXT;
