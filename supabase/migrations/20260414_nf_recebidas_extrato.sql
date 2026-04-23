-- ══════════════════════════════════════════════════════════════════════════════
-- NFs Recebidas + Extrato Bancário + base de conciliação
-- ══════════════════════════════════════════════════════════════════════════════


-- ── 1. NFs Recebidas — Cabeçalho ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nf_recebidas_cabecalho (
  id              bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  serie           text,
  numero          text NOT NULL,
  cnpj_fornecedor text,
  uf              text,
  chave_acesso    text UNIQUE,          -- chave de idempotência (44 dígitos)
  origem_nf       text,
  status          text,
  emissao         date,
  total           numeric(14,2) NOT NULL DEFAULT 0,

  -- Vínculo com financeiro (preenchido no momento da importação)
  lancamento_id   bigint REFERENCES fin_lancamentos(id) ON DELETE SET NULL,

  importado_em    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE nf_recebidas_cabecalho IS
  'Histórico de NFs recebidas (compras). lancamento_id aponta para a obrigação criada em fin_lancamentos.';

CREATE INDEX IF NOT EXISTS idx_nf_rec_cnpj      ON nf_recebidas_cabecalho(cnpj_fornecedor);
CREATE INDEX IF NOT EXISTS idx_nf_rec_emissao   ON nf_recebidas_cabecalho(emissao);
CREATE INDEX IF NOT EXISTS idx_nf_rec_lancamento ON nf_recebidas_cabecalho(lancamento_id);

ALTER TABLE nf_recebidas_cabecalho ENABLE ROW LEVEL SECURITY;
CREATE POLICY nf_recebidas_cab_admin ON nf_recebidas_cabecalho
  USING (auth.role() = 'service_role');


-- ── 2. NFs Recebidas — Itens ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nf_recebidas_itens (
  id              bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  numero          text NOT NULL,
  cnpj_fornecedor text,
  uf              text,
  emissao         date,
  codigo          text,
  ncm             text,
  ean             text,
  descricao       text,
  cfop            text,
  quantidade      numeric(14,4),
  valor_unitario  numeric(14,4),
  origem_cst      text,
  valor_icms_st   numeric(14,2),
  cst_pis         text,
  valor_pis       numeric(14,2),
  cst_cofins      text,
  valor_cofins    numeric(14,2),
  valor_ipi       numeric(14,2),
  valor_total     numeric(14,2)
);

COMMENT ON TABLE nf_recebidas_itens IS
  'Itens das NFs recebidas. Vinculados ao cabeçalho via numero + cnpj_fornecedor.';

CREATE INDEX IF NOT EXISTS idx_nf_rec_itens_numero ON nf_recebidas_itens(numero);

ALTER TABLE nf_recebidas_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY nf_recebidas_itens_admin ON nf_recebidas_itens
  USING (auth.role() = 'service_role');


-- ── 3. Extrato Bancário ───────────────────────────────────────────────────────
-- Cada linha do extrato representa uma movimentação real confirmada pelo banco.
-- Import previsto via OFX ou CSV — UI de import em fase futura.

CREATE TABLE IF NOT EXISTS extrato_bancario (
  id          bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  data        date NOT NULL,
  valor       numeric(14,2) NOT NULL,         -- positivo = crédito, negativo = débito
  tipo        text NOT NULL
    CHECK (tipo IN ('credito','debito')),
  descricao   text,
  conta       text NOT NULL DEFAULT 'banco',  -- 'banco', 'caixa', etc.
  doc         text,                            -- número do documento/cheque/transferência
  conciliado  boolean NOT NULL DEFAULT false,

  -- Preenchido quando conciliado com um lançamento
  lancamento_id bigint REFERENCES fin_lancamentos(id) ON DELETE SET NULL,

  importado_em timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE extrato_bancario IS
  'Linhas do extrato bancário real. Conciliação liga extrato_id ao fin_lancamentos.';

CREATE INDEX IF NOT EXISTS idx_extrato_data        ON extrato_bancario(data);
CREATE INDEX IF NOT EXISTS idx_extrato_conciliado  ON extrato_bancario(conciliado) WHERE conciliado = false;
CREATE INDEX IF NOT EXISTS idx_extrato_lancamento  ON extrato_bancario(lancamento_id);

ALTER TABLE extrato_bancario ENABLE ROW LEVEL SECURITY;
CREATE POLICY extrato_bancario_admin ON extrato_bancario
  USING (auth.role() = 'service_role');


-- ── 4. Vínculo extrato → lançamento em fin_lancamentos ───────────────────────
-- extrato_id: qual linha do extrato bancário confirmou o pagamento deste lançamento.

ALTER TABLE fin_lancamentos
  ADD COLUMN IF NOT EXISTS extrato_id bigint REFERENCES extrato_bancario(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fin_lanc_extrato ON fin_lancamentos(extrato_id);

COMMENT ON COLUMN fin_lancamentos.extrato_id IS
  'FK para extrato_bancario — preenchida quando o pagamento é confirmado por linha do extrato. NULL = não conciliado.';


-- ── 5. View de conciliação ────────────────────────────────────────────────────
-- Mostra lançamentos pendentes de despesa com candidatos do extrato:
-- mesmo sinal de valor (débito) e data próxima (±7 dias).
-- Consultada pelo operador para decidir o match.

CREATE OR REPLACE VIEW vw_fin_conciliacao AS
SELECT
  fl.id                                   AS lancamento_id,
  fl.descricao                            AS lanc_descricao,
  fl.valor                                AS lanc_valor,
  fl.data_vencimento,
  fl.origem,
  fl.nf_chave,
  fl.status                               AS lanc_status,

  -- Candidato de extrato: débito com valor próximo e data próxima
  e.id                                    AS extrato_id_candidato,
  e.data                                  AS extrato_data,
  ABS(e.valor)                            AS extrato_valor,
  e.descricao                             AS extrato_descricao,
  e.doc                                   AS extrato_doc,
  ABS(ABS(e.valor) - fl.valor)           AS diferenca_valor,
  ABS(e.data - fl.data_vencimento)       AS diferenca_dias

FROM fin_lancamentos fl
LEFT JOIN extrato_bancario e ON
  e.tipo = 'debito'
  AND e.conciliado = false
  AND ABS(e.valor) BETWEEN fl.valor * 0.95 AND fl.valor * 1.05   -- tolerância 5%
  AND e.data BETWEEN fl.data_vencimento - 7 AND fl.data_vencimento + 7

WHERE fl.tipo   = 'despesa'
  AND fl.status = 'pendente'
  AND fl.extrato_id IS NULL

ORDER BY fl.data_vencimento, diferenca_valor NULLS LAST;


-- ── 6. Função de conciliação ──────────────────────────────────────────────────
-- Executa o match entre um lançamento e uma linha de extrato.
-- Marca ambos, cria movimentação real e retorna resultado.

CREATE OR REPLACE FUNCTION fn_conciliar(
  p_lancamento_id bigint,
  p_extrato_id    bigint,
  p_data_pagamento date DEFAULT CURRENT_DATE
)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_lanc  fin_lancamentos%ROWTYPE;
  v_ext   extrato_bancario%ROWTYPE;
BEGIN
  SELECT * INTO v_lanc FROM fin_lancamentos  WHERE id = p_lancamento_id;
  SELECT * INTO v_ext  FROM extrato_bancario WHERE id = p_extrato_id;

  IF v_lanc.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Lançamento não encontrado');
  END IF;
  IF v_ext.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Linha de extrato não encontrada');
  END IF;
  IF v_ext.conciliado THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Linha de extrato já conciliada');
  END IF;

  -- Marca lançamento como pago e vincula ao extrato
  UPDATE fin_lancamentos
  SET status        = 'pago',
      data_pagamento = p_data_pagamento,
      extrato_id    = p_extrato_id
  WHERE id = p_lancamento_id;

  -- Marca extrato como conciliado
  UPDATE extrato_bancario
  SET conciliado    = true,
      lancamento_id = p_lancamento_id
  WHERE id = p_extrato_id;

  -- Cria movimentação real de caixa
  INSERT INTO fin_movimentacoes (lancamento_id, tipo, valor, data, conta, descricao)
  VALUES (
    p_lancamento_id,
    CASE WHEN v_lanc.tipo = 'receita' THEN 'entrada' ELSE 'saida' END,
    ABS(v_ext.valor),
    v_ext.data,
    v_ext.conta,
    COALESCE(v_ext.descricao, v_lanc.descricao)
  );

  RETURN jsonb_build_object(
    'ok',            true,
    'lancamento_id', p_lancamento_id,
    'extrato_id',    p_extrato_id,
    'valor_lanc',    v_lanc.valor,
    'valor_extrato', ABS(v_ext.valor),
    'diferenca',     ABS(ABS(v_ext.valor) - v_lanc.valor)
  );
END;
$$;

COMMENT ON FUNCTION fn_conciliar IS
  'Concilia um lançamento financeiro com uma linha de extrato bancário. Marca ambos, cria movimentação. Chamar via supabase.rpc(''fn_conciliar'').';
