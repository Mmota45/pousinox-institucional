-- Adiciona custo_realizado a ordens_manutencao (sem quebrar dados existentes)
ALTER TABLE ordens_manutencao
  ADD COLUMN IF NOT EXISTS custo_realizado NUMERIC(14,2) NULL;
