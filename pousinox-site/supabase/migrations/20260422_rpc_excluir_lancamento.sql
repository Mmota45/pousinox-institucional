-- RPC para excluir lançamento financeiro com cascata segura
-- Desativa triggers de updated_at durante a operação para evitar erros de coluna

CREATE OR REPLACE FUNCTION excluir_lancamento(p_id BIGINT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Exclui movimentações vinculadas (sem disparar trigger updated_at)
  ALTER TABLE fin_movimentacoes DISABLE TRIGGER fin_movimentacoes_updated_at;
  DELETE FROM fin_movimentacoes WHERE lancamento_id = p_id;
  ALTER TABLE fin_movimentacoes ENABLE TRIGGER fin_movimentacoes_updated_at;

  -- 2. Limpa FK nas tabelas de origem (ignora se trigger falhar)
  BEGIN
    UPDATE pipeline_deals SET fin_lancamento_id = NULL WHERE fin_lancamento_id = p_id;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    UPDATE projetos SET fin_lancamento_id = NULL WHERE fin_lancamento_id = p_id;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    UPDATE vendas SET fin_lancamento_id = NULL WHERE fin_lancamento_id = p_id;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- 3. Exclui parcelas vinculadas
  DELETE FROM fin_parcelas WHERE lancamento_id = p_id;

  -- 4. Exclui o lançamento
  ALTER TABLE fin_lancamentos DISABLE TRIGGER fin_lancamentos_updated_at;
  DELETE FROM fin_lancamentos WHERE id = p_id;
  ALTER TABLE fin_lancamentos ENABLE TRIGGER fin_lancamentos_updated_at;
END;
$$;

REVOKE ALL ON FUNCTION excluir_lancamento(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION excluir_lancamento(BIGINT) TO service_role;
