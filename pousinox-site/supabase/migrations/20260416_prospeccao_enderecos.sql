-- Endereços múltiplos por prospect (sede, obras, filiais)
CREATE TABLE IF NOT EXISTS prospeccao_enderecos (
  id          BIGSERIAL PRIMARY KEY,
  prospect_id BIGINT NOT NULL REFERENCES prospeccao(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL DEFAULT 'Sede' CHECK (tipo IN ('Sede','Obra','Filial','Outro')),
  logradouro  TEXT,
  bairro      TEXT,
  cidade      TEXT,
  uf          TEXT,
  cep         TEXT,
  observacao  TEXT,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prosp_enderecos_prospect ON prospeccao_enderecos(prospect_id);

ALTER TABLE prospeccao_enderecos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON prospeccao_enderecos
  USING (auth.role() = 'service_role');
