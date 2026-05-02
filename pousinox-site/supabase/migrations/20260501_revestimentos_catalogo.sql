-- Catálogo de revestimentos cerâmicos — autocomplete na calculadora
CREATE TABLE IF NOT EXISTS revestimentos_catalogo (
  id BIGSERIAL PRIMARY KEY,
  fabricante TEXT NOT NULL,
  linha TEXT,
  formato TEXT NOT NULL,           -- ex: "60×60", "120×240"
  largura_cm NUMERIC(6,1) NOT NULL,
  altura_cm NUMERIC(6,1) NOT NULL,
  espessura_mm NUMERIC(4,1),
  peso_peca_kg NUMERIC(6,2),
  peso_m2_kg NUMERIC(6,2),
  aplicacao TEXT DEFAULT 'parede', -- parede | piso | fachada | universal
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE revestimentos_catalogo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_revestimentos" ON revestimentos_catalogo
  FOR SELECT USING (true);
CREATE POLICY "service_role_revestimentos" ON revestimentos_catalogo
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_updated_at_revestimentos
  BEFORE UPDATE ON revestimentos_catalogo
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Índice para busca
CREATE INDEX idx_revestimentos_formato ON revestimentos_catalogo(formato);
CREATE INDEX idx_revestimentos_fabricante ON revestimentos_catalogo(fabricante);

-- Seed — formatos padrão do mercado brasileiro
-- Fontes: catálogos Portobello, Eliane, Ceusa, Delta, Portinari, Elizabeth
INSERT INTO revestimentos_catalogo (fabricante, formato, largura_cm, altura_cm, espessura_mm, peso_m2_kg, aplicacao) VALUES
  -- Formatos quadrados
  ('Padrão', '30×30', 30, 30, 7.5, 15.0, 'parede'),
  ('Padrão', '45×45', 45, 45, 8.0, 17.5, 'universal'),
  ('Padrão', '60×60', 60, 60, 9.0, 19.5, 'universal'),
  ('Padrão', '80×80', 80, 80, 10.0, 21.0, 'universal'),
  ('Padrão', '90×90', 90, 90, 10.0, 22.0, 'universal'),
  ('Padrão', '100×100', 100, 100, 10.5, 22.5, 'universal'),
  ('Padrão', '120×120', 120, 120, 11.0, 23.5, 'universal'),

  -- Formatos retangulares comuns
  ('Padrão', '30×60', 30, 60, 8.0, 17.5, 'parede'),
  ('Padrão', '32×60', 32, 60, 8.0, 17.0, 'parede'),
  ('Padrão', '45×90', 45, 90, 9.0, 19.5, 'universal'),
  ('Padrão', '60×120', 60, 120, 9.5, 20.5, 'universal'),
  ('Padrão', '80×160', 80, 160, 10.5, 22.0, 'fachada'),
  ('Padrão', '90×180', 90, 180, 10.5, 22.5, 'fachada'),
  ('Padrão', '120×240', 120, 240, 11.0, 24.0, 'fachada'),
  ('Padrão', '120×260', 120, 260, 11.5, 24.5, 'fachada'),
  ('Padrão', '120×278', 120, 278, 12.0, 25.0, 'fachada'),
  ('Padrão', '60×240', 60, 240, 10.0, 21.0, 'fachada'),

  -- Formatos slim / fina espessura
  ('Padrão', '120×240 Slim', 120, 240, 6.0, 14.5, 'fachada'),
  ('Padrão', '120×260 Slim', 120, 260, 6.0, 15.0, 'fachada'),
  ('Padrão', '100×300 Slim', 100, 300, 6.0, 15.5, 'fachada'),

  -- Grandes formatos (superformatos)
  ('Padrão', '160×320', 160, 320, 12.0, 26.0, 'fachada'),
  ('Padrão', '150×300', 150, 300, 11.0, 24.0, 'fachada'),

  -- Formatos pequenos (pastilha/subway)
  ('Padrão', '7×26', 7, 26, 7.0, 14.0, 'parede'),
  ('Padrão', '10×20', 10, 20, 7.0, 14.5, 'parede'),
  ('Padrão', '10×30', 10, 30, 7.5, 15.0, 'parede'),

  -- Porcelanato técnico externo (espesso)
  ('Padrão', '60×60 Ext 20mm', 60, 60, 20.0, 45.0, 'piso'),
  ('Padrão', '90×90 Ext 20mm', 90, 90, 20.0, 46.0, 'piso'),
  ('Padrão', '60×120 Ext 20mm', 60, 120, 20.0, 45.0, 'piso'),

  -- Portobello
  ('Portobello', '60×120', 60, 120, 9.5, 20.8, 'universal'),
  ('Portobello', '90×90', 90, 90, 10.0, 22.3, 'universal'),
  ('Portobello', '120×120', 120, 120, 11.0, 23.8, 'universal'),
  ('Portobello', '120×240', 120, 240, 11.0, 24.2, 'fachada'),
  ('Portobello', '120×240 Slim', 120, 240, 6.0, 14.8, 'fachada'),

  -- Eliane
  ('Eliane', '60×60', 60, 60, 9.0, 19.2, 'universal'),
  ('Eliane', '60×120', 60, 120, 9.0, 20.0, 'universal'),
  ('Eliane', '90×90', 90, 90, 10.0, 21.5, 'universal'),
  ('Eliane', '80×160', 80, 160, 10.5, 22.0, 'fachada'),

  -- Ceusa
  ('Ceusa', '60×120', 60, 120, 9.5, 20.5, 'universal'),
  ('Ceusa', '120×120', 120, 120, 10.5, 23.0, 'universal'),

  -- Portinari (Grupo Roca)
  ('Portinari', '60×120', 60, 120, 9.0, 20.0, 'universal'),
  ('Portinari', '90×90', 90, 90, 10.0, 21.8, 'universal'),
  ('Portinari', '120×240', 120, 240, 11.0, 24.0, 'fachada');
