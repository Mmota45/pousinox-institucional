-- Policy leitura anon para dados bancários (tabela já existe)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='dados_bancarios' AND policyname='dados_bancarios_anon_read') THEN
    CREATE POLICY "dados_bancarios_anon_read" ON dados_bancarios FOR SELECT USING (ativo = true);
  END IF;
END $$;

-- Pedidos outlet
CREATE TABLE pedidos_outlet (
  id BIGSERIAL PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'aguardando_pagamento'
    CHECK (status IN ('aguardando_pagamento','pago','preparando','enviado','entregue','cancelado')),

  cliente_nome TEXT NOT NULL,
  cliente_cpf_cnpj TEXT,
  cliente_email TEXT NOT NULL,
  cliente_telefone TEXT NOT NULL,
  cliente_cep TEXT NOT NULL,
  cliente_endereco TEXT NOT NULL,
  cliente_numero TEXT,
  cliente_complemento TEXT,
  cliente_bairro TEXT,
  cliente_cidade TEXT NOT NULL,
  cliente_uf TEXT NOT NULL,

  frete_servico TEXT NOT NULL,
  frete_codigo TEXT,
  frete_preco NUMERIC(14,2) NOT NULL DEFAULT 0,
  frete_prazo_dias INT,
  frete_prazo_texto TEXT,

  subtotal NUMERIC(14,2) NOT NULL,
  total NUMERIC(14,2) NOT NULL,

  forma_pagamento TEXT DEFAULT 'pix',
  data_pagamento TIMESTAMPTZ,
  comprovante_url TEXT,

  codigo_rastreio TEXT,
  transportadora TEXT,

  obs_cliente TEXT,
  obs_interna TEXT,

  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS pedidos_outlet_numero_seq START 1;

CREATE TABLE pedidos_outlet_itens (
  id BIGSERIAL PRIMARY KEY,
  pedido_id BIGINT NOT NULL REFERENCES pedidos_outlet(id) ON DELETE CASCADE,
  produto_id BIGINT NOT NULL,
  titulo TEXT NOT NULL,
  preco_unitario NUMERIC(14,2) NOT NULL,
  quantidade INT NOT NULL DEFAULT 1,
  subtotal NUMERIC(14,2) NOT NULL
);

-- RLS
ALTER TABLE pedidos_outlet ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pedidos_outlet_service" ON pedidos_outlet USING (auth.role() = 'service_role');
CREATE POLICY "pedidos_outlet_anon_insert" ON pedidos_outlet FOR INSERT WITH CHECK (true);
CREATE POLICY "pedidos_outlet_anon_select" ON pedidos_outlet FOR SELECT USING (true);

ALTER TABLE pedidos_outlet_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pedidos_outlet_itens_service" ON pedidos_outlet_itens USING (auth.role() = 'service_role');
CREATE POLICY "pedidos_outlet_itens_anon_insert" ON pedidos_outlet_itens FOR INSERT WITH CHECK (true);
CREATE POLICY "pedidos_outlet_itens_anon_select" ON pedidos_outlet_itens FOR SELECT USING (true);

CREATE TRIGGER set_pedidos_outlet_updated_at BEFORE UPDATE ON pedidos_outlet
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
