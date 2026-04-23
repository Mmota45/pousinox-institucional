-- ══════════════════════════════════════════════════════════════════════════════
-- Qualidade — inspeções e não conformidades (fase base)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS inspecoes (
  id               bigserial PRIMARY KEY,
  tipo_origem      text NOT NULL DEFAULT 'manual'
                     CHECK (tipo_origem IN ('producao','fornecedor','estoque','documento','manual')),
  -- origem_id + origem_label: sem FK rígida — flexibilidade MVP
  -- origem_id referencia o id do registro de origem (ordem, fornecedor, etc.)
  -- origem_label preserva o contexto descritivo sem lookup em runtime
  origem_id        bigint,
  origem_label     text,
  item_descricao   text NOT NULL,
  criterio         text,
  resultado        text NOT NULL DEFAULT 'aprovado'
                     CHECK (resultado IN ('aprovado','reprovado')),
  data_inspecao    date NOT NULL DEFAULT CURRENT_DATE,
  responsavel      text,
  observacao       text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER inspecoes_updated_at
  BEFORE UPDATE ON inspecoes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_inspecoes_resultado   ON inspecoes(resultado);
CREATE INDEX IF NOT EXISTS idx_inspecoes_tipo_origem ON inspecoes(tipo_origem);
CREATE INDEX IF NOT EXISTS idx_inspecoes_data        ON inspecoes(data_inspecao);

ALTER TABLE inspecoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON inspecoes FOR ALL USING (auth.role() = 'service_role');

-- ── Não conformidades ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nao_conformidades (
  id              bigserial PRIMARY KEY,
  inspecao_id     bigint NOT NULL REFERENCES inspecoes(id) ON DELETE CASCADE,
  titulo          text NOT NULL,
  descricao       text,
  severidade      text NOT NULL DEFAULT 'media'
                    CHECK (severidade IN ('baixa','media','alta')),
  status          text NOT NULL DEFAULT 'aberta'
                    CHECK (status IN ('aberta','em_analise','tratada','fechada')),
  responsavel     text,
  acao_imediata   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER nao_conformidades_updated_at
  BEFORE UPDATE ON nao_conformidades
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_nc_inspecao   ON nao_conformidades(inspecao_id);
CREATE INDEX IF NOT EXISTS idx_nc_status     ON nao_conformidades(status);
CREATE INDEX IF NOT EXISTS idx_nc_severidade ON nao_conformidades(severidade);

ALTER TABLE nao_conformidades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON nao_conformidades FOR ALL USING (auth.role() = 'service_role');
