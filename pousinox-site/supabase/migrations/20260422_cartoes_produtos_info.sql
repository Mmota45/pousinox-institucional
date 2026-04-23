-- Adiciona produtos_info JSONB para armazenar foto e link de cada produto no cartão digital
ALTER TABLE cartoes_digitais
  ADD COLUMN IF NOT EXISTS produtos_info JSONB NOT NULL DEFAULT '[]';
