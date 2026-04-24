-- Adiciona coluna para persistir ID da pré-postagem Correios
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS etiqueta_pre_id TEXT;
