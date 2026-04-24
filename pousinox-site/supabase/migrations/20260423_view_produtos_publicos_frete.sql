-- Recria a view produtos_publicos incluindo campos de frete
DROP VIEW IF EXISTS produtos_publicos;

CREATE VIEW produtos_publicos AS
SELECT
  id,
  titulo,
  categoria,
  tipo,
  marca,
  fabricante,
  descricao,
  specs,
  fotos,
  disponivel,
  quantidade,
  vendido_em,
  destaque,
  seminovo,
  preco,
  preco_original,
  desconto_max,
  ordem,
  created_at,
  exibir_preco,
  peso_kg,
  comprimento_cm,
  largura_cm,
  altura_cm,
  COALESCE(( SELECT count(*)::integer AS count
         FROM interesses
        WHERE interesses.produto_id = p.id), 0) AS total_interesses
FROM produtos p;
