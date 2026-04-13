-- ============================================================
-- PROJECT-FIRST FASES 2-4 — FUNÇÕES E VIEWS
-- Execute no SQL Editor do Supabase
-- Substitui qualquer versão anterior das mesmas funções/views.
-- ============================================================

-- ── buscar_similares ─────────────────────────────────────────────────────────
-- Recebe lista de atributos [{chave, valor}] como JSON string.
-- Retorna projetos ordenados por score Jaccard decrescente.
-- Sem SECURITY DEFINER: service_role já bypassa RLS.

CREATE OR REPLACE FUNCTION buscar_similares(
  p_atributos   text,        -- JSON.stringify([{chave, valor}, ...])
  p_excluir_id  int  DEFAULT NULL,
  p_limite      int  DEFAULT 5
)
RETURNS TABLE (
  projeto_id       int,
  codigo           text,
  titulo           text,
  cliente_nome     text,
  segmento         text,
  status           text,
  score            numeric,
  atributos_comuns int
)
LANGUAGE sql
STABLE
SET search_path = public, pg_catalog
AS $$
  WITH
    -- Atributos da query (pares chave/valor a comparar)
    query_attrs AS (
      SELECT
        elem->>'chave' AS chave,
        elem->>'valor' AS valor
      FROM jsonb_array_elements(p_atributos::jsonb) AS elem
    ),
    -- Tamanho do conjunto query (|A|)
    query_size AS (
      SELECT count(*)::int AS n FROM query_attrs
    ),
    -- Interseção: pares (chave, valor) que estão em A e B
    intersecao AS (
      SELECT pa.projeto_id, count(*)::int AS n
      FROM projeto_atributos pa
      JOIN query_attrs qa ON qa.chave = pa.chave AND qa.valor = pa.valor
      WHERE p_excluir_id IS NULL OR pa.projeto_id <> p_excluir_id
      GROUP BY pa.projeto_id
    ),
    -- Tamanho do conjunto B por projeto (|B|)
    projeto_size AS (
      SELECT projeto_id, count(*)::int AS n
      FROM projeto_atributos
      WHERE p_excluir_id IS NULL OR projeto_id <> p_excluir_id
      GROUP BY projeto_id
    )
  SELECT
    p.id                                                    AS projeto_id,
    p.codigo,
    p.titulo,
    p.cliente_nome,
    p.segmento,
    p.status,
    -- Jaccard: |A∩B| / (|A| + |B| - |A∩B|)
    round(
      i.n::numeric / NULLIF(qs.n + ps.n - i.n, 0),
      4
    )                                                       AS score,
    i.n                                                     AS atributos_comuns
  FROM intersecao i
  JOIN projeto_size   ps ON ps.projeto_id = i.projeto_id
  JOIN projetos       p  ON p.id          = i.projeto_id
  CROSS JOIN query_size qs
  WHERE i.n > 0
  ORDER BY score DESC
  LIMIT p_limite;
$$;

-- ── detectar_recorrencias ────────────────────────────────────────────────────
-- Detecta grupos de projetos com conjuntos de atributos idênticos.
-- FIX: (array_agg(atributos_chave))[1] em vez de min(atributos_chave).
--      min() não existe para jsonb — todos os elementos do grupo são
--      idênticos por construção (mesmo md5), então [1] é correto.

CREATE OR REPLACE FUNCTION detectar_recorrencias(
  p_min_contagem int DEFAULT 3
)
RETURNS int   -- número de recorrências com status 'detectada' após execução
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_total int;
BEGIN
  -- Passo 1: calcula hash e atributos por projeto
  -- Passo 2: agrupa projetos com atributos idênticos (mesmo hash)
  -- Passo 3: upsert em recorrencias (apenas grupos com contagem suficiente)
  -- Passo 4: vincula projetos à recorrência em recorrencia_projetos
  WITH
    por_projeto AS (
      SELECT
        projeto_id,
        md5(
          jsonb_agg(
            jsonb_build_object('chave', chave, 'valor', valor)
            ORDER BY chave, valor
          )::text
        ) AS hash_atributos,
        jsonb_agg(
          jsonb_build_object('chave', chave, 'valor', valor)
          ORDER BY chave, valor
        ) AS atributos_chave
      FROM projeto_atributos
      GROUP BY projeto_id
    ),
    grupos AS (
      SELECT
        hash_atributos,
        -- FIX: todos os elementos do grupo têm atributos_chave idêntico;
        -- [1] pega o representante sem precisar de min/max em jsonb.
        (array_agg(atributos_chave))[1]  AS atributos_chave,
        count(*)::int                    AS contagem,
        array_agg(projeto_id)            AS projeto_ids
      FROM por_projeto
      GROUP BY hash_atributos
      HAVING count(*) >= p_min_contagem
    ),
    upserted AS (
      INSERT INTO recorrencias (hash_atributos, atributos_chave, contagem, status)
      SELECT hash_atributos, atributos_chave, contagem, 'detectada'
      FROM grupos
      ON CONFLICT (hash_atributos) DO UPDATE
        SET contagem   = EXCLUDED.contagem,
            updated_at = now()
      -- Não sobrescreve status se já está em análise ou além
      WHERE recorrencias.status = 'detectada'
      RETURNING id, hash_atributos
    )
  INSERT INTO recorrencia_projetos (recorrencia_id, projeto_id)
  SELECT u.id, unnest(g.projeto_ids)
  FROM upserted u
  JOIN grupos g ON g.hash_atributos = u.hash_atributos
  ON CONFLICT DO NOTHING;

  -- Retorna total de recorrências detectadas (todas, não só as desta execução)
  SELECT count(*) INTO v_total
  FROM recorrencias
  WHERE status = 'detectada';

  RETURN v_total;
