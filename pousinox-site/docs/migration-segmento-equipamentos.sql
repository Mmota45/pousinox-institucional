-- Migration: segmento_equipamentos
-- Equipamentos em inox necessários por segmento (obrigatórios por norma ou recomendados)

CREATE TABLE IF NOT EXISTS segmento_equipamentos (
  id SERIAL PRIMARY KEY,
  segmento TEXT NOT NULL,
  equipamento TEXT NOT NULL,
  obrigatorio BOOLEAN DEFAULT false,
  norma_ref TEXT,
  material TEXT DEFAULT '304',
  observacao TEXT,
  UNIQUE(segmento, equipamento)
);

ALTER TABLE segmento_equipamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON segmento_equipamentos USING (auth.role() = 'service_role');

-- ══════════════════════════════════════════════════════════════════
-- SEED DATA — Equipamentos por segmento
-- ══════════════════════════════════════════════════════════════════

-- Restaurantes
INSERT INTO segmento_equipamentos (segmento, equipamento, obrigatorio, norma_ref, material) VALUES
('Restaurantes', 'Bancadas sob medida', true, 'RDC ANVISA 216/2004', '304'),
('Restaurantes', 'Pias industriais', true, 'RDC ANVISA 216/2004', '304'),
('Restaurantes', 'Mesas de preparo', true, 'RDC ANVISA 216/2004', '304'),
('Restaurantes', 'Coifas e exaustores', true, 'RDC ANVISA 216/2004', '304'),
('Restaurantes', 'Prateleiras', true, 'RDC ANVISA 216/2004', '304'),
('Restaurantes', 'Cubas e drenos', true, 'RDC ANVISA 216/2004', '304'),
('Restaurantes', 'Fogões industriais', false, NULL, '304'),
('Restaurantes', 'Pass-through', false, NULL, '304'),
('Restaurantes', 'Estufas', false, NULL, '304')
ON CONFLICT (segmento, equipamento) DO NOTHING;

-- Açougues
INSERT INTO segmento_equipamentos (segmento, equipamento, obrigatorio, norma_ref, material) VALUES
('Açougues', 'Bancadas de corte', true, 'RDC ANVISA 216/2004', '304'),
('Açougues', 'Balcões de atendimento', true, 'RDC ANVISA 216/2004', '304'),
('Açougues', 'Ganchos para carne', true, 'RDC ANVISA 216/2004', '304'),
('Açougues', 'Prateleiras para câmara fria', true, 'RDC ANVISA 216/2004', '304'),
('Açougues', 'Pias industriais', true, 'RDC ANVISA 216/2004', '304'),
('Açougues', 'Mesas de desossa', true, 'RDC ANVISA 216/2004', '304'),
('Açougues', 'Esterilizadores de facas', false, NULL, '304')
ON CONFLICT (segmento, equipamento) DO NOTHING;

-- Padaria / Panificação
INSERT INTO segmento_equipamentos (segmento, equipamento, obrigatorio, norma_ref, material) VALUES
('Padaria', 'Bancadas de produção', true, 'RDC ANVISA 216/2004', '304'),
('Padaria', 'Mesas de confeitaria', true, 'RDC ANVISA 216/2004', '304'),
('Padaria', 'Pias industriais', true, 'RDC ANVISA 216/2004', '304'),
('Padaria', 'Prateleiras', true, 'RDC ANVISA 216/2004', '304'),
('Padaria', 'Coifas', true, 'RDC ANVISA 216/2004', '304'),
('Padaria', 'Carrinhos rack', false, NULL, '304'),
('Padaria', 'Formas industriais', false, NULL, '304')
ON CONFLICT (segmento, equipamento) DO NOTHING;

-- Panificação (variante)
INSERT INTO segmento_equipamentos (segmento, equipamento, obrigatorio, norma_ref, material) VALUES
('Panificação', 'Bancadas de produção', true, 'RDC ANVISA 216/2004', '304'),
('Panificação', 'Mesas de confeitaria', true, 'RDC ANVISA 216/2004', '304'),
('Panificação', 'Pias industriais', true, 'RDC ANVISA 216/2004', '304'),
('Panificação', 'Prateleiras', true, 'RDC ANVISA 216/2004', '304'),
('Panificação', 'Coifas', true, 'RDC ANVISA 216/2004', '304'),
('Panificação', 'Carrinhos rack', false, NULL, '304')
ON CONFLICT (segmento, equipamento) DO NOTHING;

