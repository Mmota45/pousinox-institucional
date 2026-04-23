-- RPC v2: exclui lançamento com tratamento de exceções em cada etapa
-- Não usa DISABLE TRIGGER (exige superuser). Cada bloco tem EXCEPTION isolado.

CREATE OR REPLACE FUNCTION excluir_lancamento(p_id BIGINT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Limpa FK em tabelas de origem (ignora erros de trigger individualmente)
  BEGIN
    UPDATE pipeline_deals SET fin_lancamento_id = NULL WHERE fin_lancamento_id = p_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    UPDATE projetos SET fin_lancamento_id = NULL WHERE fin_lancamento_id = p_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    UPDATE vendas SET fin_lancamento_id = NULL WHERE fin_lancamento_id = p_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- 2. Exclui parcelas vinculadas
  BEGIN
    DELETE FROM fin_parcelas WHERE lancamento_id = p_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- 3. Exclui movimentações vinculadas
  BEGIN
    DELETE FROM fin_movimentacoes WHERE lancamento_id = p_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- 4. Exclui o lançamento (sem catches — se falhar aqui é erro real)
  DELETE FROM fin_lancamentos WHERE id = p_id;

END;
$$;

REVOKE ALL ON FUNCTION excluir_lancamento(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION excluir_lancamento(BIGINT) TO service_role;
