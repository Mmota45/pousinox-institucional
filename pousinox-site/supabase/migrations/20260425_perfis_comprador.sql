-- Perfis de comprador cadastráveis
CREATE TABLE IF NOT EXISTS perfis_comprador (
  id BIGSERIAL PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT,
  mostrar_ie BOOLEAN NOT NULL DEFAULT false,
  mostrar_contato BOOLEAN NOT NULL DEFAULT true,
  mostrar_contatos_adicionais BOOLEAN NOT NULL DEFAULT true,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INT NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ DEFAULT now()
);

-- Defaults
INSERT INTO perfis_comprador (nome, descricao, mostrar_ie, mostrar_contato, mostrar_contatos_adicionais, ordem) VALUES
  ('revendedor', 'Revendedor / Distribuidor', true, true, true, 1),
  ('aplicador', 'Aplicador / Instalador', false, true, false, 2),
  ('construtora', 'Construtora / Incorporadora', true, true, true, 3),
  ('dono_obra', 'Dono de Obra / Consumidor Final', false, true, false, 4),
  ('especificador', 'Especificador / Arquiteto / Engenheiro', false, true, false, 5)
ON CONFLICT (nome) DO NOTHING;

-- RLS
ALTER TABLE perfis_comprador ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perfis_comprador_service" ON perfis_comprador USING (auth.role() = 'service_role');
CREATE POLICY "perfis_comprador_anon_read" ON perfis_comprador FOR SELECT USING (true);

-- Novas colunas em orcamentos
ALTER TABLE orcamentos
  ADD COLUMN IF NOT EXISTS cliente_nome_fantasia TEXT,
  ADD COLUMN IF NOT EXISTS cliente_telefone_is_whatsapp BOOLEAN DEFAULT false;
