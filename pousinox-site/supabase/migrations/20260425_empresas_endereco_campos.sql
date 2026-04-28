-- Adicionar campos de endereço separados à empresas_emissoras
ALTER TABLE empresas_emissoras
  ADD COLUMN IF NOT EXISTS logradouro TEXT,
  ADD COLUMN IF NOT EXISTS complemento TEXT,
  ADD COLUMN IF NOT EXISTS bairro TEXT,
  ADD COLUMN IF NOT EXISTS cidade TEXT,
  ADD COLUMN IF NOT EXISTS uf TEXT;

-- Comentários
COMMENT ON COLUMN empresas_emissoras.logradouro IS 'Logradouro (preenchido via CEP)';
COMMENT ON COLUMN empresas_emissoras.complemento IS 'Complemento do endereço';
COMMENT ON COLUMN empresas_emissoras.bairro IS 'Bairro (preenchido via CEP)';
COMMENT ON COLUMN empresas_emissoras.cidade IS 'Cidade (preenchido via CEP)';
COMMENT ON COLUMN empresas_emissoras.uf IS 'UF (preenchido via CEP)';
