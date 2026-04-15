-- ── Módulo Bens/Frota ─────────────────────────────────────────────────────────
-- Operacional e gerencial — sem depreciação contábil, GPS ou telemetria.
--
-- Aba Vencimentos é visão DERIVADA: calcula próximos vencimentos a partir
-- de bens_frota_custos (tipo: ipva, seguro, licenciamento) e
-- bens_frota_manutencoes (data_prevista futura). Sem tabela própria.
-- ──────────────────────────────────────────────────────────────────────────────

-- Sequence para código BF-XXXX
CREATE SEQUENCE IF NOT EXISTS bens_frota_codigo_seq START 1;

-- ── 1. Cadastro mestre ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bens_frota (
  id               BIGSERIAL PRIMARY KEY,
  codigo           TEXT        NOT NULL DEFAULT 'BF-' || LPAD(nextval('bens_frota_codigo_seq')::text, 4, '0'),
  tipo             TEXT        NOT NULL CHECK (tipo IN ('veiculo','maquina','equipamento','imovel','outro')),
  nome             TEXT        NOT NULL,
  descricao        TEXT        NULL,
  fabricante       TEXT        NULL,
  modelo           TEXT        NULL,
  ano_fabricacao   SMALLINT    NULL,
  ano_aquisicao    SMALLINT    NULL,
  numero_serie     TEXT        NULL,
  placa            TEXT        NULL,
  renavam          TEXT        NULL,
  chassi           TEXT        NULL,
  status           TEXT        NOT NULL DEFAULT 'ativo'
                               CHECK (status IN ('ativo','inativo','em_manutencao','vendido','sucata')),
  centro_custo_id  BIGINT      NULL REFERENCES fin_centros_custo(id) ON DELETE SET NULL,
  valor_aquisicao  NUMERIC(14,2) NULL,
  data_aquisicao   DATE        NULL,
  localizacao      TEXT        NULL,
  responsavel      TEXT        NULL,
  foto_url         TEXT        NULL,
  observacao       TEXT        NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bens_frota_codigo_unique UNIQUE (codigo)
);

CREATE TRIGGER bens_frota_updated_at
  BEFORE UPDATE ON bens_frota
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Índices
CREATE INDEX IF NOT EXISTS bens_frota_status_idx         ON bens_frota (status);
CREATE INDEX IF NOT EXISTS bens_frota_tipo_idx           ON bens_frota (tipo);
CREATE INDEX IF NOT EXISTS bens_frota_centro_custo_idx   ON bens_frota (centro_custo_id);

-- ── 2. Custos ─────────────────────────────────────────────────────────────────
-- Qualquer despesa associada ao bem. fin_lancamento_id é opcional:
-- se preenchido, indica que já foi registrado no financeiro.
CREATE TABLE IF NOT EXISTS bens_frota_custos (
  id                 BIGSERIAL PRIMARY KEY,
  bem_id             BIGINT      NOT NULL REFERENCES bens_frota(id) ON DELETE CASCADE,
  tipo_custo         TEXT        NOT NULL
                     CHECK (tipo_custo IN ('combustivel','seguro','ipva','licenciamento','pneu','revisao','reparo','multa','outro')),
  descricao          TEXT        NOT NULL,
  valor              NUMERIC(14,2) NOT NULL DEFAULT 0,
  data_custo         DATE        NOT NULL,
  fin_lancamento_id  BIGINT      NULL REFERENCES fin_lancamentos(id) ON DELETE SET NULL,
  observacao         TEXT        NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bens_frota_custos_bem_idx    ON bens_frota_custos (bem_id);
CREATE INDEX IF NOT EXISTS bens_frota_custos_data_idx   ON bens_frota_custos (data_custo DESC);
CREATE INDEX IF NOT EXISTS bens_frota_custos_tipo_idx   ON bens_frota_custos (tipo_custo);

-- ── 3. Manutenções ────────────────────────────────────────────────────────────
-- Agenda e histórico. om_referencia é referência textual livre (ex: "OM-0042")
-- ao módulo AdminManutencao — sem FK para preservar independência dos módulos.
CREATE TABLE IF NOT EXISTS bens_frota_manutencoes (
  id                 BIGSERIAL PRIMARY KEY,
  bem_id             BIGINT      NOT NULL REFERENCES bens_frota(id) ON DELETE CASCADE,
  tipo               TEXT        NOT NULL CHECK (tipo IN ('preventiva','corretiva','revisao')),
  descricao          TEXT        NOT NULL,
  status             TEXT        NOT NULL DEFAULT 'agendada'
                                 CHECK (status IN ('agendada','em_execucao','concluida','cancelada')),
  data_prevista      DATE        NULL,
  data_realizada     DATE        NULL,
  km_previsto        INT         NULL,
  km_realizado       INT         NULL,
  custo_realizado    NUMERIC(14,2) NULL,
  om_referencia      TEXT        NULL,  -- referência livre a OM-XXXX
  fin_lancamento_id  BIGINT      NULL REFERENCES fin_lancamentos(id) ON DELETE SET NULL,
  observacao         TEXT        NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER bens_frota_manutencoes_updated_at
  BEFORE UPDATE ON bens_frota_manutencoes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS bens_frota_manut_bem_idx     ON bens_frota_manutencoes (bem_id);
CREATE INDEX IF NOT EXISTS bens_frota_manut_status_idx  ON bens_frota_manutencoes (status);
CREATE INDEX IF NOT EXISTS bens_frota_manut_data_idx    ON bens_frota_manutencoes (data_prevista ASC NULLS LAST);

-- ── 4. Alocações ──────────────────────────────────────────────────────────────
-- data_fim NULL = bem em uso. projeto_id é FK opcional para projetos.
CREATE TABLE IF NOT EXISTS bens_frota_alocacoes (
  id              BIGSERIAL PRIMARY KEY,
  bem_id          BIGINT      NOT NULL REFERENCES bens_frota(id) ON DELETE CASCADE,
  projeto_id      BIGINT      NULL REFERENCES projetos(id) ON DELETE SET NULL,
  descricao_uso   TEXT        NOT NULL,
  data_inicio     DATE        NOT NULL,
  data_fim        DATE        NULL,   -- NULL = alocação ativa
  responsavel     TEXT        NULL,
  observacao      TEXT        NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bens_frota_aloc_bem_idx      ON bens_frota_alocacoes (bem_id);
CREATE INDEX IF NOT EXISTS bens_frota_aloc_ativo_idx    ON bens_frota_alocacoes (bem_id) WHERE data_fim IS NULL;
CREATE INDEX IF NOT EXISTS bens_frota_aloc_projeto_idx  ON bens_frota_alocacoes (projeto_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE bens_frota             ENABLE ROW LEVEL SECURITY;
ALTER TABLE bens_frota_custos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE bens_frota_manutencoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bens_frota_alocacoes   ENABLE ROW LEVEL SECURITY;

CREATE POLICY bens_frota_srole             ON bens_frota             USING (auth.role() = 'service_role');
CREATE POLICY bens_frota_custos_srole      ON bens_frota_custos      USING (auth.role() = 'service_role');
CREATE POLICY bens_frota_manut_srole       ON bens_frota_manutencoes USING (auth.role() = 'service_role');
CREATE POLICY bens_frota_alocacoes_srole   ON bens_frota_alocacoes   USING (auth.role() = 'service_role');