-- Hospitalar
INSERT INTO segmento_equipamentos (segmento, equipamento, obrigatorio, norma_ref, material) VALUES
('Hospitalar', 'Bancadas de CME', true, 'RDC ANVISA 50/2002', '316L'),
('Hospitalar', 'Lavatórios cirúrgicos', true, 'RDC ANVISA 50/2002', '316L'),
('Hospitalar', 'Mesas de instrumentação', true, 'RDC ANVISA 50/2002', '304'),
('Hospitalar', 'Carrinhos de medicação', true, 'RDC ANVISA 50/2002', '304'),
('Hospitalar', 'Suportes de soro', true, 'RDC ANVISA 50/2002', '304'),
('Hospitalar', 'Bancadas de laboratório', true, 'RDC ANVISA 50/2002', '304'),
('Hospitalar', 'Lava-comadres', true, 'RDC ANVISA 50/2002', '304'),
('Hospitalar', 'Coifas de exaustão', false, NULL, '304')
ON CONFLICT (segmento, equipamento) DO NOTHING;

-- Hotelaria
INSERT INTO segmento_equipamentos (segmento, equipamento, obrigatorio, norma_ref, material) VALUES
('Hotelaria', 'Bancadas de cozinha', true, 'RDC ANVISA 216/2004', '304'),
('Hotelaria', 'Pias industriais', true, 'RDC ANVISA 216/2004', '304'),
('Hotelaria', 'Coifas e exaustores', true, 'RDC ANVISA 216/2004', '304'),
('Hotelaria', 'Fogões industriais', false, NULL, '304'),
('Hotelaria', 'Pass-through', false, NULL, '304'),
('Hotelaria', 'Câmara fria (prateleiras)', true, 'RDC ANVISA 216/2004', '304'),
('Hotelaria', 'Carrinhos térmicos', false, NULL, '304'),
('Hotelaria', 'Cubas gastronorm', false, NULL, '304')
ON CONFLICT (segmento, equipamento) DO NOTHING;

-- Supermercados
INSERT INTO segmento_equipamentos (segmento, equipamento, obrigatorio, norma_ref, material) VALUES
('Supermercados', 'Balcões de açougue', true, 'RDC ANVISA 216/2004', '304'),
('Supermercados', 'Bancadas de padaria', true, 'RDC ANVISA 216/2004', '304'),
('Supermercados', 'Pias industriais', true, 'RDC ANVISA 216/2004', '304'),
('Supermercados', 'Balcões de rotisseria', true, 'RDC ANVISA 216/2004', '304'),
('Supermercados', 'Prateleiras para câmara fria', true, 'RDC ANVISA 216/2004', '304'),
('Supermercados', 'Coifas', false, NULL, '304')
ON CONFLICT (segmento, equipamento) DO NOTHING;

-- Laboratórios
INSERT INTO segmento_equipamentos (segmento, equipamento, obrigatorio, norma_ref, material) VALUES
('Laboratórios', 'Bancadas de trabalho', true, 'ABNT NBR 17025', '304'),
('Laboratórios', 'Capelas de fluxo laminar', true, 'ABNT NBR 17025', '304'),
('Laboratórios', 'Pias com cuba', true, 'ABNT NBR 17025', '304'),
('Laboratórios', 'Armários', true, 'ABNT NBR 17025', '304'),
('Laboratórios', 'Prateleiras', true, 'ABNT NBR 17025', '304'),
('Laboratórios', 'Suportes de equipamento', false, NULL, '304')
ON CONFLICT (segmento, equipamento) DO NOTHING;

