-- ══════════════════════════════════════════════════════════════════════════════
-- Compras / Suprimentos — pedidos de compra
-- ══════════════════════════════════════════════════════════════════════════════

-- Cabeçalho do pedido
CREATE TABLE IF NOT EXISTS pedidos_compra (
  id               bigserial PRIMARY KEY,
  fornecedor_id    bigint REFERENCES fornecedores(id) ON DELETE SET NULL,
  status           text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','enviado','recebido','cancelado')),
  data_pedido      date NOT NULL DEFAULT CURRENT_DATE,
  previsao_entrega date,
  valor_total      numeric(12,2),
  observacao       text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- set_updated_at já existe (criada em pipeline_deals). Apenas o trigger:
CREATE TRIGGER pedidos_compra_updated_at
  BEFORE UPDATE ON pedidos_compra
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Itens do pedido
CREATE TABLE IF NOT EXISTS pedidos_compra_itens (
  id          bigserial PRIMARY KEY,
  pedido_id   bigint NOT NULL REFERENCES pedidos_compra(id) ON DELETE CASCADE,
  material_id bigint REFERENCES materiais(id) ON DELETE SET NULL,
  descricao   text NOT NULL,
  unidade     text NOT NULL DEFAULT 'kg',
  quantidade  numeric(12,3) NOT NULL,
  preco_unit  numeric(12,4),
  observacao  text
);

CREATE INDEX IF NOT EXISTS idx_pedidos_fornecedor ON pedidos_compra(fornecedor_id) WHERE fornecedor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pedidos_status     ON pedidos_compra(status);
CREATE INDEX IF NOT EXISTS idx_pedidos_itens      ON pedidos_compra_itens(pedido_id);

-- RLS
ALTER TABLE pedidos_compra       ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos_compra_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all" ON pedidos_compra
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "admin_all" ON pedidos_compra_itens
  FOR ALL USING (auth.role() = 'service_role');
