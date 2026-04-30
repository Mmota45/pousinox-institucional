-- Corrigir fn_top_prospects: coluna p.ativo não existe, remover filtro
CREATE OR REPLACE FUNCTION fn_top_prospects(n int DEFAULT 50, filtro_uf text DEFAULT NULL)
RETURNS TABLE(
  prospect_id bigint, score_total numeric, score_demanda numeric,
  score_segmento numeric, score_porte numeric, score_distancia numeric,
  razao_social text, nome_fantasia text, cnpj text, uf text, cidade text,
  segmento text, porte text, telefone1 text, telefone2 text, email text,
  status_contato text, ultimo_contato timestamptz,
  whatsapp text, whatsapp_validado boolean
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  max_vol numeric;
BEGIN
  SELECT GREATEST(COALESCE(MAX(s), 1), 1) INTO max_vol
  FROM (SELECT SUM(mk.volume_mensal) s FROM market_keywords mk WHERE mk.ativo GROUP BY mk.uf) x;

  RETURN QUERY
  WITH uf_vol AS (
    SELECT mk.uf AS u, SUM(mk.volume_mensal) AS vol
    FROM market_keywords mk WHERE mk.ativo GROUP BY mk.uf
  )
  SELECT
    p.id,
    (COALESCE(uv.vol / max_vol * 10, 0) * 0.35 +
     (CASE WHEN p.segmento ILIKE '%constru%' THEN 9 WHEN p.segmento ILIKE '%revest%' THEN 8 WHEN p.segmento ILIKE '%arquit%' THEN 7 WHEN p.segmento ILIKE '%engenh%' THEN 7 ELSE 4 END) * 0.25 +
     (CASE p.porte WHEN 'GRANDE' THEN 10 WHEN 'MEDIO' THEN 7 WHEN 'EPP' THEN 5 WHEN 'ME' THEN 3 ELSE 2 END) * 0.20 +
     (CASE p.uf WHEN 'MG' THEN 10 WHEN 'SP' THEN 7 WHEN 'RJ' THEN 6 WHEN 'ES' THEN 6 WHEN 'PR' THEN 5 WHEN 'SC' THEN 5 WHEN 'RS' THEN 4 WHEN 'GO' THEN 4 WHEN 'DF' THEN 4 WHEN 'BA' THEN 3 WHEN 'MT' THEN 3 WHEN 'MS' THEN 3 ELSE 2 END) * 0.20
    )::numeric(5,2),
    COALESCE(uv.vol / max_vol * 10, 0)::numeric(5,2),
    (CASE WHEN p.segmento ILIKE '%constru%' THEN 9 WHEN p.segmento ILIKE '%revest%' THEN 8 WHEN p.segmento ILIKE '%arquit%' THEN 7 WHEN p.segmento ILIKE '%engenh%' THEN 7 ELSE 4 END)::numeric(5,2),
    (CASE p.porte WHEN 'GRANDE' THEN 10 WHEN 'MEDIO' THEN 7 WHEN 'EPP' THEN 5 WHEN 'ME' THEN 3 ELSE 2 END)::numeric(5,2),
    (CASE p.uf WHEN 'MG' THEN 10 WHEN 'SP' THEN 7 WHEN 'RJ' THEN 6 WHEN 'ES' THEN 6 WHEN 'PR' THEN 5 WHEN 'SC' THEN 5 WHEN 'RS' THEN 4 WHEN 'GO' THEN 4 WHEN 'DF' THEN 4 WHEN 'BA' THEN 3 WHEN 'MT' THEN 3 WHEN 'MS' THEN 3 ELSE 2 END)::numeric(5,2),
    p.razao_social, p.nome_fantasia, p.cnpj, p.uf, p.cidade,
    p.segmento, p.porte, p.telefone1, p.telefone2, p.email,
    p.status_contato, p.ultimo_contato,
    p.whatsapp, p.whatsapp_validado
  FROM prospeccao p
  LEFT JOIN uf_vol uv ON uv.u = p.uf
  WHERE (filtro_uf IS NULL OR p.uf = filtro_uf)
  ORDER BY 2 DESC
  LIMIT n;
END;
$$;
