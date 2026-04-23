-- ══════════════════════════════════════════════════════════════════════════════
-- RFM na Cobrança + Base WhatsApp Campanhas
-- ══════════════════════════════════════════════════════════════════════════════


-- ── 1. Telefone em clientes (cross-reference futuro com prospeccao) ───────────

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS telefone text;

COMMENT ON COLUMN clientes.telefone IS
  'Telefone principal para contato/WhatsApp — preenchido manualmente ou via cruzamento com prospeccao';


-- ── 2. vw_fin_aging atualizada com segmento RFM ───────────────────────────────
-- Inclui rfm_segmento e razao_social do cliente via LEFT JOIN.
-- Mantém compatibilidade total com a versão anterior (todos os campos preservados).

CREATE OR REPLACE VIEW vw_fin_aging AS
SELECT
  fl.id,
  fl.descricao,
  fl.valor,
  fl.data_vencimento,
  fl.origem,
  fl.prioridade,
  fl.cobranca_status,
  fl.cobranca_obs,
  fl.cobranca_em,
  fl.cliente_id,
  CURRENT_DATE - fl.data_vencimento              AS dias_atraso,
  CASE
    WHEN fl.data_vencimento >= CURRENT_DATE                              THEN 'a_vencer'
    WHEN fl.data_vencimento >= CURRENT_DATE - INTERVAL '7 days'         THEN 'vencido_1_7'
    WHEN fl.data_vencimento >= CURRENT_DATE - INTERVAL '30 days'        THEN 'vencido_8_30'
    ELSE                                                                      'vencido_31_plus'
  END                                            AS faixa,
  c.razao_social                                 AS cliente_nome,
  c.rfm_segmento,
  c.telefone                                     AS cliente_telefone
FROM fin_lancamentos fl
LEFT JOIN clientes c ON c.id = fl.cliente_id
WHERE fl.tipo   = 'receita'
  AND fl.status = 'pendente';


-- ── 3. Tabela de campanhas WhatsApp ──────────────────────────────────────────
-- Estrutura mínima: define critérios de segmentação e controla estado da campanha.
-- Disparo real via n8n — fora do escopo desta fase.

CREATE TABLE IF NOT EXISTS wpp_campanhas (
  id            bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,

  -- Identificação
  nome          text NOT NULL,
  descricao     text,

  -- Critérios de segmentação (arrays nullable = "sem filtro neste eixo")
  segmentos_rfm text[],          -- ex: '{"VIP","Recorrente"}' — null = todos
  status_cobr   text[],          -- ex: '{"nao_cobrado","prometido"}' — null = sem filtro de cobrança
  regioes       text[],          -- ex: '{"Sudeste","Sul"}' — null = todas

  -- Opções
  apenas_com_telefone boolean NOT NULL DEFAULT true,
  apenas_prioridade   boolean NOT NULL DEFAULT false,

  -- Controle
  status        text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','pronta','enviada','cancelada')),
  destinatarios_preview int,     -- contagem calculada no momento de salvar
  criado_em     timestamptz NOT NULL DEFAULT now(),
  enviado_em    timestamptz,
  criado_por    text           -- email do usuário admin
);

COMMENT ON TABLE wpp_campanhas IS
  'Campanhas WhatsApp em lote — define segmentação e controla estado. Disparo via n8n (fase futura).';

-- RLS: service_role apenas (padrão admin)
ALTER TABLE wpp_campanhas ENABLE ROW LEVEL SECURITY;
CREATE POLICY wpp_campanhas_admin ON wpp_campanhas
  USING (auth.role() = 'service_role');


-- ── 4. Função: preview de destinatários elegíveis para uma campanha ───────────
-- Retorna contagem + lista (top 50) de clientes que atendem aos critérios.
-- Chamada antes de salvar/enviar — sem efeito colateral.

CREATE OR REPLACE FUNCTION fn_wpp_preview(
  p_segmentos_rfm text[]         DEFAULT NULL,
  p_status_cobr   text[]         DEFAULT NULL,
  p_regioes       text[]         DEFAULT NULL,
  p_apenas_telefone boolean      DEFAULT true,
  p_apenas_prioridade boolean    DEFAULT false
)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_total int;
  v_lista jsonb;
BEGIN
  -- Clientes elegíveis por critérios de RFM + telefone
  WITH elegivel AS (
    SELECT DISTINCT
      c.id,
      c.razao_social,
      c.cnpj,
      c.telefone,
      c.rfm_segmento,
      c.rfm_score,
      -- Tem recebível pendente?
      EXISTS (
        SELECT 1 FROM fin_lancamentos fl
        WHERE fl.cliente_id = c.id
          AND fl.tipo = 'receita' AND fl.status = 'pendente'
          AND (p_status_cobr IS NULL OR fl.cobranca_status = ANY(p_status_cobr))
          AND (NOT p_apenas_prioridade OR fl.prioridade = true)
      ) AS tem_cobranca_pendente
    FROM clientes c
    WHERE
      (p_segmentos_rfm IS NULL OR c.rfm_segmento = ANY(p_segmentos_rfm))
      AND (NOT p_apenas_telefone OR (c.telefone IS NOT NULL AND c.telefone != ''))
  )
  SELECT
    COUNT(*)::int,
    jsonb_agg(
      jsonb_build_object(
        'id',            id,
        'razao_social',  razao_social,
        'cnpj',          cnpj,
        'telefone',      telefone,
        'rfm_segmento',  rfm_segmento,
        'rfm_score',     rfm_score,
        'tem_cobranca',  tem_cobranca_pendente
      )
      ORDER BY rfm_score DESC NULLS LAST
    ) FILTER (WHERE row_number() OVER (ORDER BY rfm_score DESC NULLS LAST) <= 50)
  INTO v_total, v_lista
  FROM elegivel;

  RETURN jsonb_build_object(
    'total',   v_total,
    'preview', COALESCE(v_lista, '[]'::jsonb)
  );
END;
$$;

COMMENT ON FUNCTION fn_wpp_preview IS
  'Preview de destinatários elegíveis para uma campanha WhatsApp. Sem efeito colateral — use antes de salvar.';