-- Peixarias
INSERT INTO segmento_equipamentos (segmento, equipamento, obrigatorio, norma_ref, material) VALUES
('Peixarias', 'Bancadas com dreno', true, 'RDC ANVISA 216/2004', '316L'),
('Peixarias', 'Cubas de gelo', true, 'RDC ANVISA 216/2004', '316L'),
('Peixarias', 'Balcões de atendimento', true, 'RDC ANVISA 216/2004', '316L'),
('Peixarias', 'Pias industriais', true, 'RDC ANVISA 216/2004', '316L'),
('Peixarias', 'Prateleiras para câmara fria', true, 'RDC ANVISA 216/2004', '316L')
ON CONFLICT (segmento, equipamento) DO NOTHING;

-- Construtoras
INSERT INTO segmento_equipamentos (segmento, equipamento, obrigatorio, norma_ref, material) VALUES
('Construtoras', 'Corrimãos', false, 'ABNT NBR 14718', '304'),
('Construtoras', 'Guarda-corpos', false, 'ABNT NBR 14718', '304'),
('Construtoras', 'Fixadores de porcelanato', false, 'ABNT NBR 16259', '304'),
('Construtoras', 'Grades e cercas', false, NULL, '304'),
('Construtoras', 'Portões', false, NULL, '304'),
('Construtoras', 'Calhas e rufos', false, NULL, '304')
ON CONFLICT (segmento, equipamento) DO NOTHING;

-- Engenharia Civil
INSERT INTO segmento_equipamentos (segmento, equipamento, obrigatorio, norma_ref, material) VALUES
('Engenharia Civil', 'Corrimãos', false, 'ABNT NBR 14718', '304'),
('Engenharia Civil', 'Guarda-corpos', false, 'ABNT NBR 14718', '304'),
('Engenharia Civil', 'Fixadores de porcelanato', false, 'ABNT NBR 16259', '304'),
('Engenharia Civil', 'Estruturas metálicas', false, NULL, '304')
ON CONFLICT (segmento, equipamento) DO NOTHING;

-- Clínica
INSERT INTO segmento_equipamentos (segmento, equipamento, obrigatorio, norma_ref, material) VALUES
('Clínica', 'Bancadas de procedimento', true, 'RDC ANVISA 50/2002', '304'),
('Clínica', 'Lavatórios', true, 'RDC ANVISA 50/2002', '304'),
('Clínica', 'Mesas auxiliares', true, 'RDC ANVISA 50/2002', '304'),
('Clínica', 'Carrinhos de materiais', false, NULL, '304')
ON CONFLICT (segmento, equipamento) DO NOTHING;

-- Veterinária
INSERT INTO segmento_equipamentos (segmento, equipamento, obrigatorio, norma_ref, material) VALUES
('Veterinária', 'Mesas cirúrgicas', true, 'CFMV 1275/2019', '304'),
('Veterinária', 'Bancadas de atendimento', true, 'CFMV 1275/2019', '304'),
('Veterinária', 'Banheiras de banho/tosa', true, 'CFMV 1275/2019', '304'),
('Veterinária', 'Pias cirúrgicas', true, 'CFMV 1275/2019', '304'),
('Veterinária', 'Gaiolas (estrutura)', false, NULL, '304')
ON CONFLICT (segmento, equipamento) DO NOTHING;

-- Confeitaria
INSERT INTO segmento_equipamentos (segmento, equipamento, obrigatorio, norma_ref, material) VALUES
('Confeitaria', 'Bancadas de trabalho', true, 'RDC ANVISA 216/2004', '304'),
('Confeitaria', 'Mesas de acabamento', true, 'RDC ANVISA 216/2004', '304'),
('Confeitaria', 'Pias industriais', true, 'RDC ANVISA 216/2004', '304'),
('Confeitaria', 'Prateleiras', true, 'RDC ANVISA 216/2004', '304'),
('Confeitaria', 'Carrinhos rack', false, NULL, '304')
ON CONFLICT (segmento, equipamento) DO NOTHING;

-- Bar
INSERT INTO segmento_equipamentos (segmento, equipamento, obrigatorio, norma_ref, material) VALUES
('Bar', 'Bancadas de bar', true, 'RDC ANVISA 216/2004', '304'),
('Bar', 'Pias', true, 'RDC ANVISA 216/2004', '304'),
('Bar', 'Cubas de gelo', true, 'RDC ANVISA 216/2004', '304'),
('Bar', 'Prateleiras', false, NULL, '304')
ON CONFLICT (segmento, equipamento) DO NOTHING;

