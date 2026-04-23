ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS vendedor_telefone TEXT;
ALTER TABLE empresas_emissoras ADD COLUMN IF NOT EXISTS cep TEXT;
ALTER TABLE empresas_emissoras ADD COLUMN IF NOT EXISTS numero TEXT;
