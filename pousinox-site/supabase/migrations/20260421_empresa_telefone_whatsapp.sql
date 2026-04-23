-- Adiciona flag de WhatsApp no telefone da empresa emissora
ALTER TABLE empresas_emissoras
  ADD COLUMN IF NOT EXISTS telefone_is_whatsapp BOOLEAN DEFAULT false;

-- Adiciona coluna no snapshot do orçamento
ALTER TABLE orcamentos
  ADD COLUMN IF NOT EXISTS empresa_telefone_is_whatsapp BOOLEAN DEFAULT false;
