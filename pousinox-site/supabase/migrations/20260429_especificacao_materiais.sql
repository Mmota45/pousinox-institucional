-- ══════════════════════════════════════════════════════════════════════════════
-- Especificação Técnica de Materiais — V1
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Cadastro técnico dos modelos de fixador
CREATE TABLE IF NOT EXISTS fixador_modelos (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome          TEXT NOT NULL,
  sku           TEXT,
  material      TEXT NOT NULL DEFAULT 'Aço Inox 304',
  espessura_mm  NUMERIC(4,2),
  acabamento    TEXT DEFAULT 'Natural',
  obs_tecnica   TEXT,
  ativo         BOOLEAN NOT NULL DEFAULT true,
  -- laudo
  possui_laudo     BOOLEAN NOT NULL DEFAULT false,
  laudo_numero     TEXT,
  laudo_laboratorio TEXT,
  laudo_data       DATE,
  laudo_resumo     TEXT,
  -- meta
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE fixador_modelos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_fixador_modelos" ON fixador_modelos
  USING (auth.role() = 'service_role');

CREATE TRIGGER set_updated_at_fixador_modelos
  BEFORE UPDATE ON fixador_modelos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2. Regras de cálculo configuráveis (faixas)
CREATE TABLE IF NOT EXISTS fixador_regras_calculo (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  modelo_id        BIGINT REFERENCES fixador_modelos(id) ON DELETE SET NULL,
  nome             TEXT NOT NULL,
  lado_max_cm      NUMERIC(8,2),
  area_max_cm2     NUMERIC(10,2),
  peso_max_kg      NUMERIC(8,2),
  fixadores_por_peca INT NOT NULL DEFAULT 2,
  exige_revisao    BOOLEAN NOT NULL DEFAULT false,
  prioridade       INT NOT NULL DEFAULT 0,
  ativo            BOOLEAN NOT NULL DEFAULT true,
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE fixador_regras_calculo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_fixador_regras" ON fixador_regras_calculo
  USING (auth.role() = 'service_role');

-- 3. Consumíveis derivados (proporções configuráveis)
CREATE TABLE IF NOT EXISTS fixador_consumiveis (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome          TEXT NOT NULL,
  tipo          TEXT NOT NULL DEFAULT 'consumivel',  -- consumivel | acessorio (futuro gabarito)
  unidade       TEXT NOT NULL DEFAULT 'UN',
  proporcao_por INT NOT NULL DEFAULT 1,   -- 1 a cada N fixadores
  ativo         BOOLEAN NOT NULL DEFAULT true,
  ordem         INT NOT NULL DEFAULT 0,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE fixador_consumiveis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_fixador_consumiveis" ON fixador_consumiveis
  USING (auth.role() = 'service_role');

-- 4. Especificação vinculada ao orçamento
CREATE TABLE IF NOT EXISTS orcamento_especificacoes (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  orcamento_id     BIGINT NOT NULL REFERENCES orcamentos(id) ON DELETE CASCADE,
  modelo_id        BIGINT REFERENCES fixador_modelos(id) ON DELETE SET NULL,
  -- obra
  area_total_m2    NUMERIC(10,2) NOT NULL,
  -- revestimento
  largura_cm       NUMERIC(8,2) NOT NULL,
  altura_cm        NUMERIC(8,2) NOT NULL,
  peso_peca_kg     NUMERIC(8,3),
  peso_m2_kg       NUMERIC(8,3),
  espessura_mm     NUMERIC(6,2),
  perda_pct        NUMERIC(5,2) NOT NULL DEFAULT 10,
  -- resultado
  qtd_pecas        INT,
  fixadores_por_peca INT,
  total_fixadores  INT,
  revisao_tecnica  BOOLEAN NOT NULL DEFAULT false,
  revisao_motivos  TEXT[],
  obs              TEXT,
  -- meta
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE orcamento_especificacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_orc_especificacoes" ON orcamento_especificacoes
  USING (auth.role() = 'service_role');

CREATE TRIGGER set_updated_at_orc_especificacoes
  BEFORE UPDATE ON orcamento_especificacoes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 5. Itens calculados da especificação
CREATE TABLE IF NOT EXISTS orcamento_especificacao_itens (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  especificacao_id BIGINT NOT NULL REFERENCES orcamento_especificacoes(id) ON DELETE CASCADE,
  nome             TEXT NOT NULL,
  quantidade       INT NOT NULL,
  unidade          TEXT NOT NULL DEFAULT 'UN',
  tipo             TEXT NOT NULL DEFAULT 'fixador', -- fixador | parafuso | bucha | adesivo | disco | broca | acessorio
  inserido_orcamento BOOLEAN NOT NULL DEFAULT false,
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE orcamento_especificacao_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_orc_espec_itens" ON orcamento_especificacao_itens
  USING (auth.role() = 'service_role');

-- ══════════════════════════════════════════════════════════════════════════════
-- Seed — Modelos iniciais
-- ══════════════════════════════════════════════════════════════════════════════

INSERT INTO fixador_modelos (nome, sku, material, espessura_mm, acabamento, obs_tecnica, possui_laudo, laudo_laboratorio, laudo_resumo) VALUES
  ('Fixador Padrão Inox 304', 'FIX-304-STD', 'Aço Inox 304', 0.43, 'Natural',
   'Modelo padrão para porcelanatos de piso e parede em áreas internas e externas.',
   true, 'SENAI LAMAT', 'Ensaio mecânico de chapa — material com rastreabilidade técnica'),
  ('Fixador Reforçado Inox 304', 'FIX-304-REF', 'Aço Inox 304', 0.50, 'Natural',
   'Modelo reforçado para porcelanatos de grande formato ou áreas com maior solicitação.',
   true, 'SENAI LAMAT', 'Ensaio mecânico de chapa — material com rastreabilidade técnica'),
  ('Fixador Inox 430', 'FIX-430-STD', 'Aço Inox 430', 0.43, 'Natural',
   'Modelo econômico para áreas internas sem exposição à umidade.',
   false, NULL, NULL);

-- ══════════════════════════════════════════════════════════════════════════════
-- Seed — Regras de cálculo padrão (genéricas, modelo_id NULL = todas)
-- ══════════════════════════════════════════════════════════════════════════════

INSERT INTO fixador_regras_calculo (modelo_id, nome, lado_max_cm, area_max_cm2, peso_max_kg, fixadores_por_peca, exige_revisao, prioridade) VALUES
  (NULL, 'Peça padrão (até 60×60)',    60,   3600,  NULL, 2, false, 10),
  (NULL, 'Peça retangular (até 120cm)', 120, 7200,  NULL, 2, false, 20),
  (NULL, 'Peça grande (até 150cm)',    150, 13500,  NULL, 3, false, 30),
  (NULL, 'Fora da faixa padrão',       NULL, NULL,  NULL, 3, true,  99);

-- ══════════════════════════════════════════════════════════════════════════════
-- Seed — Consumíveis padrão
-- ══════════════════════════════════════════════════════════════════════════════

INSERT INTO fixador_consumiveis (nome, tipo, unidade, proporcao_por, ordem) VALUES
  ('Fixador / Grampo',  'fixador',    'UN',  1,   1),
  ('Parafuso',          'consumivel', 'UN',  1,   2),
  ('Bucha',             'consumivel', 'UN',  1,   3),
  ('Adesivo PU/MS',     'consumivel', 'UN',  90,  4),
  ('Disco de Corte',    'consumivel', 'UN',  90,  5),
  ('Broca',             'consumivel', 'UN',  150, 6);

-- Feature flag — calculadora pública desabilitada por padrão
INSERT INTO feature_flags (flag, habilitado, descricao)
VALUES ('calculadora_fixador', false, 'Calculadora de materiais na página pública /fixador-porcelanato/calculadora')
ON CONFLICT (flag) DO NOTHING;
