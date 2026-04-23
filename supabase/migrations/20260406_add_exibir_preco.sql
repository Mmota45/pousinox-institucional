-- Adiciona campo exibir_preco na tabela produtos
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS exibir_preco boolean NOT NULL DEFAULT false;

-- Recria a view para incluir o novo campo
CREATE OR REPLACE VIEW produtos_publicos AS
SELECT
  p.id,
  p.titulo,
  p.categoria,
  p.tipo,
  p.marca,
  p.fabricante,
  p.descricao,
  p.specs,
  p.fotos,
  p.disponivel,
  p.quantidade,
  p.vendido_em,
  p.destaque,
  p.seminovo,
  p.preco,
  p.preco_original,
  p.desconto_max,
  p.ordem,
  p.created_at,
  p.exibir_preco,
  COALESCE(
    (SELECT COUNT(*)::integer FROM interesses WHERE produto_id = p.id),
    0
  ) AS total_interesses
FROM produtos p;
