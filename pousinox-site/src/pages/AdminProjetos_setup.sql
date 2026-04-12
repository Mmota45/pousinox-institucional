-- ============================================================
-- PROJECT-FIRST FASE 1 — SQL COMPLETO
-- Execute tudo de uma vez no SQL Editor do Supabase
-- ============================================================

-- ── Funções utilitárias ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION normalizar_chave(p_chave text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(trim(regexp_replace(
    translate(p_chave,
      'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
      'aaaaaeeeeiiiioooooouuuucnAAAAEEEEIIIIOOOOOUUUUCN'
    ),
    '[^a-zA-Z0-9]+', '_', 'g'
  )));
$$;

-- ── Catálogo de atributos ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS atributos_catalogo (
  id              serial PRIMARY KEY,
  chave           text UNIQUE NOT NULL
                    CHECK (chave = lower(trim(chave)) AND chave ~ '^[a-z][a-z0-9_]*$'),
  label_pt        text NOT NULL,
  tipo_valor      text NOT NULL
                    CHECK (tipo_valor IN ('numero','texto','enum','booleano')),
  unidade_padrao  text,
  valores_enum    text[],
  frequencia_uso  int NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'ativo'
                    CHECK (status IN ('ativo','pendente','inativo')),
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_catalogo_frequencia ON atributos_catalogo(frequencia_uso DESC);
CREATE INDEX IF NOT EXISTS idx_catalogo_status     ON atributos_catalogo(status);

-- Seed inicial
INSERT INTO atributos_catalogo (chave, label_pt, tipo_valor, unidade_padrao, valores_enum, status) VALUES
  ('material',       'Material',        'enum',   null,  ARRAY['AISI 304','AISI 316','AISI 430','AISI 201'], 'ativo'),
  ('espessura_mm',   'Espessura',       'numero', 'mm',  null,                                               'ativo'),
  ('comprimento_mm', 'Comprimento',     'numero', 'mm',  null,                                               'ativo'),
  ('largura_mm',     'Largura',         'numero', 'mm',  null,                                               'ativo'),
  ('altura_mm',      'Altura',          'numero', 'mm',  null,                                               'ativo'),
  ('acabamento',     'Acabamento',      'enum',   null,  ARRAY['escovado','polido','jateado','natural'],      'ativo'),
  ('solda',          'Tipo de Solda',   'enum',   null,  ARRAY['TIG','MIG','ponto','sem solda'],              'ativo'),
  ('quantidade',     'Quantidade',      'numero', 'un',  null,                                               'ativo'),
  ('peso_kg',        'Peso',            'numero', 'kg',  null,                                               'ativo'),
  ('norma',          'Norma',           'texto',  null,  null,                                               'ativo')
ON CONFLICT (chave) DO NOTHING;

-- ── Produtos padrão (cadastro mestre progressivo) ─────────────────────────────

CREATE TABLE IF NOT EXISTS produtos_padrao (
  id            serial PRIMARY KEY,
  codigo        text UNIQUE NOT NULL,
  nome          text NOT NULL,
  descricao     text,
  segmento      text,
  atributos     jsonb NOT NULL DEFAULT '{}',
  status        text NOT NULL DEFAULT 'rascunho'
                  CHECK (status IN ('rascunho','ativo','descontinuado')),
  aprovado_por  text,
  aprovado_em   timestamptz,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE OR REPLACE TRIGGER trg_produtos_padrao_updated_at
  BEFORE UPDATE ON produtos_padrao
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Projetos ──────────────────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS seq_projeto_num START 1;

CREATE TABLE IF NOT EXISTS projetos (
  id                serial PRIMARY KEY,
  codigo            text UNIQUE NOT NULL DEFAULT '',
  titulo            text NOT NULL CHECK (trim(titulo) <> ''),
  cliente_nome      text,
  cliente_cnpj      text,
  segmento          text CHECK (segmento IN (
                      'hospitalar','alimenticio','hotelaria','comercio',
                      'industrial','residencial','outro'
                    )),
  status            text NOT NULL DEFAULT 'em_andamento'
                      CHECK (status IN ('em_andamento','concluido','cancelado')),
  data_inicio       date,
  data_conclusao    date,
  CHECK (data_conclusao IS NULL OR data_conclusao >= data_inicio),
  valor_total       numeric(12,2) CHECK (valor_total IS NULL OR valor_total >= 0),
  observacoes       text,
  produto_padrao_id int REFERENCES produtos_padrao(id) ON DELETE SET NULL,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projetos_status         ON projetos(status);
CREATE INDEX IF NOT EXISTS idx_projetos_segmento       ON projetos(segmento);
CREATE INDEX IF NOT EXISTS idx_projetos_produto_padrao ON projetos(produto_padrao_id) WHERE produto_padrao_id IS NOT NULL;

CREATE OR REPLACE FUNCTION gerar_codigo_projeto()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.codigo IS NULL OR NEW.codigo = '' THEN
    NEW.codigo := 'PRJ-' || to_char(now(), 'YYYY') || '-'
                  || lpad(nextval('seq_projeto_num')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_codigo_projeto
  BEFORE INSERT ON projetos
  FOR EACH ROW EXECUTE FUNCTION gerar_codigo_projeto();

CREATE OR REPLACE TRIGGER trg_projetos_updated_at
  BEFORE UPDATE ON projetos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Atributos do projeto (EAV híbrido) ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS projeto_atributos (
  id          serial PRIMARY KEY,
  projeto_id  int NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
  chave       text NOT NULL CHECK (chave ~ '^[a-z_][a-z0-9_]*$'),
  valor       text NOT NULL CHECK (trim(valor) <> ''),
  valor_num   numeric,
  unidade     text,
  origem      text NOT NULL DEFAULT 'manual'
                CHECK (origem IN ('manual','sugerido','importado')),
  UNIQUE (projeto_id, chave)
);

CREATE INDEX IF NOT EXISTS idx_proj_attr_projeto   ON projeto_atributos(projeto_id);
CREATE INDEX IF NOT EXISTS idx_proj_attr_chave_val ON projeto_atributos(chave, valor);
CREATE INDEX IF NOT EXISTS idx_proj_attr_num       ON projeto_atributos(chave, valor_num)
  WHERE valor_num IS NOT NULL;

CREATE OR REPLACE FUNCTION processar_atributo()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_tipo text;
BEGIN
  -- 1. Normalizar chave
  NEW.chave := normalizar_chave(NEW.chave);
  IF NEW.chave ~ '^[0-9]' THEN NEW.chave := '_' || NEW.chave; END IF;

  -- 2. Preencher valor_num se catálogo diz que é número
  SELECT tipo_valor INTO v_tipo FROM atributos_catalogo WHERE chave = NEW.chave;
  IF v_tipo = 'numero' THEN
    BEGIN NEW.valor_num := NEW.valor::numeric;
    EXCEPTION WHEN others THEN NEW.valor_num := NULL; END;
  ELSE
    NEW.valor_num := NULL;
  END IF;

  -- 3. Upsert catálogo APENAS no INSERT (evita dupla contagem no UPDATE)
  IF TG_OP = 'INSERT' THEN
    INSERT INTO atributos_catalogo (chave, label_pt, tipo_valor, status)
    VALUES (
      NEW.chave,
      initcap(replace(NEW.chave, '_', ' ')),
      CASE WHEN NEW.valor_num IS NOT NULL THEN 'numero' ELSE 'texto' END,
      'pendente'
    )
    ON CONFLICT (chave) DO UPDATE
      SET frequencia_uso = atributos_catalogo.frequencia_uso + 1;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_processar_atributo
  BEFORE INSERT OR UPDATE ON projeto_atributos
  FOR EACH ROW EXECUTE FUNCTION processar_atributo();

-- ── Anexos do projeto ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS projeto_anexos (
  id              serial PRIMARY KEY,
  projeto_id      int NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
  tipo            text NOT NULL CHECK (tipo IN ('pdf','imagem','dwg','outro')),
  nome_original   text NOT NULL CHECK (trim(nome_original) <> ''),
  storage_path    text NOT NULL CHECK (storage_path <> ''),
  descricao       text,
  tamanho_bytes   int CHECK (tamanho_bytes IS NULL OR tamanho_bytes > 0),
  uploaded_at     timestamptz DEFAULT now(),
  uploaded_by     text
);

CREATE INDEX IF NOT EXISTS idx_anexos_projeto ON projeto_anexos(projeto_id);
CREATE INDEX IF NOT EXISTS idx_anexos_tipo    ON projeto_anexos(projeto_id, tipo);

-- ── Recorrências ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS recorrencias (
  id               serial PRIMARY KEY,
  hash_atributos   text UNIQUE NOT NULL,
  atributos_chave  jsonb NOT NULL,
  contagem         int NOT NULL DEFAULT 0 CHECK (contagem >= 0),
  status           text NOT NULL DEFAULT 'detectada'
                     CHECK (status IN ('detectada','em_analise','aprovada','rejeitada','convertida')),
  sugerido_em      timestamptz DEFAULT now(),
  analisado_em     timestamptz,
  analisado_por    text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recorrencias_status   ON recorrencias(status);
CREATE INDEX IF NOT EXISTS idx_recorrencias_contagem ON recorrencias(contagem DESC);

CREATE OR REPLACE TRIGGER trg_recorrencias_updated_at
  BEFORE UPDATE ON recorrencias
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS recorrencia_projetos (
  recorrencia_id  int NOT NULL REFERENCES recorrencias(id) ON DELETE CASCADE,
  projeto_id      int NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
  adicionado_em   timestamptz DEFAULT now(),
  PRIMARY KEY (recorrencia_id, projeto_id)
);

CREATE INDEX IF NOT EXISTS idx_rec_proj_projeto ON recorrencia_projetos(projeto_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE projetos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE projeto_atributos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE projeto_anexos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE atributos_catalogo   ENABLE ROW LEVEL SECURITY;
ALTER TABLE recorrencias         ENABLE ROW LEVEL SECURITY;
ALTER TABLE recorrencia_projetos ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos_padrao      ENABLE ROW LEVEL SECURITY;

-- Bloqueia acesso anônimo; service_role bypassa RLS automaticamente
CREATE POLICY "admin_projetos"            ON projetos             FOR ALL TO authenticated USING ((auth.jwt()->'app_metadata'->>'admin')::boolean = true);
CREATE POLICY "admin_projeto_atributos"   ON projeto_atributos    FOR ALL TO authenticated USING ((auth.jwt()->'app_metadata'->>'admin')::boolean = true);
CREATE POLICY "admin_projeto_anexos"      ON projeto_anexos       FOR ALL TO authenticated USING ((auth.jwt()->'app_metadata'->>'admin')::boolean = true);
CREATE POLICY "admin_catalogo_read"       ON atributos_catalogo   FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_catalogo_write"      ON atributos_catalogo   FOR ALL TO authenticated USING ((auth.jwt()->'app_metadata'->>'admin')::boolean = true);
CREATE POLICY "admin_recorrencias"        ON recorrencias         FOR ALL TO authenticated USING ((auth.jwt()->'app_metadata'->>'admin')::boolean = true);
CREATE POLICY "admin_recorrencia_proj"    ON recorrencia_projetos FOR ALL TO authenticated USING ((auth.jwt()->'app_metadata'->>'admin')::boolean = true);
CREATE POLICY "admin_produtos_padrao"     ON produtos_padrao      FOR ALL TO authenticated USING ((auth.jwt()->'app_metadata'->>'admin')::boolean = true);

-- ── Função de similaridade (criada mas não exposta na UI — Fase 2) ────────────

CREATE OR REPLACE FUNCTION similaridade_projetos(p_id_a int, p_id_b int)
RETURNS numeric LANGUAGE sql STABLE AS $$
  WITH
    a AS (SELECT chave, valor FROM projeto_atributos WHERE projeto_id = p_id_a),
    b AS (SELECT chave, valor FROM projeto_atributos WHERE projeto_id = p_id_b),
    intersecao AS (SELECT a.chave FROM a JOIN b ON a.chave = b.chave AND a.valor = b.valor),
    uniao      AS (SELECT chave FROM a UNION SELECT chave FROM b)
  SELECT CASE
    WHEN (SELECT count(*) FROM uniao) = 0 THEN 0
    ELSE round(
      (SELECT count(*)::numeric FROM intersecao) /
      (SELECT count(*)::numeric FROM uniao), 4
    )
  END;
$$;

-- ── View de resumo ────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW vw_projetos_resumo AS
SELECT
  p.id, p.codigo, p.titulo, p.cliente_nome, p.cliente_cnpj,
  p.segmento, p.status,
  p.data_inicio, p.data_conclusao, p.valor_total,
  p.observacoes, p.produto_padrao_id,
  pp.nome AS produto_padrao_nome,
  count(DISTINCT pa.id)::int AS qtd_atributos,
  count(DISTINCT an.id)::int AS qtd_anexos,
  p.created_at, p.updated_at
FROM projetos p
LEFT JOIN projeto_atributos pa ON pa.projeto_id = p.id
LEFT JOIN projeto_anexos    an ON an.projeto_id = p.id
LEFT JOIN produtos_padrao   pp ON pp.id = p.produto_padrao_id
GROUP BY p.id, pp.nome;

-- Verificação final
SELECT 'OK: tabelas criadas' AS status
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'projetos')
  AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'projeto_atributos')
  AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'projeto_anexos')
  AND EXISTS (SELECT 1 FROM information_schema.views   WHERE table_name = 'vw_projetos_resumo');
