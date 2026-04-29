-- Histórico de conversas do Hub IA
CREATE TABLE ia_conversas (
  id bigserial PRIMARY KEY,
  titulo text NOT NULL,
  mensagens jsonb NOT NULL DEFAULT '[]',
  provider text,
  modelo text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ia_conversas ENABLE ROW LEVEL SECURITY;
CREATE POLICY srv_ia_conversas ON ia_conversas USING (auth.role() = 'service_role');

CREATE TRIGGER set_updated_at_ia_conversas BEFORE UPDATE ON ia_conversas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_ia_conversas_updated ON ia_conversas(updated_at DESC);
