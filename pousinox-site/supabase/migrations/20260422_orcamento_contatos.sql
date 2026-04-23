-- Novos campos no orçamento: e-mail NFs/boletos, contatos múltiplos, responsável local de entrega
ALTER TABLE orcamentos
  ADD COLUMN IF NOT EXISTS cliente_email_nf       TEXT,
  ADD COLUMN IF NOT EXISTS cliente_contatos        JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS cliente_ent_responsavel TEXT,
  ADD COLUMN IF NOT EXISTS cliente_ent_telefone    TEXT,
  ADD COLUMN IF NOT EXISTS cliente_ent_whatsapp    TEXT;
