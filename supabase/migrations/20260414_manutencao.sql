-- ══════════════════════════════════════════════════════════════════════════════
-- Manutenção — ativos e ordens de manutenção (fase base)
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Ativos / Equipamentos ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ativos (
  id           bigserial PRIMARY KEY,
  codigo       text,                          -- código interno (ex: EQ-001)
  nome         text NOT NULL,
  categoria    text,                          -- ex: torno, prensa, compressor
  localizacao  text,                          -- ex: setor A, linha 2
  fabricante   text,
  modelo       text,
  status       text NOT NULL DEFAULT 'ativo'
                 CHECK (status IN ('ativo','inativo','manutencao')),
  observacao   text,
  -- Campo reservado para planos preventivos futuros (sem implementar agora)
  -- plano_id bigint REFERENCES planos_preventivos(id)
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER ativos_updated_at
  BEFORE UPDATE ON ativos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_ativos_status    ON ativos(status);
CREATE INDEX IF NOT EXISTS idx_ativos_categoria ON ativos(categoria);

ALTER TABLE ativos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON ativos FOR ALL USING (auth.role() = 'service_role');

-- ── Ordens de Manutenção ──────────────────────────────────────────────────────

-- Sequence dedicada — nextval é atômico no PostgreSQL, sem colisão em inserts simultâneos
CREATE SEQUENCE IF NOT EXISTS ordens_manutencao_numero_seq START 1;

CREATE TABLE IF NOT EXISTS ordens_manutencao (
  id               bigserial PRIMARY KEY,
  numero           text NOT NULL UNIQUE
                     DEFAULT 'OM-' || LPAD(nextval('ordens_manutencao_numero_seq')::text, 4, '0'),
  ativo_id         bigint REFERENCES ativos(id) ON DELETE SET NULL,
  tipo             text NOT NULL DEFAULT 'corretiva'
                     CHECK (tipo IN ('corretiva','preventiva')),
  titulo           text NOT NULL,
  descricao        text,
  prioridade       text NOT NULL DEFAULT 'media'
                     CHECK (prioridade IN ('baixa','media','alta')),
  status           text NOT NULL DEFAULT 'aberta'
                     CHECK (status IN ('aberta','em_execucao','concluida','cancelada')),
  data_abertura    date NOT NULL DEFAULT CURRENT_DATE,
  data_programada  date,
  data_conclusao   date,
  responsavel      text,
  observacao       text,
  -- Reservado para futura ligação com planos preventivos
  -- plano_id bigint REFERENCES planos_preventivos(id)
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER ordens_manutencao_updated_at
  BEFORE UPDATE ON ordens_manutencao
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_om_status    ON ordens_manutencao(status);
CREATE INDEX IF NOT EXISTS idx_om_tipo      ON ordens_manutencao(tipo);
CREATE INDEX IF NOT EXISTS idx_om_ativo     ON ordens_manutencao(ativo_id) WHERE ativo_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_om_data      ON ordens_manutencao(data_programada);

ALTER TABLE ordens_manutencao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON ordens_manutencao FOR ALL USING (auth.role() = 'service_role');
