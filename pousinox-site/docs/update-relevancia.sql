-- Ajustar relevâncias no segmento_portfolio
-- Escala: 10=obrigatório/core, 8=muito relevante, 6=complementar, 4=cross-sell

-- 1. Reset: tudo começa em 6 (complementar)
UPDATE segmento_portfolio SET relevancia = 6;

-- 2. Produtos CORE por segmento (relevância 10)
-- Bancadas, mesas de trabalho, pias — core para TODOS os segmentos alimentícios
UPDATE segmento_portfolio sp SET relevancia = 10
FROM portfolio_produtos pp
WHERE sp.produto_id = pp.id
AND pp.nome ILIKE ANY(ARRAY['%bancada%', '%mesa de trabalho%', '%mesa de desossa%', '%mesa de corte%', '%pia%', '%cuba%', '%tanque%'])
AND sp.segmento IN ('Restaurantes', 'Açougue/Frigorífico/Casa de Carnes', 'Padaria', 'Panificação', 'Confeitaria',
  'Hospitalar', 'Laboratórios', 'Hotelaria', 'Supermercados', 'Peixarias', 'Bar', 'Lanchonete',
  'Hamburgueria', 'Pizzaria', 'Sorveteria', 'Buffet', 'Cafeteria', 'Cantina');

-- Coifas e exaustores — core para cozinhas
UPDATE segmento_portfolio sp SET relevancia = 10
FROM portfolio_produtos pp
WHERE sp.produto_id = pp.id
AND pp.nome ILIKE ANY(ARRAY['%coifa%', '%exaustor%'])
AND sp.segmento IN ('Restaurantes', 'Padaria', 'Panificação', 'Confeitaria', 'Bar', 'Lanchonete',
  'Hamburgueria', 'Pizzaria', 'Buffet', 'Cafeteria', 'Cantina', 'Hotelaria');

-- Câmara fria — core para frigoríficos e perecíveis
UPDATE segmento_portfolio sp SET relevancia = 10
FROM portfolio_produtos pp
WHERE sp.produto_id = pp.id
AND pp.nome ILIKE ANY(ARRAY['%câmara%fria%', '%câmara%refriger%'])
AND sp.segmento IN ('Açougue/Frigorífico/Casa de Carnes', 'Peixarias', 'Supermercados', 'Hotelaria');

-- Prateleiras e estantes — core para estoque
UPDATE segmento_portfolio sp SET relevancia = 10
FROM portfolio_produtos pp
WHERE sp.produto_id = pp.id
AND pp.nome ILIKE ANY(ARRAY['%prateleira%', '%estante%'])
AND sp.segmento IN ('Supermercados', 'Empório', 'Hortifruti', 'Minimercado', 'Mercearia');

-- Fixadores — core para construção
UPDATE segmento_portfolio sp SET relevancia = 10
FROM portfolio_produtos pp
WHERE sp.produto_id = pp.id
AND pp.categoria = 'fixadores'
AND sp.segmento IN ('Construtoras', 'Engenharia Civil', 'Arquitetura', 'Incorporadora', 'Imobiliária', 'Revestimentos', 'Pisos');

-- 3. Produtos MUITO RELEVANTES (relevância 8)
-- Balcões — muito relevante para atendimento
UPDATE segmento_portfolio sp SET relevancia = 8
FROM portfolio_produtos pp
WHERE sp.produto_id = pp.id
AND pp.nome ILIKE '%balcão%'
AND sp.relevancia < 8;

-- Pass-through, fogões, fornos
UPDATE segmento_portfolio sp SET relevancia = 8
FROM portfolio_produtos pp
WHERE sp.produto_id = pp.id
AND pp.nome ILIKE ANY(ARRAY['%pass-through%', '%fogão%', '%forno%'])
AND sp.relevancia < 8;

-- Lavatórios — muito relevante para hospitalar
UPDATE segmento_portfolio sp SET relevancia = 10
FROM portfolio_produtos pp
WHERE sp.produto_id = pp.id
AND pp.nome ILIKE '%lavatório%'
AND sp.segmento IN ('Hospitalar', 'Laboratórios', 'Clínica', 'Odontologia', 'Veterinária');

-- Corrimãos e guarda-corpos — core para construção
UPDATE segmento_portfolio sp SET relevancia = 9
FROM portfolio_produtos pp
WHERE sp.produto_id = pp.id
AND pp.nome ILIKE ANY(ARRAY['%corrimão%', '%guarda-corpo%'])
AND sp.segmento IN ('Construtoras', 'Engenharia Civil', 'Condomínio', 'Pousada', 'Resort');

-- 4. Produtos complementares ficam em 6 (já é o default)
-- 5. Cross-sell (baixa relevância) → 4
UPDATE segmento_portfolio sp SET relevancia = 4
FROM portfolio_produtos pp
WHERE sp.produto_id = pp.id
AND pp.nome ILIKE ANY(ARRAY['%acessório%', '%suporte%parede%'])
AND sp.relevancia = 6;
