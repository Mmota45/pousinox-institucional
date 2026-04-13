-- Fix: recriar listar_projetos_para_embedding com SECURITY DEFINER
-- para garantir que o PostgREST expõe corretamente via /rpc/

DROP FUNCTION IF EXISTS listar_projetos_para_embedding();

CREATE OR REPLACE FUNCTION listar_projetos_para_embedding()
RETURNS TABLE (
  projeto_id   int,
  titulo       text,
  segmento     text,
  atributos    jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
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
  WHERE pe.projeto_id IS NULL
  GROUP BY p.id;
$$;

-- Necessário: SECURITY DEFINER precisa de grant explícito
REVOKE ALL  ON FUNCTION listar_projetos_para_embedding() FROM public, anon;
GRANT EXECUTE ON FUNCTION listar_projetos_para_embedding() TO authenticated;

-- Teste direto
SELECT * FROM listar_projetos_para_embedding();
