-- Campo WhatsApp separado + validação
ALTER TABLE prospeccao ADD COLUMN IF NOT EXISTS whatsapp text;
ALTER TABLE prospeccao ADD COLUMN IF NOT EXISTS whatsapp_validado boolean DEFAULT false;

-- Índice para filtro "só com WhatsApp"
CREATE INDEX IF NOT EXISTS idx_prospeccao_whatsapp ON prospeccao(whatsapp) WHERE whatsapp IS NOT NULL;
