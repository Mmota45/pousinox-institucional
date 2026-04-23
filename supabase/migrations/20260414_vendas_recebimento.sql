-- Adiciona campos para distinguir venda à vista de venda a prazo
-- Compatível com registros existentes (DEFAULT 'a_vista' preserva semântica atual)

ALTER TABLE vendas
  ADD COLUMN IF NOT EXISTS recebimento        text NOT NULL DEFAULT 'a_vista'
    CHECK (recebimento IN ('a_vista', 'a_prazo')),
  ADD COLUMN IF NOT EXISTS data_vencimento    date,
  ADD COLUMN IF NOT EXISTS condicao_pagamento text;

COMMENT ON COLUMN vendas.recebimento IS
  'a_vista = recebido no ato (cria movimentação imediata) | a_prazo = faturado para receber depois (pendente no financeiro)';

COMMENT ON COLUMN vendas.data_vencimento IS
  'Preenchido apenas quando recebimento = a_prazo';

COMMENT ON COLUMN vendas.condicao_pagamento IS
  'Preenchido apenas quando recebimento = a_prazo (ex: 30d, 60d, parcelado)';
