-- ── Dados Bancários (pré-cadastro para orçamentos) ──────────────────────────

CREATE TABLE dados_bancarios (
  id BIGSERIAL PRIMARY KEY,
  apelido TEXT NOT NULL,                          -- "Bradesco PJ", "PIX CNPJ"
  banco TEXT,                                     -- "Bradesco", "Itaú", etc
  agencia TEXT,
  conta TEXT,
  tipo_conta TEXT DEFAULT 'corrente',             -- corrente, poupanca
  pix_chave TEXT,                                 -- chave PIX (CNPJ, email, telefone, aleatória)
  pix_tipo TEXT,                                  -- cnpj, cpf, email, telefone, aleatoria
  titular TEXT,                                   -- "Pousinox Ind. Com. LTDA"
  cnpj_titular TEXT,
  observacao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INT NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE dados_bancarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dados_bancarios_admin" ON dados_bancarios USING (auth.role() = 'service_role');

-- Trigger updated_at
CREATE TRIGGER set_dados_bancarios_updated_at
  BEFORE UPDATE ON dados_bancarios
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Coluna no orçamento para guardar IDs das contas selecionadas
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS dados_bancarios_ids BIGINT[] DEFAULT '{}';