-- Lanchonete
INSERT INTO segmento_equipamentos (segmento, equipamento, obrigatorio, norma_ref, material) VALUES
('Lanchonete', 'Bancadas', true, 'RDC ANVISA 216/2004', '304'),
('Lanchonete', 'Pias', true, 'RDC ANVISA 216/2004', '304'),
('Lanchonete', 'Coifas', true, 'RDC ANVISA 216/2004', '304'),
('Lanchonete', 'Prateleiras', false, NULL, '304')
ON CONFLICT (segmento, equipamento) DO NOTHING;

-- Hamburgueria
INSERT INTO segmento_equipamentos (segmento, equipamento, obrigatorio, norma_ref, material) VALUES
('Hamburgueria', 'Bancadas de preparo', true, 'RDC ANVISA 216/2004', '304'),
('Hamburgueria', 'Pias industriais', true, 'RDC ANVISA 216/2004', '304'),
('Hamburgueria', 'Coifas', true, 'RDC ANVISA 216/2004', '304'),
('Hamburgueria', 'Prateleiras', true, 'RDC ANVISA 216/2004', '304'),
('Hamburgueria', 'Cubas e drenos', false, NULL, '304')
ON CONFLICT (segmento, equipamento) DO NOTHING;

-- Pizzaria
INSERT INTO segmento_equipamentos (segmento, equipamento, obrigatorio, norma_ref, material) VALUES
('Pizzaria', 'Bancadas de preparo', true, 'RDC ANVISA 216/2004', '304'),
('Pizzaria', 'Pias industriais', true, 'RDC ANVISA 216/2004', '304'),
('Pizzaria', 'Coifas', true, 'RDC ANVISA 216/2004', '304'),
('Pizzaria', 'Mesas de montagem', true, 'RDC ANVISA 216/2004', '304'),
('Pizzaria', 'Prateleiras', false, NULL, '304')
ON CONFLICT (segmento, equipamento) DO NOTHING;

-- Sorveteria
INSERT INTO segmento_equipamentos (segmento, equipamento, obrigatorio, norma_ref, material) VALUES
('Sorveteria', 'Bancadas de preparo', true, 'RDC ANVISA 216/2004', '304'),
('Sorveteria', 'Pias', true, 'RDC ANVISA 216/2004', '304'),
('Sorveteria', 'Cubas de armazenamento', true, 'RDC ANVISA 216/2004', '304'),
('Sorveteria', 'Prateleiras', false, NULL, '304')
ON CONFLICT (segmento, equipamento) DO NOTHING;

-- Buffet
INSERT INTO segmento_equipamentos (segmento, equipamento, obrigatorio, norma_ref, material) VALUES
('Buffet', 'Bancadas de produção', true, 'RDC ANVISA 216/2004', '304'),
('Buffet', 'Pias industriais', true, 'RDC ANVISA 216/2004', '304'),
('Buffet', 'Coifas', true, 'RDC ANVISA 216/2004', '304'),
('Buffet', 'Réchauds e banho-maria', false, NULL, '304'),
('Buffet', 'Carrinhos térmicos', false, NULL, '304'),
('Buffet', 'Pass-through', false, NULL, '304')
ON CONFLICT (segmento, equipamento) DO NOTHING;

-- Cafeteria
INSERT INTO segmento_equipamentos (segmento, equipamento, obrigatorio, norma_ref, material) VALUES
('Cafeteria', 'Bancadas', true, 'RDC ANVISA 216/2004', '304'),
('Cafeteria', 'Pias', true, 'RDC ANVISA 216/2004', '304'),
('Cafeteria', 'Prateleiras', false, NULL, '304')
ON CONFLICT (segmento, equipamento) DO NOTHING;

