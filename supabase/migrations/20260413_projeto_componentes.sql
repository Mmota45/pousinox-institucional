-- ── 1. Colunas novas na tabela projetos ──────────────────────────────────────
ALTER TABLE projetos
  ADD COLUMN IF NOT EXISTS projetista    text,
  ADD COLUMN IF NOT EXISTS revisao       text,
  ADD COLUMN IF NOT EXISTS norma         text,
  ADD COLUMN IF NOT EXISTS escala        text,
  ADD COLUMN IF NOT EXISTS data_projeto  date;

-- ── 2. Tabela de componentes ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projeto_componentes (
  id          bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  projeto_id  bigint NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
  nome        text   NOT NULL,
  quantidade  numeric,
  ordem       int    NOT NULL DEFAULT 0,
  criado_em   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projeto_componentes_projeto
  ON projeto_componentes(projeto_id);

-- ── 3. Atributos por componente ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projeto_componente_atributos (
  id             bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  componente_id  bigint NOT NULL REFERENCES projeto_componentes(id) ON DELETE CASCADE,
  chave          text   NOT NULL,
  valor          text   NOT NULL,
  valor_num      numeric,
  unidade        text
);

CREATE INDEX IF NOT EXISTS idx_pca_componente
  ON projeto_componente_atributos(componente_id);

-- ── 4. RLS — mesma política dos outros: admin only ────────────────────────────
ALTER TABLE projeto_componentes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE projeto_componente_atributos    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all" ON projeto_componentes
  USING (auth.role() = 'service_role');

CREATE POLICY "admin_all" ON projeto_componente_atributos
  USING (auth.role() = 'service_role');
