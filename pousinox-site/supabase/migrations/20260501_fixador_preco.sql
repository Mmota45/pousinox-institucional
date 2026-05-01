-- Adiciona preço unitário aos modelos de fixadores
ALTER TABLE fixador_modelos ADD COLUMN IF NOT EXISTS preco_unitario NUMERIC(10,2);

-- Adiciona campos PJ aos leads da calculadora
ALTER TABLE calculadora_leads ADD COLUMN IF NOT EXISTS cnpj TEXT;
ALTER TABLE calculadora_leads ADD COLUMN IF NOT EXISTS razao_social TEXT;
ALTER TABLE calculadora_leads ADD COLUMN IF NOT EXISTS segmento TEXT;
ALTER TABLE calculadora_leads ADD COLUMN IF NOT EXISTS tipo_pessoa TEXT DEFAULT 'pf';

-- Adiciona preço unitário aos consumíveis
ALTER TABLE fixador_consumiveis ADD COLUMN IF NOT EXISTS preco_unitario NUMERIC(10,2);

-- Tabela de feedback da calculadora
CREATE TABLE IF NOT EXISTS calculadora_feedback (
  id BIGSERIAL PRIMARY KEY,
  lead_id BIGINT REFERENCES calculadora_leads(id),
  tipo TEXT NOT NULL DEFAULT 'sugestao', -- sugestao | problema | elogio
  mensagem TEXT NOT NULL,
  pagina TEXT DEFAULT 'calculadora',
  criado_em TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE calculadora_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_calculadora_feedback" ON calculadora_feedback
  FOR ALL USING (auth.role() = 'service_role');

-- Permitir insert anon para feedback público
CREATE POLICY "anon_insert_calculadora_feedback" ON calculadora_feedback
  FOR INSERT WITH CHECK (true);
