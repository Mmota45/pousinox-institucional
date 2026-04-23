-- ══════════════════════════════════════════════════════════════════════════════
-- Conciliação bancária: fitid + fn_desconciliar
-- ══════════════════════════════════════════════════════════════════════════════


-- ── 1. FITID em extrato_bancario (idempotência OFX) ──────────────────────────
-- OFX traz um ID único por transação (FITID). Garante que reimportações
-- do mesmo arquivo não dupliquem linhas. CSV sem FITID fica NULL (aceito).

ALTER TABLE extrato_bancario
  ADD COLUMN IF NOT EXISTS fitid text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_extrato_fitid
  ON extrato_bancario(fitid) WHERE fitid IS NOT NULL;

COMMENT ON COLUMN extrato_bancario.fitid IS
  'Financial Institution Transaction ID (OFX). Único quando presente — garante idempotência na reimportação.';


-- ── 2. fn_desconciliar — desfaz um match já confirmado ───────────────────────
-- Reverte o que fn_conciliar fez:
--   • fin_lancamentos → status='pendente', data_pagamento=NULL, extrato_id=NULL
--   • extrato_bancario → conciliado=false, lancamento_id=NULL
--   • fin_movimentacoes → deleta a linha criada pela conciliação

CREATE OR REPLACE FUNCTION fn_desconciliar(p_lancamento_id bigint)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_extrato_id bigint;
BEGIN
  SELECT extrato_id INTO v_extrato_id
  FROM fin_lancamentos WHERE id = p_lancamento_id;

  -- Reverte lançamento
  UPDATE fin_lancamentos
  SET status         = 'pendente',
      data_pagamento = NULL,
      extrato_id     = NULL
  WHERE id = p_lancamento_id
    AND status = 'pago';

  -- Libera linha de extrato
  IF v_extrato_id IS NOT NULL THEN
    UPDATE extrato_bancario
    SET conciliado    = false,
        lancamento_id = NULL
    WHERE id = v_extrato_id;
  END IF;

  -- Remove movimentação gerada pela conciliação
  DELETE FROM fin_movimentacoes WHERE lancamento_id = p_lancamento_id;

  RETURN jsonb_build_object(
    'ok',            true,
    'lancamento_id', p_lancamento_id,
    'extrato_id',    v_extrato_id
  );
END;
$$;

COMMENT ON FUNCTION fn_desconciliar IS
  'Desfaz conciliação: reverte status do lançamento, libera linha de extrato e remove movimentação. Chamar via supabase.rpc(''fn_desconciliar'').';
