-- Função para buscar concorrentes por termos no razao_social/nome_fantasia
-- Usa um único ILIKE com regex alternation (mais eficiente que 20 OR)
CREATE OR REPLACE FUNCTION fn_buscar_concorrentes(p_limit INT DEFAULT 2000)
RETURNS TABLE (
  id BIGINT,
  cnpj TEXT,
  razao_social TEXT,
  nome_fantasia TEXT,
  porte TEXT,
  uf TEXT,
  cidade TEXT,
  segmento TEXT,
  produto TEXT,
  cliente_ativo BOOLEAN,
  telefone1 TEXT,
  email TEXT
) LANGUAGE sql STABLE AS $$
  SELECT p.id, p.cnpj, p.razao_social, p.nome_fantasia, p.porte, p.uf, p.cidade,
         p.segmento, p.produto, p.cliente_ativo, p.telefone1, p.email
  FROM prospeccao p
  WHERE p.razao_social ~* '(inox|metalurgica|metalúrgica|equipamento.?industrial|cozinha.?industrial|equipamentos.?hospitalares|fixador|aço.?inoxidável)'
     OR p.nome_fantasia ~* '(inox|metalurgica|metalúrgica|equipamento.?industrial|cozinha.?industrial|equipamentos.?hospitalares|fixador|aço.?inoxidável)'
  ORDER BY p.uf
  LIMIT p_limit;
$$;
