-- Funil v2: reconstrói get_funil_prospects com lógica correta
-- contatados/interessados vêm de prospeccao; orcamentos/vendas/receita de pipeline_deals

DROP FUNCTION IF EXISTS get_funil_prospects(text[], text[], numeric);

CREATE OR REPLACE FUNCTION public.get_funil_prospects(
  p_segmentos text[] DEFAULT NULL,
  p_ufs       text[] DEFAULT NULL,
  p_raio      numeric DEFAULT NULL
)
RETURNS TABLE(
  mercado      bigint,
  contatados   bigint,
  interessados bigint,
  orcamentos   bigint,
  vendas       bigint,
  receita      numeric,
  ticket_medio numeric
)
LANGUAGE sql STABLE
AS $$
  WITH base AS (
    SELECT
      COUNT(*)                                                       AS mercado,
      COUNT(*) FILTER (WHERE contatado = true)                      AS contatados,
      COUNT(*) FILTER (WHERE status_contato = 'Interessado')        AS interessados
    FROM prospeccao p
    WHERE
      (p_segmentos IS NULL OR array_length(p_segmentos, 1) IS NULL OR p.segmento = ANY(p_segmentos))
      AND (p_ufs IS NULL OR array_length(p_ufs, 1) IS NULL OR p.uf = ANY(p_ufs))
      AND (p_raio IS NULL OR p.distancia_km <= p_raio)
  ),
  pipeline AS (
    SELECT
      COUNT(*) FILTER (WHERE d.estagio IN ('proposta', 'negociacao'))  AS orcamentos,
      COUNT(*) FILTER (WHERE d.estagio = 'ganho')                      AS vendas,
      COALESCE(SUM(d.valor_estimado) FILTER (WHERE d.estagio = 'ganho'), 0) AS receita
    FROM pipeline_deals d
    JOIN prospeccao p ON p.id = d.prospect_id
    WHERE
      (p_segmentos IS NULL OR array_length(p_segmentos, 1) IS NULL OR p.segmento = ANY(p_segmentos))
      AND (p_ufs IS NULL OR array_length(p_ufs, 1) IS NULL OR p.uf = ANY(p_ufs))
      AND (p_raio IS NULL OR p.distancia_km <= p_raio)
  )
  SELECT
    b.mercado,
    b.contatados,
    b.interessados,
    pl.orcamentos,
    pl.vendas,
    pl.receita,
    CASE WHEN pl.vendas > 0 THEN ROUND(pl.receita / pl.vendas, 2) ELSE 0 END
  FROM base b, pipeline pl;
$$;
