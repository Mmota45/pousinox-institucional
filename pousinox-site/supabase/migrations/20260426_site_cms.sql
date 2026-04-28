-- =============================================
-- CMS do Site — Tabelas de conteúdo editável
-- =============================================

-- 1. Configurações gerais (key-value)
CREATE TABLE site_config (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL,
  descricao TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Contadores do Hero
CREATE TABLE site_contadores (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  valor INT NOT NULL,
  sufixo TEXT DEFAULT '',
  label TEXT NOT NULL,
  ordem INT DEFAULT 0,
  ativo BOOLEAN DEFAULT true
);

-- 3. Depoimentos
CREATE TABLE site_depoimentos (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome TEXT NOT NULL,
  avatar_cor TEXT DEFAULT '#4285F4',
  texto TEXT NOT NULL,
  nota INT DEFAULT 5,
  ordem INT DEFAULT 0,
  ativo BOOLEAN DEFAULT true
);

-- 4. Clientes (logos)
CREATE TABLE site_clientes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome TEXT NOT NULL,
  logo_url TEXT,
  invertido BOOLEAN DEFAULT false,
  ordem INT DEFAULT 0,
  ativo BOOLEAN DEFAULT true
);

-- 5. Vídeos
CREATE TABLE site_videos (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  titulo TEXT NOT NULL,
  youtube_url TEXT NOT NULL,
  secao TEXT DEFAULT 'fabrica',
  ordem INT DEFAULT 0,
  ativo BOOLEAN DEFAULT true
);

-- 6. FAQ
CREATE TABLE site_faq (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pergunta TEXT NOT NULL,
  resposta TEXT NOT NULL,
  categoria TEXT DEFAULT 'geral',
  ordem INT DEFAULT 0,
  ativo BOOLEAN DEFAULT true
);

-- 7. Banners do Hero
CREATE TABLE site_banners (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  titulo TEXT,
  subtitulo TEXT,
  imagem_url TEXT,
  link TEXT,
  ordem INT DEFAULT 0,
  ativo BOOLEAN DEFAULT true
);

-- 8. Etapas do processo
CREATE TABLE site_etapas (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  numero TEXT NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  ordem INT DEFAULT 0,
  ativo BOOLEAN DEFAULT true
);

