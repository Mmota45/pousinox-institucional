ALTER TABLE orcamentos
  ADD COLUMN IF NOT EXISTS perfil_comprador TEXT
    CHECK (perfil_comprador IN ('revendedor','aplicador','dono_obra','especificador'));
