-- ============================================================
-- PROJECT-FIRST FASE 5 — ETAPA 1: SCHEMA PGVECTOR (SHADOW MODE)
-- v2 — corrigido após auditoria técnica
-- Execute no SQL Editor do Supabase
--
-- O QUE MUDA:
--   + CREATE EXTENSION vector (idempotente)
--   + tabela feature_flags
--   + tabela projeto_embeddings
--   + tabela similarity_shadow_log
--   + função/trigger de invalidação de embedding
--   + RPC buscar_similares_vector  (stub; retorna vazio até backfill)
--   + RPC registrar_shadow_log     (grava comparação Jaccard vs vector)
--   + RLS em todas as novas tabelas
--
-- O QUE NÃO MUDA:
--   tabelas existentes, buscar_similares, frontend
--
-- ── REVERSÃO COMPLETA (executar nesta ordem) ─────────────────────────────────
--   DROP TRIGGER IF EXISTS trg_invalidar_embedding_on_attr_change ON projeto_atributos;
--   DROP FUNCTION IF EXISTS invalidar_embedding_projeto;
--   DROP FUNCTION IF EXISTS buscar_similares_vector;
--   DROP FUNCTION IF EXISTS registrar_shadow_log;
--   DROP TABLE IF EXISTS similarity_shadow_log;
--   DROP TABLE IF EXISTS projeto_embeddings;
--   DROP TABLE IF EXISTS feature_flags;
--   -- extensão vector pode ser mantida (não afeta nada)
-- ============================================================

-- ── 1. Extensão pgvector ──────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;

-- ── 2. Feature flags ─────────────────────────────────────────────────────────
-- Tabela genérica de rollout. Lida pelo frontend antes de acionar chamadas
-- vetoriais. Permanece desabilitada até backfill completo (Etapa 2).

CREATE TABLE IF NOT EXISTS feature_flags (
  flag           text PRIMARY KEY,
  habilitado     boolean      NOT NULL DEFAULT false,
  config         jsonb        NOT NULL DEFAULT '{}',
  atualizado_em  timestamptz  DEFAULT now(),
  atualizado_por text
);

-- Seed: shadow mode desabilitado
INSERT INTO feature_flags (flag, habilitado, config)
VALUES (
  'vector_similarity_shadow',
  false,
  '{
    "modelo":       "text-embedding-3-small",
    "dims":         1536,
    "min_projetos": 5,
    "nota":         "Habilitar apenas apos backfill completo (Etapa 2)."
  }'::jsonb
)
ON CONFLICT (flag) DO NOTHING;

-- ── 3. Embeddings dos projetos ────────────────────────────────────────────────
-- Um registro por projeto. Upsert feito pelo pipeline n8n (Etapa 2).
--
-- status: ciclo de vida do embedding
--   pendente   → projeto salvo, ainda sem embedding gerado
--   valido     → embedding gerado e ainda consistente com atributos atuais
--   invalidado → atributos mudaram após a geração; precisa de re-embed
--   erro       → falha na geração (detalhes em texto_base ou log externo)
--
-- conteudo_hash: md5(texto_base) — permite detectar se o conteúdo mudou sem
--   chamar a API de novo, e deduplicar requests identicos no pipeline.
--
-- modelo: ex. "text-embedding-3-small-1536" — mudança de modelo exige
--   rebuild completo via UPDATE ... SET status = 'pendente' WHERE modelo <> 'novo'.

CREATE TABLE IF NOT EXISTS projeto_embeddings (
  projeto_id     int  PRIMARY KEY REFERENCES projetos(id) ON DELETE CASCADE,
  embedding      vector(1536),                         -- NULL enquanto status = 'pendente'/'erro'
  modelo         text,
  texto_base     text,
  conteudo_hash  text,                                 -- md5(texto_base), para dedup e drift detection
  tokens_usados  int,
  status         text NOT NULL DEFAULT 'pendente'
                   CHECK (status IN ('pendente', 'valido', 'invalidado', 'erro')),
  gerado_em      timestamptz,
  updated_at     timestamptz DEFAULT now()
);

-- Nota: NÃO criar índice vetorial (HNSW/IVFFlat) neste momento.
-- Com < 1.000 projetos, full scan é mais rápido e mais simples.
-- Criar apenas quando houver > 1.000 embeddings válidos:
--   CREATE INDEX CONCURRENTLY idx_emb_hnsw
--   ON projeto_embeddings USING hnsw (embedding vector_cosine_ops)
--   WITH (m = 16, ef_construction = 64)
--   WHERE status = 'valido';

