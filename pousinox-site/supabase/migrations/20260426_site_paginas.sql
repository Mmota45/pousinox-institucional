-- Conteúdo editável: Produtos, Sobre, Contato, Corte a Laser

-- ── Produtos ──
INSERT INTO site_config (chave, valor, descricao) VALUES
  ('produtos_titulo', 'Nossos Produtos', 'Título da página Produtos'),
  ('produtos_subtitulo', 'Fabricamos equipamentos e mobiliário em aço inox sob medida para oito segmentos. Selecione uma categoria para conhecer os itens disponíveis.', 'Subtítulo da página Produtos'),
  ('produtos_cta_nota', 'Todos os itens podem ser fabricados sob medida. Não encontrou o que precisa? Entre em contato — desenvolvemos projetos personalizados.', 'Nota CTA produtos');

-- ── Sobre ──
INSERT INTO site_config (chave, valor, descricao) VALUES
  ('sobre_titulo', 'Quem Somos', 'Título da página Sobre'),
  ('sobre_subtitulo', '"Soluções em inox que elevam ambientes."', 'Subtítulo/lema da página Sobre'),
  ('sobre_quem_titulo', 'Há mais de duas décadas elevando padrões', 'Título seção Quem Somos'),
  ('sobre_quem_p1', 'A POUSINOX® desenvolve soluções em aço inox que elevam o padrão de ambientes industriais, comerciais e residenciais em todo o Brasil. Mais do que fabricar equipamentos, projetamos soluções sob medida que combinam eficiência operacional, higiene, durabilidade e acabamento superior — atendendo necessidades reais de cada cliente e de cada projeto.', 'Parágrafo 1 Quem Somos'),
  ('sobre_quem_p2', 'Com estrutura fabril própria, tecnologia CNC e uma equipe técnica especializada, atuamos em todas as etapas: do projeto à instalação, garantindo performance e confiabilidade em cada entrega.', 'Parágrafo 2 Quem Somos'),
  ('sobre_quem_destaque', 'Nosso compromisso é transformar o inox em um elemento estratégico para o funcionamento, a produtividade e a longevidade dos ambientes.', 'Texto destaque Quem Somos'),
  ('sobre_historia_p1', 'A história da POUSINOX® começou com a visão de um jovem empreendedor apaixonado pela área metalúrgica, formado em cursos técnicos do Senai e movido pelo desejo de elevar a qualidade dos projetos em inox no mercado brasileiro.', 'Parágrafo 1 história'),
  ('sobre_historia_p2', 'Após anos de experiência prática atendendo clientes e compreendendo suas necessidades reais, nasceu em 2001 a POUSINOX® — inicialmente em uma garagem, com poucos recursos, mas com um propósito claro: entregar excelência através do trabalho bem feito.', 'Parágrafo 2 história'),
  ('sobre_historia_p3', 'Com dedicação, evolução constante e foco no cliente, a empresa cresceu, conquistou sede própria em Pouso Alegre (MG) e hoje conta com estrutura industrial moderna para atender projetos em todo o território nacional.', 'Parágrafo 3 história'),
  ('sobre_sede_texto', 'Fábrica, showroom e atendimento técnico no mesmo endereço — estrutura industrial própria construída ao longo de mais de 25 anos.', 'Texto seção Sede'),
  ('sobre_endereco', 'Av. Antonio Mariosa, 4545 — Santa Angelina, Pouso Alegre, MG', 'Endereço completo'),
  ('sobre_horario', 'Seg–Qui: 7h30–18h · Sex: 7h30–17h', 'Horário de funcionamento'),
  ('sobre_fabrica_p1', 'Tecnologia de corte a laser aplicada ao aço inox com precisão milimétrica. É assim que cada peça da POUSINOX® começa — com processo controlado, equipamento de ponta e mão de obra especializada.', 'Parágrafo 1 fábrica Sobre'),
  ('sobre_fabrica_p2', 'Da programação CNC ao acabamento final, fabricamos tudo internamente. Isso garante qualidade, prazo e rastreabilidade em cada projeto entregue.', 'Parágrafo 2 fábrica Sobre'),
  ('sobre_lema', '"Soluções em inox que elevam ambientes."', 'Lema/blockquote');

-- ── Contato ──
INSERT INTO site_config (chave, valor, descricao) VALUES
  ('contato_titulo', 'Orçamento e Contato', 'Título da página Contato'),
  ('contato_subtitulo', 'Fale com a POUSINOX® pelo canal de sua preferência. Respondemos rapidamente.', 'Subtítulo contato'),
  ('contato_form_titulo', 'Solicitar orçamento', 'Título do formulário'),
  ('contato_form_desc', 'Preencha o formulário abaixo com os detalhes do seu projeto. Nossa equipe entrará em contato em breve.', 'Descrição do formulário'),
  ('contato_telefone', '(35) 3423-8994', 'Telefone de contato'),
  ('contato_endereco', 'Av. Antonio Mariosa, 4545\nSanta Angelina — Pouso Alegre, MG\nCEP 37550-360', 'Endereço completo contato'),
  ('contato_horario_1', 'Seg–Qui: 7h30–11h30 / 13h15–18h', 'Horário linha 1'),
  ('contato_horario_2', 'Sex: 7h30–11h30 / 13h15–17h', 'Horário linha 2'),
  ('contato_horario_3', 'Sáb, Dom e Feriados: fechado', 'Horário linha 3');

-- ── Corte a Laser ──
INSERT INTO site_config (chave, valor, descricao) VALUES
  ('laser_hero_eyebrow', 'Serviço especializado', 'Eyebrow hero Corte a Laser'),
  ('laser_hero_titulo', 'Corte a Laser em Chapas Metálicas', 'Título hero Corte a Laser'),
  ('laser_hero_subtitulo', 'Aço inox, aço carbono, ligas de alumínio e outros metais — precisão milimétrica para chapas, peças decorativas, letras, logos e qualquer recorte personalizado.', 'Subtítulo hero Corte a Laser'),
  ('laser_aplicacoes_titulo', 'O que cortamos a laser', 'Título seção aplicações'),
  ('laser_aplicacoes_subtitulo', 'Da chapa industrial à peça artística — o corte a laser permite executar qualquer geometria com precisão e acabamento superior.', 'Subtítulo aplicações'),
  ('laser_materiais_titulo', 'Materiais que cortamos', 'Título seção materiais'),
  ('laser_materiais_subtitulo', 'Nossa máquina 3015G foi desenvolvida para o corte de chapas metálicas de diferentes ligas e composições.', 'Subtítulo materiais'),
  ('laser_industrias_intro', 'A tecnologia de corte a laser é amplamente utilizada em diferentes setores industriais que exigem precisão e versatilidade no processamento de chapas metálicas.', 'Intro indústrias'),
  ('laser_vantagens_titulo', 'Tecnologia que faz diferença', 'Título vantagens'),
  ('laser_vantagens_intro', 'O corte a laser combina precisão, velocidade e flexibilidade que processos convencionais não atingem. Ideal para peças únicas ou séries, em aço inox, aço carbono, alumínio e outros metais.', 'Intro vantagens'),
  ('laser_wa_mensagem', 'Olá, gostaria de um orçamento de corte a laser.', 'Mensagem WhatsApp corte a laser');
