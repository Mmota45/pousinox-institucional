-- Orçamentos v2 — persistência completa, empresas emissoras, vendedores, anexos, watermark, rastreabilidade

-- Vendedores
CREATE TABLE IF NOT EXISTS vendedores (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome          TEXT NOT NULL,
  email         TEXT,
  telefone      TEXT,
  comissao_pct  NUMERIC(5,2) DEFAULT 0,  -- % de comissão padrão
  ativo         BOOLEAN DEFAULT TRUE,
  criado_em     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE vendedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role" ON vendedores USING (auth.role() = 'service_role');

-- Empresas emissoras (quem assina o orçamento)
CREATE TABLE IF NOT EXISTS empresas_emissoras (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome_fantasia TEXT NOT NULL,
  razao_social  TEXT,
  cnpj          TEXT,
  endereco      TEXT,
  telefone      TEXT,
  email         TEXT,
  site          TEXT,
  logo_url      TEXT,
  ativa         BOOLEAN DEFAULT TRUE,
  criado_em     TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO empresas_emissoras (nome_fantasia, razao_social, cnpj, endereco, telefone, email, site)
VALUES ('Pousinox', 'Pousinox Indústria Ltda', '', 'Pouso Alegre - MG', '(35) 3423-8994', 'adm@pousinox.com.br', 'pousinox.com.br');

-- Orçamentos
CREATE TABLE IF NOT EXISTS orcamentos (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  numero              TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'rascunho'
                        CHECK (status IN ('rascunho','enviado','aprovado','recusado','cancelado')),
  -- empresa emissora (snapshot — não muda se empresa for editada depois)
  empresa_id          BIGINT REFERENCES empresas_emissoras(id),
  empresa_nome        TEXT,
  empresa_cnpj        TEXT,
  empresa_endereco    TEXT,
  empresa_telefone    TEXT,
  empresa_email       TEXT,
  empresa_site        TEXT,
  empresa_logo_url    TEXT,
  -- cliente
  cliente_nome        TEXT,
  cliente_empresa     TEXT,
  cliente_cnpj        TEXT,
  cliente_telefone    TEXT,
  cliente_email       TEXT,
  cliente_endereco    TEXT,
  cliente_id          BIGINT,
  prospect_id         BIGINT,
  -- valores
  desconto            NUMERIC(14,4) DEFAULT 0,
  tipo_desconto       TEXT DEFAULT '%' CHECK (tipo_desconto IN ('%','R$')),
  subtotal            NUMERIC(14,2) DEFAULT 0,
  total               NUMERIC(14,2) DEFAULT 0,
  -- condições
  condicao_pagamento  TEXT,
  prazo_entrega       TEXT,
  validade_dias       INT DEFAULT 7,
  observacoes         TEXT,
  -- watermark
  watermark_ativo     BOOLEAN DEFAULT FALSE,
  watermark_texto     TEXT DEFAULT 'CONFIDENCIAL',
  -- vendedor responsável
  vendedor_id         BIGINT REFERENCES vendedores(id),
  vendedor_nome       TEXT,  -- snapshot
  -- integração
  fin_lancamento_id   BIGINT,
  -- meta
  criado_em           TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em       TIMESTAMPTZ DEFAULT NOW()
);

-- Itens
CREATE TABLE IF NOT EXISTS itens_orcamento (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  orcamento_id  BIGINT NOT NULL REFERENCES orcamentos(id) ON DELETE CASCADE,
  produto_id    BIGINT,
  descricao     TEXT NOT NULL DEFAULT '',
  qtd           NUMERIC(14,4) NOT NULL DEFAULT 1,
  unidade       TEXT DEFAULT 'UN',
  valor_unit    NUMERIC(14,4) NOT NULL DEFAULT 0,
  total         NUMERIC(14,2) DEFAULT 0,
  ordem         INT DEFAULT 0
);

-- Anexos
CREATE TABLE IF NOT EXISTS orcamentos_anexos (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  orcamento_id  BIGINT NOT NULL REFERENCES orcamentos(id) ON DELETE CASCADE,
  nome          TEXT NOT NULL,
  url           TEXT NOT NULL,
  tamanho       BIGINT,
  tipo          TEXT,
  criado_em     TIMESTAMPTZ DEFAULT NOW()
);

-- Histórico / rastreabilidade
CREATE TABLE IF NOT EXISTS orcamentos_historico (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  orcamento_id  BIGINT NOT NULL REFERENCES orcamentos(id) ON DELETE CASCADE,
  evento        TEXT NOT NULL,
  descricao     TEXT,
  criado_em     TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE empresas_emissoras   ENABLE ROW LEVEL SECURITY;
ALTER TABLE orcamentos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE itens_orcamento      ENABLE ROW LEVEL SECURITY;
ALTER TABLE orcamentos_anexos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE orcamentos_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role" ON empresas_emissoras   USING (auth.role() = 'service_role');
CREATE POLICY "service_role" ON orcamentos           USING (auth.role() = 'service_role');
CREATE POLICY "service_role" ON itens_orcamento      USING (auth.role() = 'service_role');
CREATE POLICY "service_role" ON orcamentos_anexos    USING (auth.role() = 'service_role');
CREATE POLICY "service_role" ON orcamentos_historico USING (auth.role() = 'service_role');

-- Trigger updated_at
CREATE TRIGGER set_updated_at_orcamentos
  BEFORE UPDATE ON orcamentos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Próximo número do ano
CREATE OR REPLACE FUNCTION next_orcamento_numero()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  ano TEXT := EXTRACT(YEAR FROM NOW())::TEXT;
  seq INT;
BEGIN
  SELECT COALESCE(MAX(CAST(split_part(numero, '/', 2) AS INT)), 0) + 1
  INTO seq FROM orcamentos WHERE numero LIKE ano || '/%';
  RETURN ano || '/' || LPAD(seq::TEXT, 3, '0');
END;
$$;
