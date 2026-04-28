-- Configuração de frete próprio
CREATE TABLE IF NOT EXISTS frete_proprio_config (
  id BIGSERIAL PRIMARY KEY,
  raio_max_km NUMERIC(8,2) NOT NULL DEFAULT 100,
  valor_por_km NUMERIC(8,2) NOT NULL DEFAULT 3.00,
  frete_minimo NUMERIC(8,2) NOT NULL DEFAULT 30.00,
  faixa1_km NUMERIC(8,2) NOT NULL DEFAULT 30,
  faixa1_prazo TEXT NOT NULL DEFAULT 'No mesmo dia',
  faixa2_prazo TEXT NOT NULL DEFAULT '1 dia útil',
  horario_corte TIME NOT NULL DEFAULT '14:00',
  ativo BOOLEAN NOT NULL DEFAULT true,
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

-- Insert default
INSERT INTO frete_proprio_config (raio_max_km, valor_por_km, frete_minimo, faixa1_km, faixa1_prazo, faixa2_prazo, horario_corte)
VALUES (100, 3.00, 30.00, 30, 'No mesmo dia', '1 dia útil', '14:00');

-- RLS
ALTER TABLE frete_proprio_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "frete_proprio_config_service" ON frete_proprio_config USING (auth.role() = 'service_role');
-- Leitura pública para edge function
CREATE POLICY "frete_proprio_config_anon_read" ON frete_proprio_config FOR SELECT USING (true);
