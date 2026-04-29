-- Laudos protegidos: colunas extras em docs_enviados
ALTER TABLE docs_enviados
  ADD COLUMN IF NOT EXISTS cnpj           TEXT,
  ADD COLUMN IF NOT EXISTS senha_hash     TEXT,           -- bcrypt hash da senha
  ADD COLUMN IF NOT EXISTS storage_path   TEXT,           -- path no bucket privado
  ADD COLUMN IF NOT EXISTS expira_em      TIMESTAMPTZ,    -- link expira após este timestamp
  ADD COLUMN IF NOT EXISTS downloads      INT DEFAULT 0,  -- contagem de downloads
  ADD COLUMN IF NOT EXISTS max_downloads  INT DEFAULT 5,  -- limite de downloads
  ADD COLUMN IF NOT EXISTS status         TEXT DEFAULT 'ativo', -- ativo | expirado | revogado
  ADD COLUMN IF NOT EXISTS canal_envio    TEXT;            -- email | whatsapp | link | presencial

-- Bucket privado para laudos protegidos
INSERT INTO storage.buckets (id, name, public)
VALUES ('laudos-protegidos', 'laudos-protegidos', false)
ON CONFLICT DO NOTHING;

-- Bucket para laudos base (originais)
INSERT INTO storage.buckets (id, name, public)
VALUES ('laudos', 'laudos', false)
ON CONFLICT DO NOTHING;

-- Policy: só service_role acessa os buckets
CREATE POLICY laudos_prot_service ON storage.objects
  FOR ALL USING (bucket_id = 'laudos-protegidos' AND auth.role() = 'service_role');

CREATE POLICY laudos_base_service ON storage.objects
  FOR ALL USING (bucket_id = 'laudos' AND auth.role() = 'service_role');

-- Referência ao orçamento (para propostas protegidas)
ALTER TABLE docs_enviados
  ADD COLUMN IF NOT EXISTS orcamento_id BIGINT REFERENCES orcamentos(id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_docs_enviados_status ON docs_enviados (status);
CREATE INDEX IF NOT EXISTS idx_docs_enviados_cnpj ON docs_enviados (cnpj);
CREATE INDEX IF NOT EXISTS idx_docs_enviados_orcamento ON docs_enviados (orcamento_id);
