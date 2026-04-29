-- Proposta Comercial — campos extras no orçamento
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS modo_proposta BOOLEAN DEFAULT false;
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS proposta_comercial JSONB;

COMMENT ON COLUMN orcamentos.modo_proposta IS 'true = proposta comercial completa, false = orçamento simples';
COMMENT ON COLUMN orcamentos.proposta_comercial IS 'JSONB com seções: apresentacao, problema, escopo, cronograma, garantias, revisaoFinal';