-- Cantina
INSERT INTO segmento_equipamentos (segmento, equipamento, obrigatorio, norma_ref, material) VALUES
('Cantina', 'Bancadas de preparo', true, 'RDC ANVISA 216/2004', '304'),
('Cantina', 'Pias industriais', true, 'RDC ANVISA 216/2004', '304'),
('Cantina', 'Coifas', true, 'RDC ANVISA 216/2004', '304'),
('Cantina', 'Prateleiras', false, NULL, '304')
ON CONFLICT (segmento, equipamento) DO NOTHING;

-- Odontologia
INSERT INTO segmento_equipamentos (segmento, equipamento, obrigatorio, norma_ref, material) VALUES
('Odontologia', 'Bancadas de procedimento', true, 'RDC ANVISA 50/2002', '304'),
('Odontologia', 'Lavatórios', true, 'RDC ANVISA 50/2002', '304'),
('Odontologia', 'Armários', true, 'RDC ANVISA 50/2002', '304'),
('Odontologia', 'Suportes de autoclave', false, NULL, '304')
ON CONFLICT (segmento, equipamento) DO NOTHING;

-- Pousada
INSERT INTO segmento_equipamentos (segmento, equipamento, obrigatorio, norma_ref, material) VALUES
('Pousada', 'Bancadas de cozinha', true, 'RDC ANVISA 216/2004', '304'),
('Pousada', 'Pias industriais', true, 'RDC ANVISA 216/2004', '304'),
('Pousada', 'Coifas', true, 'RDC ANVISA 216/2004', '304'),
('Pousada', 'Prateleiras', false, NULL, '304')
ON CONFLICT (segmento, equipamento) DO NOTHING;

-- Resort
INSERT INTO segmento_equipamentos (segmento, equipamento, obrigatorio, norma_ref, material) VALUES
('Resort', 'Cozinha industrial completa', true, 'RDC ANVISA 216/2004', '304'),
('Resort', 'Bancadas sob medida', true, 'RDC ANVISA 216/2004', '304'),
('Resort', 'Pias industriais', true, 'RDC ANVISA 216/2004', '304'),
('Resort', 'Coifas e exaustores', true, 'RDC ANVISA 216/2004', '304'),
('Resort', 'Escadas de piscina', false, NULL, '316L'),
('Resort', 'Corrimãos', false, 'ABNT NBR 14718', '304')
ON CONFLICT (segmento, equipamento) DO NOTHING;

-- Casa de Carnes
INSERT INTO segmento_equipamentos (segmento, equipamento, obrigatorio, norma_ref, material) VALUES
('Casa de Carnes', 'Bancadas de corte', true, 'RDC ANVISA 216/2004', '304'),
('Casa de Carnes', 'Balcões de atendimento', true, 'RDC ANVISA 216/2004', '304'),
('Casa de Carnes', 'Ganchos', true, 'RDC ANVISA 216/2004', '304'),
('Casa de Carnes', 'Prateleiras câmara fria', true, 'RDC ANVISA 216/2004', '304'),
('Casa de Carnes', 'Pias', true, 'RDC ANVISA 216/2004', '304')
ON CONFLICT (segmento, equipamento) DO NOTHING;

-- Condomínio
INSERT INTO segmento_equipamentos (segmento, equipamento, obrigatorio, norma_ref, material) VALUES
('Condomínio', 'Corrimãos', false, 'ABNT NBR 14718', '304'),
('Condomínio', 'Guarda-corpos', false, 'ABNT NBR 14718', '304'),
('Condomínio', 'Portões', false, NULL, '304'),
('Condomínio', 'Grades', false, NULL, '304'),
('Condomínio', 'Lixeiras coletivas', false, NULL, '304')
ON CONFLICT (segmento, equipamento) DO NOTHING;

-- Empório
INSERT INTO segmento_equipamentos (segmento, equipamento, obrigatorio, norma_ref, material) VALUES
('Empório', 'Balcões de atendimento', true, 'RDC ANVISA 216/2004', '304'),
('Empório', 'Bancadas de frios', true, 'RDC ANVISA 216/2004', '304'),
('Empório', 'Pias', true, 'RDC ANVISA 216/2004', '304'),
('Empório', 'Prateleiras', false, NULL, '304')
ON CONFLICT (segmento, equipamento) DO NOTHING;

