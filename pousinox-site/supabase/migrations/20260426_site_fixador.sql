-- Conteúdo editável da página Fixador de Porcelanato

-- Config keys para textos do fixador
INSERT INTO site_config (chave, valor, descricao) VALUES
  ('fixador_hero_eyebrow', 'Reforço mecânico · Pousinox®', 'Eyebrow do hero fixador'),
  ('fixador_hero_titulo', 'Fixador de Porcelanato em Aço Inox', 'Título hero fixador (sem quebras)'),
  ('fixador_hero_subtitulo', 'Reforço mecânico obrigatório para porcelanatos de grande formato, fachadas externas e revestimentos especiais. Quando a argamassa cede, o fixador mantém a placa no lugar — evitando quedas e acidentes.', 'Subtítulo hero fixador'),
  ('fixador_intro_eyebrow', 'Por que usar ancoragem mecânica?', 'Eyebrow seção intro'),
  ('fixador_intro_titulo', 'A argamassa sozinha não é suficiente', 'Título seção intro'),
  ('fixador_intro_p1', 'Porcelanatos de grande formato, fachadas externas e revestimentos sujeitos a variações térmicas e vibração sofrem com a fadiga da argamassa ao longo do tempo. Quando a aderência cede, a queda é abrupta — e pode causar acidentes graves.', 'Parágrafo 1 intro'),
  ('fixador_intro_p2', 'O Fixador de Porcelanato Pousinox® é o reforço mecânico que garante a retenção da placa independente da argamassa: mesmo que ela perca aderência ao longo do tempo, o fixador mantém a placa no lugar — eliminando o risco de desprendimento.', 'Parágrafo 2 intro'),
  ('fixador_lamat_titulo', 'Resistência mecânica comprovada pelo LAMAT/SENAI', 'Título seção LAMAT'),
  ('fixador_lamat_desc', 'O Fixador Pousinox® foi submetido a ensaios de resistência mecânica pelo LAMAT/SENAI, laboratório independente. Os ensaios avaliaram diferentes configurações de abertura — compatíveis com diversas espessuras de porcelanato — e comprovam a eficácia do produto em aplicações profissionais de fachada e revestimento.', 'Descrição seção LAMAT'),
  ('fixador_empreiteiras_titulo', 'Por que especificar o Fixador Pousinox®?', 'Título seção empreiteiras'),
  ('fixador_empreiteiras_subtitulo', 'Além da segurança técnica, oferecemos a infraestrutura comercial que grandes obras precisam para especificar com confiança.', 'Subtítulo empreiteiras'),
  ('fixador_cta_titulo', 'Especifique o Fixador Pousinox® no seu próximo projeto', 'Título CTA fixador'),
  ('fixador_cta_subtitulo', 'Atendemos construtoras, empreiteiras e instaladores em todo o Brasil. Solicite orçamento ou fale diretamente com nossa equipe técnica.', 'Subtítulo CTA fixador'),
  ('fixador_wa_mensagem', 'Olá, tenho interesse no Fixador de Porcelanato Pousinox. Pode me ajudar?', 'Mensagem WhatsApp fixador');

-- FAQ do fixador (categoria separada)
INSERT INTO site_faq (pergunta, resposta, categoria, ordem) VALUES
  ('O fixador substitui a argamassa?', 'Não. O fixador é uma ancoragem complementar — sempre utilizado junto com argamassa AC-III. Ele atua como segunda linha de retenção: caso a argamassa perca aderência ao longo do tempo, o fixador mantém a placa no lugar.', 'fixador', 1),
  ('O uso é recomendado por norma?', 'A NBR 13755 reconhece que fachadas cerâmicas exigem atenção especial à aderência e recomenda ancoragem mecânica, especialmente acima de 2,5 m de altura e para grandes formatos. Em projetos que exigem laudo técnico, a ancoragem mecânica é considerada boa prática de engenharia.', 'fixador', 2),
  ('Qualquer instalador consegue aplicar?', 'Sim. O processo exige apenas a ferramenta de incisão e bucha prego convencional. Qualquer profissional com experiência em revestimentos executa com facilidade, sem necessidade de treinamento específico.', 'fixador', 3),
  ('Qual a diferença entre abertura 5 mm e 11 mm?', 'As aberturas correspondem à espessura da placa cerâmica. A abertura 5 mm é indicada para placas entre 5 e 8 mm; a abertura 11 mm para placas de 9 a 14 mm. Ambas as configurações foram avaliadas nos ensaios LAMAT/SENAI.', 'fixador', 4),
  ('O fixador aparece após a instalação?', 'Não. O fixador fica completamente oculto após a instalação. A aba de ancoragem fica coberta pela argamassa e pelo rejuntamento, sem interferir na estética final do revestimento.', 'fixador', 5),
  ('Como solicitar volume para uma grande obra?', 'Entre em contato pelo formulário de orçamento ou WhatsApp informando a quantidade estimada de m² de revestimento. Com fabricação própria, conseguimos planejar volumes expressivos com prazo acordado para cada projeto.', 'fixador', 6);

-- SEO fixador
INSERT INTO site_seo (rota, titulo, descricao) VALUES
  ('/fixador-porcelanato', 'Fixador de Porcelanato em Aço Inox — Linha Especializada Pousinox®', 'Fixador mecânico de porcelanato em aço inoxidável, fabricado pela Pousinox® em Pouso Alegre, MG. Resistência comprovada por ensaios LAMAT/SENAI.')
ON CONFLICT (rota) DO UPDATE SET titulo = EXCLUDED.titulo, descricao = EXCLUDED.descricao;
