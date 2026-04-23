-- Adiciona campo especialidades em cartoes_digitais
ALTER TABLE cartoes_digitais
  ADD COLUMN IF NOT EXISTS especialidades TEXT[] NOT NULL DEFAULT '{}';
