-- ============================================================
-- PROJECT-FIRST FASE 5 — ETAPA 2: AJUSTE DE DIMENSÃO + HELPER BACKFILL
-- Execute no SQL Editor do Supabase
--
-- Por que 768 e não 1536:
--   O projeto já usa Gemini (GEMINI_KEY configurada).
--   text-embedding-004 do Gemini gera vetores de 768 dimensões.
--   A tabela foi criada com 1536 (OpenAI) — corrigir agora enquanto está vazia.
--
-- REVERSÃO:
--   ALTER TABLE projeto_embeddings DROP COLUMN embedding;
--   ALTER TABLE projeto_embeddings ADD COLUMN embedding vector(1536);
--   (e recriar buscar_similares_vector com vector(1536))
-- ============================================================

-- ── 1. Corrigir dimensão (tabela ainda vazia — zero custo) ───────────────────
ALTER TABLE projeto_embeddings DROP COLUMN IF EXISTS embedding;
ALTER TABLE projeto_embeddings ADD COLUMN embedding vector(768);

-- Atualiza feature_flag para refletir o modelo correto
UPDATE feature_flags
   SET config = config || '{"modelo": "text-embedding-004", "dims": 768}'::jsonb
 WHERE flag = 'vector_similarity_shadow';

-- ── 2. Atualizar RPC buscar_similares_vector para 768 dims ───────────────────
DROP FUNCTION IF EXISTS buscar_similares_vector(vector(1536), int, int);

CREATE OR REPLACE FUNCTION buscar_similares_vector(
  p_embedding   vector(768),
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

REVOKE ALL ON FUNCTION buscar_similares_vector(vector(768), int, int) FROM public, anon;
GRANT  EXECUTE ON FUNCTION buscar_similares_vector(vector(768), int, int) TO authenticated;

-- ── 3. RPC helper: listar projetos sem embedding válido ──────────────────────
-- Usada pelo workflow de backfill para saber quais projetos processar.
-- Retorna: id, titulo, segmento, e atributos como array JSON.

CREATE OR REPLACE FUNCTION listar_projetos_para_embedding()
RETURNS TABLE (
  projeto_id   int,
  titulo       text,
  segmento     text,
  atributos    jsonb   -- [{chave, valor}, ...]
)
LANGUAGE sql
STABLE
SET search_path = public, pg_catalog
AS $$
  SELECT
    p.id AS projeto_id,
    p.titulo,
    p.segmento,
    coalesce(
      jsonb_agg(
        jsonb_build_object('chave', pa.chave, 'valor', pa.valor)
        ORDER BY pa.chave
      ) FILTER (WHERE pa.chave IS NOT NULL),
      '[]'::jsonb
    ) AS atributos
  FROM projetos p
  LEFT JOIN projeto_atributos  pa ON pa.projeto_id = p.id
  LEFT JOIN projeto_embeddings pe ON pe.projeto_id = p.id AND pe.status = 'valido'
  WHERE pe.projeto_id IS NULL   -- sem embedding válido
  GROUP BY p.id;
$$;

REVOKE ALL ON FUNCTION listar_projetos_para_embedding() FROM public, anon;
GRANT  EXECUTE ON FUNCTION listar_projetos_para_embedding() TO authenticated;

-- ── 4. Verificação ────────────────────────────────────────────────────────────
SELECT
  (SELECT data_type FROM information_schema.columns
   WHERE table_name = 'projeto_embeddings' AND column_name = 'embedding')  AS tipo_coluna,
  (SELECT config->>'dims' FROM feature_flags WHERE flag = 'vector_similarity_shadow') AS dims_flag,
  (SELECT count(*) FROM listar_projetos_para_embedding())                  AS projetos_sem_embedding,
  'Etapa 2 SQL OK — pronto para workflows n8n' AS status;