-- Hortifruti
INSERT INTO segmento_equipamentos (segmento, equipamento, obrigatorio, norma_ref, material) VALUES
('Hortifruti', 'Bancadas de higienização', true, 'RDC ANVISA 216/2004', '304'),
('Hortifruti', 'Pias', true, 'RDC ANVISA 216/2004', '304'),
('Hortifruti', 'Prateleiras', false, NULL, '304'),
('Hortifruti', 'Balcões', false, NULL, '304')
ON CONFLICT (segmento, equipamento) DO NOTHING;

-- Minimercado
INSERT INTO segmento_equipamentos (segmento, equipamento, obrigatorio, norma_ref, material) VALUES
('Minimercado', 'Balcões de frios/açougue', true, 'RDC ANVISA 216/2004', '304'),
('Minimercado', 'Pias', true, 'RDC ANVISA 216/2004', '304'),
('Minimercado', 'Bancadas', true, 'RDC ANVISA 216/2004', '304'),
('Minimercado', 'Prateleiras', false, NULL, '304')
ON CONFLICT (segmento, equipamento) DO NOTHING;

-- Mercearia
INSERT INTO segmento_equipamentos (segmento, equipamento, obrigatorio, norma_ref, material) VALUES
('Mercearia', 'Balcões', true, 'RDC ANVISA 216/2004', '304'),
('Mercearia', 'Pias', true, 'RDC ANVISA 216/2004', '304'),
('Mercearia', 'Prateleiras', false, NULL, '304')
ON CONFLICT (segmento, equipamento) DO NOTHING;

-- Arquitetura
INSERT INTO segmento_equipamentos (segmento, equipamento, obrigatorio, norma_ref, material) VALUES
('Arquitetura', 'Painéis decorativos', false, NULL, '304'),
('Arquitetura', 'Revestimentos em inox', false, NULL, '304'),
('Arquitetura', 'Corrimãos', false, 'ABNT NBR 14718', '304'),
('Arquitetura', 'Guarda-corpos', false, 'ABNT NBR 14718', '304'),
('Arquitetura', 'Mobiliário sob medida', false, NULL, '304')
ON CONFLICT (segmento, equipamento) DO NOTHING;

-- Incorporadora / Imobiliária
INSERT INTO segmento_equipamentos (segmento, equipamento, obrigatorio, norma_ref, material) VALUES
('Incorporadora', 'Corrimãos', false, 'ABNT NBR 14718', '304'),
('Incorporadora', 'Guarda-corpos', false, 'ABNT NBR 14718', '304'),
('Incorporadora', 'Fixadores de porcelanato', false, 'ABNT NBR 16259', '304'),
('Incorporadora', 'Portões de garagem', false, NULL, '304')
ON CONFLICT (segmento, equipamento) DO NOTHING;

INSERT INTO segmento_equipamentos (segmento, equipamento, obrigatorio, norma_ref, material) VALUES
('Imobiliária', 'Corrimãos', false, 'ABNT NBR 14718', '304'),
('Imobiliária', 'Guarda-corpos', false, 'ABNT NBR 14718', '304'),
('Imobiliária', 'Fixadores de porcelanato', false, 'ABNT NBR 16259', '304')
ON CONFLICT (segmento, equipamento) DO NOTHING;

-- Revestimentos / Pisos
INSERT INTO segmento_equipamentos (segmento, equipamento, obrigatorio, norma_ref, material) VALUES
('Revestimentos', 'Fixadores de porcelanato', false, 'ABNT NBR 16259', '304'),
('Revestimentos', 'Perfis de acabamento', false, NULL, '304')
ON CONFLICT (segmento, equipamento) DO NOTHING;

INSERT INTO segmento_equipamentos (segmento, equipamento, obrigatorio, norma_ref, material) VALUES
('Pisos', 'Fixadores de porcelanato', false, 'ABNT NBR 16259', '304'),
('Pisos', 'Perfis de acabamento', false, NULL, '304')
ON CONFLICT (segmento, equipamento) DO NOTHING;
