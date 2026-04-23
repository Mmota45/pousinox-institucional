-- Campos para cálculo de frete nos produtos (outlet/pronta-entrega)
ALTER TABLE produtos
  ADD COLUMN IF NOT EXISTS peso_kg    NUMERIC(8,3),
  ADD COLUMN IF NOT EXISTS comprimento_cm NUMERIC(6,1),
  ADD COLUMN IF NOT EXISTS largura_cm    NUMERIC(6,1),
  ADD COLUMN IF NOT EXISTS altura_cm     NUMERIC(6,1);

COMMENT ON COLUMN produtos.peso_kg IS 'Peso em kg para cálculo de frete';
COMMENT ON COLUMN produtos.comprimento_cm IS 'Comprimento em cm para cálculo de frete';
COMMENT ON COLUMN produtos.largura_cm IS 'Largura em cm para cálculo de frete';
COMMENT ON COLUMN produtos.altura_cm IS 'Altura em cm para cálculo de frete';
