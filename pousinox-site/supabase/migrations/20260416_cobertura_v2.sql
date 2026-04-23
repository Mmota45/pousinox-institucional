-- Cobertura v2: score_medio, clientes reais (independente de segmento) e ordenação por oportunidade
-- Clientes contados via subquery para ignorar filtro de segmento
DROP FUNCTION IF EXISTS get_cobertura_regional(text[], text[], numeric);

CREATE OR REPLACE FUNCTION public.get_cobertura_regional(
  p_segmentos text[] DEFAULT NULL,
  p_ufs       text[] DEFAULT NULL,
  p_raio      numeric DEFAULT NULL
)
RETURNS TABLE(
  mesorregiao   text,
  uf            text,
  total         bigint,
  contatados    bigint,
  interessados  bigint,
  aguardando    bigint,
  cobertura_pct numeric,
  score_medio   numeric,
  clientes      bigint
)
LANGUAGE sql STABLE
AS $$
  SELECT
    p.mesorregiao,
    p.uf,
    COUNT(*)::bigint,
    COUNT(*) FILTER (WHERE p.contatado = true)::bigint,
    COUNT(*) FILTER (WHERE p.status_contato IN ('Interessado', 'Orçamento enviado', 'Venda fechada'))::bigint,
    COUNT(*) FILTER (WHERE p.status_contato IN ('Aguardando', 'Retornar'))::bigint,
    ROUND(COUNT(*) FILTER (WHERE p.contatado = true) * 100.0 / NULLIF(COUNT(*), 0), 1),
    ROUND(AVG(p.score), 1),
    (
      SELECT COUNT(DISTINCT c.id)
      FROM clientes c
      JOIN prospeccao p2 ON p2.cnpj = c.cnpj
      WHERE p2.mesorregiao = p.mesorregiao AND p2.uf = p.uf
    )::bigint
  FROM prospeccao p
  WHERE p.mesorregiao IS NOT NULL
    AND (p_segmentos IS NULL OR array_length(p_segmentos, 1) IS NULL OR p.segmento = ANY(p_segmentos))
    AND (p_ufs IS NULL OR array_length(p_ufs, 1) IS NULL OR p.uf = ANY(p_ufs))
    AND (p_raio IS NULL OR p.distancia_km <= p_raio)
  GROUP BY p.mesorregiao, p.uf
  HAVING COUNT(*) >= 3
  ORDER BY 9 DESC, ROUND(AVG(p.score), 1) DESC, COUNT(*) DESC;
$$;