END;
$$;

-- ── converter_recorrencia ────────────────────────────────────────────────────
-- Cria um produto_padrao a partir de uma recorrência aprovada.
-- Converte atributos_chave jsonb [{chave, valor}] para {chave: valor}.

CREATE OR REPLACE FUNCTION converter_recorrencia(
  p_recorrencia_id int,
  p_nome           text,
  p_descricao      text DEFAULT NULL,
  p_segmento       text DEFAULT NULL,
  p_aprovado_por   text DEFAULT NULL
)
RETURNS int   -- id do produto_padrao criado
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_atributos  jsonb;
  v_produto_id int;
BEGIN
  SELECT atributos_chave INTO v_atributos
  FROM recorrencias
  WHERE id = p_recorrencia_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recorrência % não encontrada', p_recorrencia_id;
  END IF;

  -- Converte [{chave:"x", valor:"y"}, ...] → {"x": "y", ...}
  INSERT INTO produtos_padrao (
    codigo, nome, descricao, segmento, atributos,
    status, aprovado_por, aprovado_em
  )
  VALUES (
    'PP-' || to_char(now(), 'YYYY') || '-'
      || lpad(nextval('seq_projeto_num')::text, 4, '0'),
    p_nome,
    p_descricao,
    p_segmento,
    (
      SELECT jsonb_object_agg(elem->>'chave', elem->>'valor')
      FROM jsonb_array_elements(v_atributos) AS elem
    ),
    'rascunho',
    p_aprovado_por,
    CASE WHEN p_aprovado_por IS NOT NULL THEN now() ELSE NULL END
  )
  RETURNING id INTO v_produto_id;

  UPDATE recorrencias
     SET status       = 'convertida',
         analisado_em  = now(),
         analisado_por = p_aprovado_por,
         updated_at    = now()
   WHERE id = p_recorrencia_id;

  RETURN v_produto_id;
END;
$$;

-- ── vw_recorrencias ──────────────────────────────────────────────────────────
-- Campos esperados pelo frontend: projeto_ids, projeto_codigos, projeto_titulos.
-- atributos_chave: convertido de [{chave,valor}] → {key:value} para Object.entries().

CREATE OR REPLACE VIEW vw_recorrencias AS
SELECT
  r.id,
  r.hash_atributos,
  -- Banco armazena [{chave:"x",valor:"y"}]; frontend espera {"x":"y"}
  (
    SELECT jsonb_object_agg(elem->>'chave', elem->>'valor')
    FROM jsonb_array_elements(r.atributos_chave) AS elem
  ) AS atributos_chave,
  r.contagem,
  r.status,
  r.sugerido_em,
  r.analisado_em,
  r.analisado_por,
  coalesce(array_agg(rp.projeto_id ORDER BY rp.adicionado_em), '{}') AS projeto_ids,
  coalesce(array_agg(p.codigo      ORDER BY rp.adicionado_em), '{}') AS projeto_codigos,
  coalesce(array_agg(p.titulo      ORDER BY rp.adicionado_em), '{}') AS projeto_titulos
FROM recorrencias r
LEFT JOIN recorrencia_projetos rp ON rp.recorrencia_id = r.id
LEFT JOIN projetos             p  ON p.id = rp.projeto_id
GROUP BY r.id;

-- ── vw_produtos_padrao ───────────────────────────────────────────────────────
-- Inclui qtd_projetos: projetos que já referenciam este produto padrão.

CREATE OR REPLACE VIEW vw_produtos_padrao AS
SELECT
  pp.id,
  pp.codigo,
  pp.nome,
  pp.descricao,
  pp.segmento,
  pp.atributos,
  pp.status,
  pp.aprovado_por,
  pp.aprovado_em,
  pp.created_at,
  pp.updated_at,
  count(DISTINCT p.id)::int AS qtd_projetos
FROM produtos_padrao pp
LEFT JOIN projetos p ON p.produto_padrao_id = pp.id
GROUP BY pp.id;

-- ── Verificação ──────────────────────────────────────────────────────────────
SELECT
  (SELECT count(*) FROM recorrencias)    AS recorrencias_existentes,
  (SELECT count(*) FROM produtos_padrao) AS produtos_padrao_existentes,
  EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_name = 'vw_recorrencias'
  )                                       AS view_recorrencias_ok,
  EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_name = 'vw_produtos_padrao'
  )                                       AS view_produtos_padrao_ok,
  'Fases 2-4 OK' AS status;
