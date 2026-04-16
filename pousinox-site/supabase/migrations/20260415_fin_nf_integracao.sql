-- Integração Fiscal ↔ Financeiro
-- NFs emitidas → receitas / NFs recebidas → despesas

-- Remove colunas/tabela se existirem com tipo errado (idempotente)
DROP TABLE IF EXISTS fin_categoria_cnpj;
ALTER TABLE docs_fiscais
  DROP COLUMN IF EXISTS fin_lancamento_id,
  DROP COLUMN IF EXISTS fin_lancado;
ALTER TABLE fin_lancamentos
  DROP COLUMN IF EXISTS aguarda_categorizacao;

-- 1. Vínculo docs_fiscais → fin_lancamentos
ALTER TABLE docs_fiscais
  ADD COLUMN fin_lancamento_id BIGINT REFERENCES fin_lancamentos(id) ON DELETE SET NULL,
  ADD COLUMN fin_lancado BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_docs_fiscais_fin_lancamento
  ON docs_fiscais (fin_lancamento_id) WHERE fin_lancamento_id IS NOT NULL;

-- 2. Flag de categorização pendente em fin_lancamentos
ALTER TABLE fin_lancamentos
  ADD COLUMN aguarda_categorizacao BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_fin_lancamentos_aguarda
  ON fin_lancamentos (aguarda_categorizacao) WHERE aguarda_categorizacao = true;

-- 3. Memória CNPJ → categoria (aprendizado por uso)
CREATE TABLE fin_categoria_cnpj (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cnpj            TEXT NOT NULL,
  tipo            TEXT NOT NULL CHECK (tipo IN ('receita', 'despesa')),
  categoria_id    BIGINT REFERENCES fin_categorias(id) ON DELETE SET NULL,
  centro_custo_id BIGINT REFERENCES fin_centros_custo(id) ON DELETE SET NULL,
  usos            INT NOT NULL DEFAULT 1,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cnpj, tipo)
);

CREATE INDEX IF NOT EXISTS idx_fin_categoria_cnpj_cnpj ON fin_categoria_cnpj (cnpj);

ALTER TABLE fin_categoria_cnpj ENABLE ROW LEVEL SECURITY;
CREATE POLICY fin_categoria_cnpj_admin ON fin_categoria_cnpj
  USING (auth.role() = 'service_role');

COMMENT ON TABLE fin_categoria_cnpj IS
  'Memória de categorização por CNPJ — aprendida quando usuário categoriza lançamento pendente';
COMMENT ON COLUMN fin_categoria_cnpj.usos IS
  'Incrementado a cada confirmação — CNPJs com mais usos têm categorização mais confiável';
