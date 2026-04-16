-- Adiciona campo nome do responsável/contato na tabela prospeccao
ALTER TABLE prospeccao
  ADD COLUMN IF NOT EXISTS nome_contato TEXT;
