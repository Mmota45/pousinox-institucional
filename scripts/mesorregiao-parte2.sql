
-- 2. Adiciona coluna na tabela de prospecção
ALTER TABLE prospeccao
  ADD COLUMN IF NOT EXISTS mesorregiao  text,
  ADD COLUMN IF NOT EXISTS microrregiao text;
