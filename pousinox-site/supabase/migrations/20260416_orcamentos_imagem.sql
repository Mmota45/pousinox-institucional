-- Imagem opcional no orçamento (produto, projeto ou referência visual)
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS imagem_url TEXT;
