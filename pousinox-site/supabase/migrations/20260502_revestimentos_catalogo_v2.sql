-- Ampliação do catálogo de revestimentos — formatos reais de fabricantes brasileiros
-- Fontes: Telhanorte, Leroy Merlin, catálogos Portobello/Delta/Eliane/Biancogres/Ceusa/Portinari/Elizabeth
-- Peso estimado quando não disponível: espessura_mm × 2.35 (densidade porcelanato ~2350 kg/m³)

-- Índice único para evitar duplicatas
CREATE UNIQUE INDEX IF NOT EXISTS idx_revestimentos_unico
  ON revestimentos_catalogo (fabricante, formato, COALESCE(linha, ''));

INSERT INTO revestimentos_catalogo (fabricante, linha, formato, largura_cm, altura_cm, espessura_mm, peso_m2_kg, aplicacao) VALUES

  -- ═══ AMADEIRADOS 20×120 ═══
  ('Portobello', 'Ibirap Mix Marrom', '20×120', 20, 120, 9.0, 20.6, 'parede'),
  ('Portobello', 'Canela Dourada', '20×120', 20, 120, 9.0, 20.6, 'parede'),
  ('Portobello', 'Parquet D''Olivier', '20×120', 20, 120, 9.0, 20.6, 'parede'),
  ('Portobello', 'Betula', '20×120', 20, 120, 9.0, 20.6, 'parede'),
  ('Portobello', 'Arca Nordic', '20×120', 20, 120, 9.0, 20.6, 'parede'),
  ('Portobello', 'Tramontana', '20×120', 20, 120, 9.0, 20.6, 'parede'),
  ('Portobello', 'Californian Wood', '20×120', 20, 120, 9.0, 20.6, 'parede'),
  ('Biancogres', 'Carvalho Natural', '20×120', 20, 120, 9.0, 21.2, 'universal'),
  ('Biancogres', 'Aurora Bianco', '20×120', 20, 120, 9.0, 21.2, 'universal'),
  ('Biancogres', 'Arbo Rosso', '20×120', 20, 120, 9.0, 21.2, 'universal'),
  ('Biancogres', 'Arbo Natural', '20×120', 20, 120, 9.0, 21.2, 'universal'),
  ('Biancogres', 'Scala Bege', '20×120', 20, 120, 9.0, 21.2, 'universal'),
  ('Biancogres', 'Legno Maso', '20×120', 20, 120, 9.0, 21.2, 'universal'),
  ('Biancogres', 'Teca Natural', '20×120', 20, 120, 9.0, 21.2, 'universal'),
  ('Biancogres', 'Madeiro Mix', '20×120', 20, 120, 9.0, 21.2, 'universal'),
  ('Delta', 'Bali Camel Amadeirado', '20×120', 20, 120, 9.0, 21.2, 'universal'),
  ('Padrão', NULL, '20×120', 20, 120, 9.0, 21.2, 'universal'),

  -- ═══ AMADEIRADOS 20×60 ═══
  ('Padrão', NULL, '20×60', 20, 60, 8.0, 18.8, 'parede'),
  ('Portobello', 'Deck', '20×60', 20, 60, 8.0, 18.8, 'parede'),

  -- ═══ RETANGULARES 30×90 / 30×120 ═══
  ('Padrão', NULL, '30×90', 30, 90, 9.0, 21.2, 'parede'),
  ('Padrão', NULL, '30×120', 30, 120, 9.0, 21.2, 'parede'),
  ('Portobello', 'Slim', '30×120', 30, 120, 6.0, 14.1, 'parede'),

  -- ═══ DELTA — formatos específicos ═══
  ('Delta', 'Dallas Light Gray', '70×70', 70, 70, 9.5, 22.3, 'universal'),
  ('Delta', 'Cotton', '84×84', 84, 84, 10.0, 23.5, 'universal'),
  ('Delta', 'Oslo Ceniza', '84×84', 84, 84, 10.0, 23.5, 'universal'),
  ('Delta', 'Oslo Macchiato', '84×84', 84, 84, 10.0, 23.5, 'universal'),
  ('Delta', 'Romano Avena', '90×90', 90, 90, 10.0, 23.5, 'universal'),
  ('Delta', NULL, '35×70', 35, 70, 8.5, 20.0, 'parede'),
  ('Delta', NULL, '53×106', 53, 106, 9.0, 21.2, 'universal'),
  ('Delta', NULL, '62×62', 62, 62, 9.0, 21.2, 'universal'),
  ('Delta', NULL, '63×63', 63, 63, 9.0, 21.2, 'universal'),
  ('Delta', NULL, '63×120', 63, 120, 9.5, 22.3, 'universal'),
  ('Delta', NULL, '72×72', 72, 72, 9.5, 22.3, 'universal'),
  ('Delta', NULL, '73×100', 73, 100, 10.0, 23.5, 'universal'),
  ('Delta', NULL, '84×120', 84, 120, 10.0, 23.5, 'fachada'),
  ('Delta', NULL, '90×120', 90, 120, 10.0, 23.5, 'fachada'),
  ('Delta', 'Dharma Oro', '120×120', 120, 120, 11.0, 25.9, 'fachada'),

  -- ═══ PORTOBELLO — formatos adicionais ═══
  ('Portobello', NULL, '20×20', 20, 20, 7.0, 16.5, 'parede'),
  ('Portobello', NULL, '30×60', 30, 60, 8.0, 18.8, 'parede'),
  ('Portobello', NULL, '100×300', 100, 300, 6.0, 14.1, 'fachada'),
  ('Portobello', NULL, '180×360', 180, 360, 6.0, 14.1, 'fachada'),
  ('Portobello', NULL, '90×180', 90, 180, 10.5, 24.7, 'fachada'),

  -- ═══ CEUSA ═══
  ('Ceusa', 'Demolição', '28.8×119', 28.8, 119, 9.0, 21.2, 'universal'),
  ('Ceusa', NULL, '41×86.5', 41, 86.5, 9.0, 21.2, 'universal'),
  ('Ceusa', NULL, '80×80', 80, 80, 10.0, 23.5, 'universal'),
  ('Ceusa', NULL, '60×60', 60, 60, 9.0, 21.2, 'universal'),

  -- ═══ PORTINARI ═══
  ('Portinari', NULL, '30×60', 30, 60, 8.0, 18.8, 'parede'),
  ('Portinari', NULL, '60×60', 60, 60, 9.0, 21.2, 'universal'),
  ('Portinari', NULL, '80×80', 80, 80, 10.0, 23.5, 'universal'),
  ('Portinari', NULL, '80×160', 80, 160, 10.5, 24.7, 'fachada'),

  -- ═══ ELIZABETH ═══
  ('Elizabeth', NULL, '45×45', 45, 45, 8.0, 18.8, 'universal'),
  ('Elizabeth', NULL, '60×60', 60, 60, 9.0, 21.2, 'universal'),
  ('Elizabeth', NULL, '80×80', 80, 80, 10.0, 23.5, 'universal'),

  -- ═══ ELIANE — formatos adicionais ═══
  ('Eliane', NULL, '30×60', 30, 60, 8.0, 18.8, 'parede'),
  ('Eliane', NULL, '45×45', 45, 45, 8.0, 18.8, 'universal'),
  ('Eliane', NULL, '120×120', 120, 120, 11.0, 25.9, 'universal'),
  ('Eliane', NULL, '120×240', 120, 240, 11.0, 25.9, 'fachada'),

  -- ═══ BIANCOGRES — outros formatos ═══
  ('Biancogres', NULL, '60×60', 60, 60, 9.0, 21.2, 'universal'),
  ('Biancogres', NULL, '60×120', 60, 120, 9.5, 22.3, 'universal'),

  -- ═══ ITAGRES ═══
  ('Itagres', NULL, '45×45', 45, 45, 8.0, 18.8, 'universal'),
  ('Itagres', NULL, '60×60', 60, 60, 9.0, 21.2, 'universal'),

  -- ═══ RIPADOS / AMADEIRADOS menores ═══
  ('Padrão', NULL, '15×90 Amadeirado', 15, 90, 8.0, 18.8, 'parede'),
  ('Padrão', NULL, '10×60 Ripado', 10, 60, 7.5, 17.6, 'parede'),
  ('Padrão', NULL, '7×60 Ripado', 7, 60, 7.0, 16.5, 'parede')

ON CONFLICT (fabricante, formato, COALESCE(linha, '')) DO NOTHING;
