-- Endereço estruturado principal
ALTER TABLE orcamentos
  ADD COLUMN IF NOT EXISTS cliente_logradouro  TEXT,
  ADD COLUMN IF NOT EXISTS cliente_numero      TEXT,
  ADD COLUMN IF NOT EXISTS cliente_complemento TEXT,
  ADD COLUMN IF NOT EXISTS cliente_bairro      TEXT;

-- Endereço de entrega estruturado
ALTER TABLE orcamentos
  ADD COLUMN IF NOT EXISTS cliente_ent_cep         TEXT,
  ADD COLUMN IF NOT EXISTS cliente_ent_logradouro  TEXT,
  ADD COLUMN IF NOT EXISTS cliente_ent_numero      TEXT,
  ADD COLUMN IF NOT EXISTS cliente_ent_complemento TEXT,
  ADD COLUMN IF NOT EXISTS cliente_ent_bairro      TEXT,
  ADD COLUMN IF NOT EXISTS cliente_ent_cidade      TEXT,
  ADD COLUMN IF NOT EXISTS cliente_ent_uf          TEXT;

-- Frete e instalação: modalidade comercial
ALTER TABLE orcamentos
  ADD COLUMN IF NOT EXISTS frete_modalidade TEXT DEFAULT 'cobrar'
    CHECK (frete_modalidade IN ('cobrar','bonus')),
  ADD COLUMN IF NOT EXISTS inst_modalidade  TEXT DEFAULT 'cobrar'
    CHECK (inst_modalidade IN ('cobrar','bonus'));

-- Watermark com logo
ALTER TABLE orcamentos
  ADD COLUMN IF NOT EXISTS watermark_logo BOOLEAN DEFAULT FALSE;

-- Rastreamento de links por destinatário
CREATE TABLE IF NOT EXISTS orcamento_links (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id  BIGINT NOT NULL REFERENCES orcamentos(id) ON DELETE CASCADE,
  token         UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  destinatario  TEXT,
  criado_em     TIMESTAMPTZ DEFAULT now(),
  primeiro_acesso TIMESTAMPTZ,
  ultimo_acesso   TIMESTAMPTZ,
  visualizacoes   INT DEFAULT 0,
  downloads       INT DEFAULT 0,
  ip              TEXT,
  user_agent      TEXT,
  ativo           BOOLEAN DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_orc_links_orcamento ON orcamento_links(orcamento_id);
CREATE INDEX IF NOT EXISTS idx_orc_links_token     ON orcamento_links(token);
ALTER TABLE orcamento_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role only" ON orcamento_links USING (auth.role() = 'service_role');
-- Public read via token (for the view page)
CREATE POLICY "public read by token" ON orcamento_links FOR SELECT USING (true);
CREATE POLICY "public update via token" ON orcamento_links FOR UPDATE USING (true);
