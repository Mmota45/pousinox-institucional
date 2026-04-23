-- Preenche distancia_km para prospects com valor nulo
-- Execução em UF por vez para evitar timeout
-- Execute: SET statement_timeout = '120s'; antes se necessário

-- Passo 1: cria lookup normalizado de ibge (rápido, ~5570 linhas)
WITH ibge_norm AS (
  SELECT
    uf,
    nome_norm,
    lat,
    lng,
    ROUND(
      6371 * 2 * ASIN(SQRT(
        POWER(SIN((RADIANS(lat) - RADIANS(-22.2289)) / 2), 2) +
        COS(RADIANS(-22.2289)) * COS(RADIANS(lat)) *
        POWER(SIN((RADIANS(lng) - RADIANS(-45.9358)) / 2), 2)
      ))
    )::numeric AS distancia
  FROM ibge_municipios
  WHERE lat IS NOT NULL AND lng IS NOT NULL
)
UPDATE prospeccao p
SET distancia_km = i.distancia
FROM ibge_norm i
WHERE p.distancia_km IS NULL
  AND p.uf = i.uf
  AND p.cidade IS NOT NULL
  AND i.nome_norm = unaccent(lower(p.cidade));