-- ── 4. Log de shadow mode ─────────────────────────────────────────────────────
-- Cada linha = uma chamada de busca executada com ambos os motores.
-- Permite comparar: latência, divergência de ranking, sobreposição de top-N.
-- consulta_hash = sha256(atributos ordenados): agrupa buscas idênticas.
-- vector_skip: motivo caso busca vetorial foi pulada (flag off, sem embedding, erro API, etc.).

CREATE TABLE IF NOT EXISTS similarity_shadow_log (
  id               bigserial PRIMARY KEY,

  -- Contexto
  consulta_hash    text      NOT NULL,
  projeto_id_query int       REFERENCES projetos(id) ON DELETE SET NULL,
  atributos_json   jsonb     NOT NULL DEFAULT '[]',

  -- Motor Jaccard (atual)
  jaccard_ids      int[]     NOT NULL DEFAULT '{}',
  jaccard_scores   numeric[] NOT NULL DEFAULT '{}',
  jaccard_ms       numeric,

  -- Motor vetorial (shadow)
  vector_ids       int[]     NOT NULL DEFAULT '{}',
  vector_scores    numeric[] NOT NULL DEFAULT '{}',
  vector_ms        numeric,
  vector_skip      text,

  -- Métricas comparativas
  divergencia      numeric,   -- 1 - Jaccard({jaccard_ids} Δ {vector_ids}) ∈ [0,1]
  sobreposicao_n   int,       -- |interseção| dos top-N
  top_n_usado      int        NOT NULL DEFAULT 5,

  -- Metadados
  modelo_embedding text,
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shadow_hash     ON similarity_shadow_log(consulta_hash);
CREATE INDEX IF NOT EXISTS idx_shadow_criado   ON similarity_shadow_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shadow_diverg   ON similarity_shadow_log(divergencia DESC NULLS LAST)
  WHERE divergencia IS NOT NULL;

-- ── 5. Trigger: marcar embedding como invalidado quando atributos mudam ───────
-- Trigger leve: apenas UPDATE de uma coluna por projeto_id (índice PK).
-- Não faz cálculo, não chama APIs externas, não bloqueia a transação principal.
-- Se não houver embedding para o projeto (base vazia na Etapa 1), UPDATE = no-op.

CREATE OR REPLACE FUNCTION invalidar_embedding_projeto()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  UPDATE projeto_embeddings
     SET status     = 'invalidado',
         updated_at = now()
   WHERE projeto_id = COALESCE(NEW.projeto_id, OLD.projeto_id)
     AND status = 'valido';           -- só invalida se estava válido; evita UPDATE redundante
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE TRIGGER trg_invalidar_embedding_on_attr_change
  AFTER INSERT OR UPDATE OR DELETE ON projeto_atributos
  FOR EACH ROW EXECUTE FUNCTION invalidar_embedding_projeto();

-- ── 6. RPC: buscar_similares_vector ──────────────────────────────────────────
-- Stub funcional: com a tabela vazia retorna zero linhas (correto para Etapa 1).
-- Assinatura definitiva: recebe vetor pré-computado pelo cliente (nunca gera
-- embeddings internamente — a API externa é responsabilidade do pipeline n8n).
--
-- Sem SECURITY DEFINER: o frontend usa service_role (bypassa RLS nativamente).
-- Sem SECURITY DEFINER evita também a necessidade de revogar grants de anon.

CREATE OR REPLACE FUNCTION buscar_similares_vector(
  p_embedding   vector(1536),
  p_excluir_id  int  DEFAULT NULL,
  p_limite      int  DEFAULT 5
)
RETURNS TABLE (
  projeto_id int,
  titulo     text,
  codigo     text,
  segmento   text,
  score      numeric
)
LANGUAGE sql
STABLE
SET search_path = public, extensions, pg_catalog
AS $$
  SELECT
    p.id                                                        AS projeto_id,
    p.titulo,
    p.codigo,
    p.segmento,
    round((1 - (e.embedding <=> p_embedding))::numeric, 4)     AS score
  FROM projeto_embeddings e
  JOIN projetos p ON p.id = e.projeto_id
  WHERE e.status = 'valido'
    AND e.embedding IS NOT NULL
    AND (p_excluir_id IS NULL OR e.projeto_id <> p_excluir_id)
  ORDER BY e.embedding <=> p_embedding
  LIMIT p_limite;
$$;

-- Grants explícitos: apenas admin autenticado e service_role
-- (service_role bypassa RLS e não precisa de GRANT explícito em funções normais,
--  mas revogar anon/public é precaução defensiva)
REVOKE ALL ON FUNCTION buscar_similares_vector(vector, int, int) FROM public, anon;
GRANT  EXECUTE ON FUNCTION buscar_similares_vector(vector, int, int) TO authenticated;

-- ── 7. RPC: registrar_shadow_log ─────────────────────────────────────────────
-- Chamada pelo frontend após ambos os motores responderem.
-- Calcula divergência aqui (lógica centralizada, não no cliente).
-- Sem SECURITY DEFINER: sem risco de escalada de privilégio.

CREATE OR REPLACE FUNCTION registrar_shadow_log(
  p_consulta_hash    text,
  p_projeto_id_query int       DEFAULT NULL,
  p_atributos_json   jsonb     DEFAULT '[]',
  p_jaccard_ids      int[]     DEFAULT '{}',
  p_jaccard_scores   numeric[] DEFAULT '{}',
  p_jaccard_ms       numeric   DEFAULT NULL,
  p_vector_ids       int[]     DEFAULT '{}',
  p_vector_scores    numeric[] DEFAULT '{}',
  p_vector_ms        numeric   DEFAULT NULL,
  p_vector_skip      text      DEFAULT NULL,
  p_top_n            int       DEFAULT 5,
  p_modelo           text      DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_sobreposicao int;
  v_uniao        int;
  v_divergencia  numeric;
  v_id           bigint;
BEGIN
  -- Jaccard nos conjuntos de IDs (ignora ranking, apenas sobreposição de conjuntos)
  SELECT
    coalesce(array_length(
      ARRAY(SELECT unnest(p_jaccard_ids) INTERSECT SELECT unnest(p_vector_ids)), 1
    ), 0),
    coalesce(array_length(
      ARRAY(SELECT unnest(p_jaccard_ids) UNION     SELECT unnest(p_vector_ids)), 1
    ), 0)
  INTO v_sobreposicao, v_uniao;

  -- Divergência só é calculada quando a busca vetorial rodou de fato
  IF v_uniao > 0 AND p_vector_skip IS NULL THEN
    v_divergencia := round(1.0 - (v_sobreposicao::numeric / v_uniao), 4);
  END IF;

  INSERT INTO similarity_shadow_log (
    consulta_hash,   projeto_id_query,  atributos_json,
    jaccard_ids,     jaccard_scores,    jaccard_ms,
    vector_ids,      vector_scores,     vector_ms,     vector_skip,
    divergencia,     sobreposicao_n,    top_n_usado,
    modelo_embedding
  ) VALUES (
    p_consulta_hash, p_projeto_id_query, p_atributos_json,
    p_jaccard_ids,   p_jaccard_scores,   p_jaccard_ms,
    p_vector_ids,    p_vector_scores,    p_vector_ms,   p_vector_skip,
    v_divergencia,   v_sobreposicao,     p_top_n,
    p_modelo
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION registrar_shadow_log(text,int,jsonb,int[],numeric[],numeric,int[],numeric[],numeric,text,int,text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION registrar_shadow_log(text,int,jsonb,int[],numeric[],numeric,int[],numeric[],numeric,text,int,text) TO authenticated;

-- ── 8. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE feature_flags         ENABLE ROW LEVEL SECURITY;
ALTER TABLE projeto_embeddings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE similarity_shadow_log ENABLE ROW LEVEL SECURITY;

-- feature_flags: leitura apenas para admin; anon nunca deve ler via PostgREST
CREATE POLICY "admin_read_flags"
  ON feature_flags FOR SELECT TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'admin')::boolean = true);

CREATE POLICY "admin_write_flags"
  ON feature_flags FOR ALL TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'admin')::boolean = true);

-- projeto_embeddings: escrita pelo service_role (n8n pipeline), leitura por admin
CREATE POLICY "admin_embeddings"
  ON projeto_embeddings FOR ALL TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'admin')::boolean = true);

-- shadow log: apenas admin
CREATE POLICY "admin_shadow_log"
  ON similarity_shadow_log FOR ALL TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'admin')::boolean = true);

-- ── 9. Verificação ────────────────────────────────────────────────────────────
SELECT
  (SELECT habilitado FROM feature_flags WHERE flag = 'vector_similarity_shadow') AS flag_desabilitada,
  (SELECT count(*) FROM projeto_embeddings  WHERE status = 'valido')             AS embeddings_validos,
  (SELECT count(*) FROM similarity_shadow_log)                                   AS shadow_logs,
  EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'trg_invalidar_embedding_on_attr_change'
  )                                                                               AS trigger_ok,
  'Etapa 1 OK — schema criado, flag off, zero embeddings esperado'               AS status;
