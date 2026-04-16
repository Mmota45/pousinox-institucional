-- Tabela de log de documentos enviados com marca d'água rastreável
CREATE TABLE IF NOT EXISTS docs_enviados (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  watermark_id UUID NOT NULL DEFAULT gen_random_uuid(),
  tipo_doc     TEXT NOT NULL,           -- ex: 'ficha-tecnica', 'laudo', 'proposta'
  titulo       TEXT,
  empresa      TEXT NOT NULL,
  contato      TEXT,
  email        TEXT,
  observacao   TEXT,
  enviado_por  TEXT,                    -- usuário admin que gerou
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_docs_enviados_watermark ON docs_enviados (watermark_id);
CREATE INDEX idx_docs_enviados_criado_em ON docs_enviados (criado_em DESC);

ALTER TABLE docs_enviados ENABLE ROW LEVEL SECURITY;
CREATE POLICY docs_enviados_service ON docs_enviados USING (auth.role() = 'service_role');
