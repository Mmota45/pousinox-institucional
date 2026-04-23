-- Tabela de prospects gerados a partir da base CNPJ da Receita Federal
-- Execute no SQL Editor do Supabase

CREATE TABLE IF NOT EXISTS prospeccao (
  id              BIGSERIAL PRIMARY KEY,
  cnpj            TEXT NOT NULL UNIQUE,
  razao_social    TEXT,
  nome_fantasia   TEXT,
  porte           TEXT,
  segmento        TEXT,          -- ex: Restaurantes, Padarias, Hospitalar...
  produto         TEXT,          -- Equipamentos Inox | Fixador Porcelanato
  cnae            TEXT,
  uf              TEXT,
  cidade          TEXT,
  bairro          TEXT,
  endereco        TEXT,
  cep             TEXT,
  telefone1       TEXT,
  telefone2       TEXT,
  email           TEXT,
  contatado       BOOLEAN DEFAULT false,
  contato_em      TIMESTAMPTZ,
  observacao      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para filtros frequentes
CREATE INDEX IF NOT EXISTS idx_prospeccao_segmento ON prospeccao(segmento);
CREATE INDEX IF NOT EXISTS idx_prospeccao_produto  ON prospeccao(produto);
CREATE INDEX IF NOT EXISTS idx_prospeccao_uf       ON prospeccao(uf);
CREATE INDEX IF NOT EXISTS idx_prospeccao_cidade   ON prospeccao(cidade);
CREATE INDEX IF NOT EXISTS idx_prospeccao_contatado ON prospeccao(contatado);

-- Segurança: apenas service role pode inserir/atualizar
ALTER TABLE prospeccao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all" ON prospeccao
  FOR ALL
  USING (true)
  WITH CHECK (true);
