CREATE TABLE IF NOT EXISTS orcamento_link_acessos (
  id           BIGSERIAL PRIMARY KEY,
  link_id      UUID NOT NULL REFERENCES orcamento_links(id) ON DELETE CASCADE,
  acessado_em  TIMESTAMPTZ DEFAULT now(),
  ip           TEXT,
  user_agent   TEXT
);
CREATE INDEX IF NOT EXISTS idx_orc_link_acessos_link ON orcamento_link_acessos(link_id);
ALTER TABLE orcamento_link_acessos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role only" ON orcamento_link_acessos USING (auth.role() = 'service_role');
CREATE POLICY "public insert" ON orcamento_link_acessos FOR INSERT WITH CHECK (true);