-- 9. SEO por página
CREATE TABLE site_seo (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  rota TEXT NOT NULL UNIQUE,
  titulo TEXT,
  descricao TEXT,
  og_image TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE site_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_contadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_depoimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_faq ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_etapas ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_seo ENABLE ROW LEVEL SECURITY;

-- Policies: service_role full + anon read
CREATE POLICY site_config_srv ON site_config FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY site_config_anon ON site_config FOR SELECT USING (true);

CREATE POLICY site_contadores_srv ON site_contadores FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY site_contadores_anon ON site_contadores FOR SELECT USING (true);

CREATE POLICY site_depoimentos_srv ON site_depoimentos FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY site_depoimentos_anon ON site_depoimentos FOR SELECT USING (true);

CREATE POLICY site_clientes_srv ON site_clientes FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY site_clientes_anon ON site_clientes FOR SELECT USING (true);

CREATE POLICY site_videos_srv ON site_videos FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY site_videos_anon ON site_videos FOR SELECT USING (true);

CREATE POLICY site_faq_srv ON site_faq FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY site_faq_anon ON site_faq FOR SELECT USING (true);

CREATE POLICY site_banners_srv ON site_banners FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY site_banners_anon ON site_banners FOR SELECT USING (true);

CREATE POLICY site_etapas_srv ON site_etapas FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY site_etapas_anon ON site_etapas FOR SELECT USING (true);

CREATE POLICY site_seo_srv ON site_seo FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY site_seo_anon ON site_seo FOR SELECT USING (true);

-- =============================================
-- Seed: dados atuais do site
-- =============================================

-- Config
INSERT INTO site_config (chave, valor, descricao) VALUES
  ('whatsapp_numero', '553534238994', 'Número WhatsApp com DDI'),
  ('whatsapp_mensagem', 'Olá, gostaria de solicitar um orçamento.', 'Mensagem padrão WhatsApp'),
  ('google_maps_url', 'https://maps.app.goo.gl/bNAwCL7Jz4n3pJZx8', 'Link Google Maps'),
  ('google_rating', '4,9', 'Nota Google'),
  ('cnpj', '12.115.379/0001-64', 'CNPJ da empresa'),
  ('cidade', 'Pouso Alegre, MG', 'Cidade sede'),
  ('hero_eyebrow', 'POUSINOX® — Pouso Alegre, MG', 'Texto acima do título hero'),
  ('hero_titulo', 'Fabricante de inox sob medida', 'Título principal do hero'),
  ('hero_tagline', 'para indústria, construção e projetos profissionais', 'Tagline do hero'),
  ('hero_subtitulo', '25 anos fabricando bancadas, equipamentos hospitalares, corrimãos e soluções especializadas em aço inox. Atendemos todo o Brasil direto da fábrica.', 'Subtítulo do hero'),
  ('fabrica_titulo', 'Fabricação própria do início ao fim', 'Título seção fábrica'),
  ('fabrica_texto', 'Tecnologia de corte a laser, dobradeira CNC e solda especializada — tudo feito internamente em Pouso Alegre, MG. Controle total sobre qualidade, prazo e acabamento de cada peça.', 'Texto seção fábrica'),
  ('fabrica_video_url', 'https://www.youtube.com/embed/MMMGnD7oXZM', 'URL embed vídeo fábrica'),
  ('cta_titulo', 'Pronto para começar seu projeto?', 'Título CTA final'),
  ('cta_subtitulo', 'Fale com nossos especialistas e receba um orçamento sem compromisso direto da fábrica.', 'Subtítulo CTA final'),
  ('n8n_webhook_contato', 'https://n8n.pousinox.com.br/webhook/contato-lead', 'Webhook N8N para contato');

-- Contadores
INSERT INTO site_contadores (valor, sufixo, label, ordem) VALUES
  (25, '+', 'Anos de mercado', 1),
  (11, '+', 'Segmentos atendidos', 2),
  (100, '%', 'Fabricação própria', 3);

-- Depoimentos
INSERT INTO site_depoimentos (nome, avatar_cor, texto, ordem) VALUES
  ('Mariana Monteiro', '#4285F4', 'Adorei a loja e o atendimento. Eles têm tudo que você possa imaginar em inox e se tem algo que você precise e eles não tenham disponível, eles fazem! Muito bom.', 1),
  ('Vanderlei Braga', '#34A853', 'Pessoal muito atencioso e dedicado. Produtos com excelente acabamento, dentre estes, destaco a churrasqueira inox a bafo — linda, altura ergonômica e o melhor de tudo: pequena, cabe em qualquer espaço.', 2),
  ('Thamires Gonçalves', '#EA4335', 'Material com acabamento perfeito e atendimento impecável. Para quem busca uma coifa ideal para sua cozinha, eu super indico!', 3),
  ('Elitton Wagner', '#F9A825', 'Atendimento muito bom, trabalho com dedicação e zelo. Melhor prazo de entrega da cidade.', 4),
  ('Maria Vitória Pereira', '#9C27B0', 'Eles tratam o cliente super bem, produtos de boa qualidade, essa empresa é super profissional. Agora eu só compro lá — peço os corrimões de lá.', 5),
  ('Denise V.', '#00ACC1', 'Excelente atendimento. Muito atenciosos. Produtos de alta qualidade. Parabéns.', 6);

-- Etapas do processo
INSERT INTO site_etapas (numero, titulo, descricao, ordem) VALUES
  ('01', 'Consulta', 'Entendemos sua necessidade, espaço disponível e objetivo do projeto.', 1),
  ('02', 'Projeto', 'Desenvolvemos o desenho técnico com todas as especificações e medidas.', 2),
  ('03', 'Fabricação', 'Produzimos na nossa fábrica com aço inox de alta qualidade e precisão.', 3),
  ('04', 'Entrega', 'Entregamos no prazo combinado. Instalação e assistência técnica quando aplicável.', 4);

-- Vídeos
INSERT INTO site_videos (titulo, youtube_url, secao, ordem) VALUES
  ('Corte a Laser em Chapas Metálicas — Pousinox', 'https://www.youtube.com/embed/MMMGnD7oXZM', 'fabrica', 1);

-- FAQ
INSERT INTO site_faq (pergunta, resposta, categoria, ordem) VALUES
  ('Vocês fabricam peças sob medida?', 'Sim! Toda nossa produção é sob medida. Desenvolvemos o projeto técnico conforme a necessidade do cliente e fabricamos internamente em nossa fábrica em Pouso Alegre, MG.', 'geral', 1),
  ('Qual o prazo de entrega?', 'O prazo varia conforme a complexidade do projeto. Peças simples ficam prontas em 5-10 dias úteis. Projetos maiores podem levar de 15 a 30 dias. Informamos o prazo exato no orçamento.', 'geral', 2),
  ('Vocês entregam para todo o Brasil?', 'Sim, entregamos para todo o Brasil. Para a região Sul de Minas e cidades próximas, fazemos entrega própria. Para outras regiões, enviamos por transportadora.', 'entrega', 3),
  ('Qual tipo de aço inox vocês utilizam?', 'Trabalhamos principalmente com aço inox AISI 304 (mais comum, excelente resistência à corrosão) e AISI 430. Para ambientes mais agressivos, utilizamos AISI 316. O tipo ideal é definido no projeto.', 'material', 4),
  ('Como solicitar um orçamento?', 'Você pode solicitar pelo WhatsApp, pelo formulário de contato do site, ou visitando nossa fábrica em Pouso Alegre. Basta descrever o que precisa — medidas, tipo de peça e quantidade.', 'geral', 5),
  ('Vocês fazem corte a laser avulso?', 'Sim! Oferecemos serviço de corte a laser em chapas de aço inox, aço carbono e alumínio. Aceitamos arquivos DXF/DWG ou fazemos o desenho conforme sua necessidade.', 'servicos', 6);

-- SEO por página
INSERT INTO site_seo (rota, titulo, descricao) VALUES
  ('/', 'POUSINOX® — Fabricante de Equipamentos em Inox em Pouso Alegre, MG', 'Fábrica de equipamentos e mobiliário em aço inox sob medida em Pouso Alegre, MG. Bancadas, pias, carrinhos hospitalares, corrimãos e corte a laser para todo o Sul de Minas Gerais. 25 anos de experiência.'),
  ('/produtos', 'Produtos em Aço Inox Sob Medida — POUSINOX®', 'Catálogo completo de equipamentos e mobiliário em aço inox para restaurantes, hospitais, laboratórios, construção civil e arquitetura.'),
  ('/sobre', 'Sobre a POUSINOX® — 25 Anos de Fabricação em Inox', 'Conheça a história, valores e estrutura da POUSINOX® — fabricante de equipamentos em aço inox desde 2001 em Pouso Alegre, MG.'),
  ('/contato', 'Contato e Orçamento — POUSINOX®', 'Solicite um orçamento sem compromisso. Fale com nossos especialistas por WhatsApp, telefone ou formulário.'),
  ('/servicos/corte-laser', 'Corte a Laser em Chapas Metálicas — POUSINOX®', 'Serviço de corte a laser em aço inox, aço carbono e alumínio. Precisão milimétrica, bordas limpas, qualquer geometria. Pouso Alegre, MG.'),
  ('/pronta-entrega', 'Pronta Entrega — Produtos em Inox — POUSINOX®', 'Produtos em aço inox com pronta entrega. Bancadas, pias, mesas e equipamentos disponíveis para envio imediato.');
