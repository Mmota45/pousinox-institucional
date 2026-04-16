-- Contatos múltiplos por prospect (por área/cargo)
CREATE TABLE IF NOT EXISTS prospeccao_contatos (
  id          BIGSERIAL PRIMARY KEY,
  prospect_id BIGINT NOT NULL REFERENCES prospeccao(id) ON DELETE CASCADE,
  nome        TEXT,
  cargo       TEXT,
  telefone    TEXT,
  email       TEXT,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prosp_contatos_prospect ON prospeccao_contatos(prospect_id);

ALTER TABLE prospeccao_contatos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON prospeccao_contatos
  USING (auth.role() = 'service_role');
