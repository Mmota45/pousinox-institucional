-- Comissões mensais por vendedor
CREATE TABLE IF NOT EXISTS comissoes (
  id               BIGSERIAL PRIMARY KEY,
  vendedor_id      INT NOT NULL REFERENCES vendedores(id),
  vendedor_nome    TEXT,
  periodo          TEXT NOT NULL,             -- YYYY-MM
  base_valor       NUMERIC(14,2) DEFAULT 0,
  comissao_pct     NUMERIC(5,2)  DEFAULT 0,
  valor_comissao   NUMERIC(14,2) DEFAULT 0,
  status           TEXT DEFAULT 'pendente'
                   CHECK (status IN ('pendente','pago','cancelado')),
  data_vencimento  DATE,
  data_pagamento   DATE,
  fin_lancamento_id BIGINT REFERENCES fin_lancamentos(id),
  calculado_em     TIMESTAMPTZ DEFAULT now(),
  UNIQUE (vendedor_id, periodo)
);
ALTER TABLE comissoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role only" ON comissoes USING (auth.role() = 'service_role');

-- vendedor_id em vendas (para vendas sem orcamento)
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS vendedor_id   INT  REFERENCES vendedores(id);
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS vendedor_nome TEXT;
