INSERT INTO portfolio_normas (norma, orgao, titulo, status, segmentos, penalidade, observacao) VALUES
('ABNT NBR 17025', 'ABNT', 'Requisitos gerais para competência de laboratórios de ensaio e calibração', 'vigente', ARRAY['Laboratórios'], 'Perda de acreditação INMETRO — laboratório não pode emitir laudos válidos', 'Bancadas, pias, prateleiras e armários devem ser em material resistente à corrosão. Inox é padrão para laboratórios acreditados.'),
('ABNT NBR 14718', 'ABNT', 'Guarda-corpos para edificação — requisitos, procedimentos e desempenho', 'vigente', ARRAY['Construtoras','Engenharia Civil','Arquitetura','Incorporadora','Condomínio','Pousada','Resort'], 'Responsabilidade civil por acidentes — indenizações milionárias', 'Define carga mínima de resistência para guarda-corpos. Aço inox 304 atende todos os requisitos de resistência e durabilidade.'),
('ABNT NBR 16259', 'ABNT', 'Sistemas de fachada com fixação e ancoragem — requisitos e métodos de ensaio', 'vigente', ARRAY['Construtoras','Engenharia Civil','Incorporadora','Revestimentos','Pisos','Arquitetura'], 'Responsabilidade civil por desplacamento de fachada — risco de morte', 'Fixadores de porcelanato em aço inox 304 são exigidos para fachadas ventiladas e revestimentos pesados.'),
('CFMV 1275/2019', 'CFMV', 'Resolução sobre instalações e equipamentos para estabelecimentos veterinários', 'vigente', ARRAY['Veterinária'], 'Cassação do registro no CRMV — estabelecimento não pode funcionar', 'Mesas cirúrgicas, pias e banheiras devem ser em material liso, impermeável e resistente à corrosão. Inox é o padrão.')
ON CONFLICT (norma) DO UPDATE SET
  segmentos = EXCLUDED.segmentos,
  penalidade = EXCLUDED.penalidade,
  observacao = EXCLUDED.observacao,
  titulo = EXCLUDED.titulo;
