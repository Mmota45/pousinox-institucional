-- Normas regulatórias para segmento Indústria Alimentícia
-- Rodar no SQL Editor do Supabase

INSERT INTO portfolio_normas (norma, orgao, titulo, status, segmentos, penalidade, observacao) VALUES

-- MAPA / SIF
('Portaria MAPA 368/1997',
 'MAPA',
 'Regulamento Técnico sobre Boas Práticas de Fabricação para Estabelecimentos Produtores de Alimentos',
 'vigente',
 ARRAY['Indústria Alimentícia', 'Frigorífico', 'Laticínio', 'Cervejaria'],
 'Interdição do estabelecimento pelo SIF — suspensão imediata do registro e proibição de comercialização',
 'Exige superfícies de contato com alimentos em material liso, impermeável, lavável e resistente — aço inox é o padrão aceito. Art. 5.2.'),

('Decreto 9.013/2017 (RIISPOA)',
 'MAPA',
 'Regulamento de Inspeção Industrial e Sanitária de Produtos de Origem Animal',
 'vigente',
 ARRAY['Indústria Alimentícia', 'Frigorífico', 'Laticínio'],
 'Cancelamento do registro SIF — impossibilita comercialização interestadual e exportação',
 'Art. 33: equipamentos e utensílios devem ser de material resistente à corrosão, atóxico, de fácil higienização. Inox é o único metal que atende todos os requisitos simultaneamente.'),

('IN MAPA 05/2017',
 'MAPA',
 'Requisitos para registro de estabelecimentos junto ao SIF',
 'vigente',
 ARRAY['Indústria Alimentícia', 'Frigorífico'],
 'Indeferimento do pedido de registro — estabelecimento não pode operar',
 'Define requisitos de instalações e equipamentos para aprovação do SIF. Bancadas, mesas, tanques e tubulações devem ser em aço inoxidável.'),

-- ANVISA
('RDC ANVISA 275/2002',
 'ANVISA',
 'Regulamento Técnico de Procedimentos Operacionais Padronizados e Lista de Verificação de Boas Práticas',
 'vigente',
 ARRAY['Indústria Alimentícia', 'Frigorífico', 'Laticínio', 'Cervejaria', 'Restaurantes'],
 'Advertência, multa de R$ 2.000 a R$ 1.500.000 ou interdição (Lei 6.437/77)',
 'Checklist de BPF inclui verificação de superfícies de contato: devem ser lisas, impermeáveis, laváveis e em bom estado de conservação. Inox é o material de referência.'),

('RDC ANVISA 216/2004',
 'ANVISA',
 'Regulamento Técnico de Boas Práticas para Serviços de Alimentação',
 'vigente',
 ARRAY['Restaurantes', 'Indústria Alimentícia', 'Cervejaria', 'Padaria'],
 'Multa de R$ 2.000 a R$ 1.500.000, interdição parcial ou total',
 'Aplicável a cozinhas industriais e serviços de alimentação. Equipamentos devem ter superfícies lisas, impermeáveis, laváveis e de materiais que não transmitam substâncias tóxicas.'),

-- ABNT
('ABNT NBR 14900:2002',
 'ABNT',
 'Sistema de gestão da análise de perigos e pontos críticos de controle (APPCC) — Segurança de alimentos',
 'vigente',
 ARRAY['Indústria Alimentícia', 'Frigorífico', 'Laticínio'],
 'Perda de certificação — impacta exportação e contratos com grandes redes',
 'O APPCC exige identificação de perigos em cada etapa. Superfícies de contato em material inadequado são classificadas como perigo físico/químico. Inox elimina esse ponto crítico.'),

-- Internacional (exportação)
('Codex Alimentarius CAC/RCP 1-1969',
 'FAO/OMS',
 'Código de Práticas Internacionais Recomendadas — Princípios Gerais de Higiene dos Alimentos',
 'vigente',
 ARRAY['Indústria Alimentícia', 'Frigorífico', 'Laticínio'],
 'Barreiras à exportação — rejeição de lotes por importadores',
 'Base para todas as legislações nacionais. Seção 4.2: superfícies de contato devem ser de material não tóxico, resistente à corrosão e que não constitua risco. Referência internacional para auditoria de clientes estrangeiros.'),

-- MAPA específica laticínios
('IN MAPA 76/2018',
 'MAPA',
 'Regulamento Técnico de Identidade e Qualidade de Leite Cru Refrigerado',
 'vigente',
 ARRAY['Laticínio', 'Indústria Alimentícia'],
 'Suspensão da captação de leite — paralisação da produção',
 'Tanques de resfriamento e tubulações de transporte devem ser em aço inox. Contato do leite com outros metais causa contaminação e altera a composição.'),

('IN MAPA 77/2018',
 'MAPA',
 'Regulamento Técnico de Identidade e Qualidade de Leite Pasteurizado',
 'vigente',
 ARRAY['Laticínio', 'Indústria Alimentícia'],
 'Recolhimento de lotes + suspensão do SIF',
 'Pasteurizadores, tanques e envasadoras devem ser em aço inox 304 ou 316. Exigência explícita do MAPA para registro do produto.');
